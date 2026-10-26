// Die Endlosen Lande (6.1): feste Welt aus Chunks, Barrieren und Werkzeuge, Leuchtfeuer, Karte, Regeln von 6.0 (Tod, Entkommen, Abbruch, Begleiter-Tasche)
// und ein Durchlauf mit Antippen (hoch und quer). Aufruf: node lande.js [ausgabeordner]   (BASE = Adresse des Spiels)
// Läuft auch ohne die Teile B/A/K/M (Bosse, Artefakte, Kreaturen, Mods): dann mit kleinen Ersatz-Funktionen für die Schnittstellen.
const { chromium } = require('playwright');
const fs = require('fs');
const OUT = process.argv[2] || '/tmp/klingenhort-test/lande';
const BASE = (process.env.BASE || 'http://localhost:8777/').replace(/\/?$/, '/');
const fails = [], ok = (c, msg) => { if (!c) fails.push(msg); console.log((c ? '  ok   ' : '  FAIL ') + msg); };
// Ersatz für die Begleiter-Schnittstelle aus js/pets.js, falls sie (noch) fehlt
const STANDIN = () => {
  if (typeof petBagSize === 'function') return 'echt';
  window.petBagSize = () => 3;
  window.petHurt = (p, min) => { p.hurt = Date.now() + min * 60000; };
  window.petIsHurt = p => !!p && p.hurt > Date.now();
  const pa = window.petActive; window.petActive = () => { const p = pa(); return p && !petIsHurt(p) ? p : null; };
  return 'ersatz';
};
const HERO = (cls, lv) => {
  localStorage.clear(); loadAll();
  const c = newChar(cls || 'knight', 'Wanderer', 'normal', false); c.lv = lv || 14; c.act = 3; c.maxAct = 3; c.story = { a1: 1, a2: 1, a3: 1 };
  SAVE.chars.push(c); activateChar(0); SAVE.meta.hide.intro = true; SAVE.meta.lande.tips = 0xffff; for (const a of ACH) SAVE.meta.ach[a.id] = 1;   // Erfolge zahlen sonst Gold zwischendurch
  P.gear.weapon = makeItem({ slot: 'weapon', base: CLASSES[P.cls].start, tier: 2, rar: 3 }); P.gear.armor = makeItem({ slot: 'armor', base: 'armor', tier: 2, rar: 2 });
  computeStats(); P.hp = P.st.hp; saveChar();
};
// Ruhe im Test: keine Jäger, keine Rivalen, keine Gegner in der Nähe
const CALM = () => { LW.huntT = 1e9; LW.rivT = 1e9; for (const e of enemies) e.dead = true; enemies = []; LW.hurtT = -99; };

(async () => {
  fs.rmSync(OUT, { recursive: true, force: true }); fs.mkdirSync(OUT, { recursive: true });
  const b = await chromium.launch();
  console.log('Endlose Lande – Welt und Regeln');
  {
    const page = await b.newPage({ viewport: { width: 844, height: 390 }, locale: 'de-DE' });
    const errs = []; page.on('pageerror', e => errs.push(e.message + ' @ ' + ((e.stack || '').split('\n')[1] || '').trim()));
    await page.goto(BASE + 'index.html'); await page.waitForTimeout(1500);
    const api = await page.evaluate(STANDIN);
    console.log('  Begleiter-Schnittstelle:', api);
    // Welt-Saat: derselbe Chunk sieht immer gleich aus – auch in einem frisch geladenen Spiel
    const hashChunk = () => {
      const h = (cx, cy) => { LFIX.clear(); const d = lGenFixed(cx, cy); let s = 0; for (const a of [d.rg, d.bar, d.wk, d.road, d.lakeT]) for (let i = 0; i < a.length; i++) s = (Math.imul(s, 31) + a[i]) | 0; return s + '|' + d.regs.map(R => R.id + R.biome).join(',') + '|' + d.objs.map(o => o.k + (o.t || '') + Math.round(o.x) + ',' + Math.round(o.y)).join(';'); };
      return [h(123, -45), h(123, -45), h(5000, 0), h(-3000, 2500), h(0, 0)];
    };
    const h1 = await page.evaluate(hashChunk);
    await page.reload(); await page.waitForTimeout(1500); await page.evaluate(STANDIN);
    const h2 = await page.evaluate(hashChunk);
    ok(h1[0] === h1[1] && h1[0] === h2[0] && h1[2] === h2[2] && h1[3] === h2[3] && h1[4] === h2[4], 'Welt-Saat: gleicher Chunk → gleiche Kacheln, Regionen und Objekte (auch nach Neuladen)');
    ok(h1[0] !== h1[2] && h1[2] !== h1[3], 'verschiedene Chunks sehen verschieden aus');
    // Häppchenweise erzeugt = in einem Stück erzeugt
    ok(await page.evaluate(() => { LFIX.clear(); const a = lGenFixed(77, 31), it = lGenIt(77, 31); let r, n = 0; do { r = it.next(); n++; } while (!r.done); const c = r.value; return n > 3 && a.bar.join() === c.bar.join() && a.objs.length === c.objs.length; }), 'Chunk in Häppchen erzeugt = in einem Stück erzeugt');
    // Schnittstellen, Biome, Stufen-Kurve
    const s = await page.evaluate(([HERO_]) => {
      eval('(' + HERO_ + ')')(); const o = {};
      o.biomes = Object.keys(LANDE_BIOMES).length; o.tools = LANDE_TOOLS.length;
      o.hab = Object.values(LANDE_BIOMES).every(B => Array.isArray(B.hab) && B.hab.length && (typeof PET_HABS === 'undefined' || B.hab.every(h => PET_HABS.includes(h))));
      if (typeof eggForBiome === 'function' && typeof PET_SP !== 'undefined') { let fit = 0; for (let i = 0; i < 40; i++) { const d = eggForBiome('vulkan', .2, 1); if ((PET_SP[d.sp].hab || []).some(h => LANDE_BIOMES.vulkan.hab.includes(h))) fit++; } o.eggFit = fit >= 20; } else o.eggFit = true;
      o.stage = [worldStage(0), worldStage(.005), worldStage(.042), worldStage(.25), worldStage(.5), worldStage(1)];
      o.mono = o.stage.every((v, i) => !i || v > o.stage[i - 1]);
      const c = landeCtx(10, 20, 'test'); o.ctx = c.cx === 10 && c.cy === 20 && c.depth > 0 && c.stage >= 6 && !!LANDE_BIOMES[c.biome] && typeof c.region === 'string' && typeof c.R === 'function' && c.R() === landeCtx(10, 20, 'test').R();
      o.give = landeToolGive('seil') === true && landeToolGive('seil') === false && landeToolHas('seil') && !landeToolHas('eishaken'); SAVE.meta.lande.tools = 0;
      o.fns = ['landeActive', 'landeToolGive', 'landeToolHas', 'landeDepth', 'landeCtx', 'worldStage', 'landeLocal', 'landeWorld', 'landeLootHTML'].every(f => typeof window[f] === 'function');
      // Alle Biome kommen in der Welt vor (Suche nach außen)
      const seen = new Set(); for (let r = 1; r < 520; r += r < 40 ? 1 : 4) for (let a = 0; a < 6.283; a += Math.max(.03, 3 / r)) seen.add(lCell(Math.round(Math.cos(a) * r), Math.round(Math.sin(a) * r)).biome);
      o.inWorld = seen.size; o.missing = Object.keys(LANDE_BIOMES).filter(k => !seen.has(k));
      // jede Ringgrenze hat Übergänge an den Alten Wegen
      o.ringX = LRING.every((R, k) => [0, 1, 2, 3, 4, 5].some(rd => !!lRoadCross(rd, k)));
      return o;
    }, [HERO.toString()]);
    ok(s.hab && s.eggFit, 'Biome haben Lebensräume (hab, Marken aus PET_HABS): Eier passen meist zum Gebiet');
    ok(s.biomes >= 40 && s.inWorld >= 44, `${s.biomes} Biome, ${s.inWorld} davon in der Welt gefunden${s.missing.length ? ' (fehlt: ' + s.missing.join(', ') + ')' : ''}`);
    ok(s.tools === 11 && s.ringX, '11 Werkzeuge, jede Ringgrenze hat Übergänge an den Alten Wegen');
    ok(s.mono && s.stage[0] === 6 && s.stage[5] === 240, 'Stufe nach Tiefe: ' + s.stage.join(' → ') + ' (Tor wie Grenzland, Weltrand fast unmöglich)');
    ok(s.ctx && s.give && s.fns, 'Schnittstellen: landeCtx (gleicher Zufall für gleiche Saat), landeToolGive/Has und Co.');
    // Spielstand: Standardwerte, Reparatur, alter Spielstand aus 6.0
    const m = await page.evaluate(() => {
      const o = {}, M = SAVE.meta.lande;
      o.def = M.v === 2 && M.runs === 0 && Array.isArray(M.box) && M.cur === null && M.keys === 0 && M.tools === 0 && M.stones === 1 && Array.isArray(M.cps) && M.start === 'tor';
      const fx = lMetaFix({ runs: 'x', box: [{ t: 'item' }, { t: 'gold', n: 5 }], cur: 7, map: { 'x': 5, '1,2': 'AAAA', '3,4': 123 }, cps: [{ x: 'a' }, { x: 100, y: 200, i: 3 }], tools: -5, regs: 'nope', start: 'c9' });
      o.fix = fx.runs === 0 && fx.box.length === 1 && fx.cur === null && Object.keys(fx.map).join() === '1,2' && fx.cps.length === 1 && fx.cpn === 4 && fx.tools === 0 && fx.regs.length === 0 && fx.start === 'tor';
      const old = lMetaFix({ runs: 12, ext: 9, deaths: 2, rep: 520, keys: 3, tx: [6, 3], sel: 2, best: 900, box: [{ t: 'gold', n: 9 }] });
      o.old = old.v === 2 && old.rep === 520 && old.keys === 3 && old.ext === 9 && old.best === 900 && old.stones >= 2 && old.box.length === 1 && !('tx' in old) && !('sel' in old);
      // Seltenheit: Kampagne unverändert, Freiwelt besser – nach Tiefe
      const cnt = [0, 0, 0, 0, 0, 0, 0]; for (let i = 0; i < 20000; i++) cnt[randomItem(10, 0).rar]++; o.campLeg = cnt[4] / 200; o.campMyth = cnt[6];
      const w = [0, 0, 0, 0, 0, 0, 0], w4 = [0, 0, 0, 0, 0, 0, 0]; for (let i = 0; i < 40000; i++) { w[landeRar(Math.random(), lLuckD(0))]++; w4[landeRar(Math.random(), lLuckD(.1))]++; }
      o.wLeg = w[4] / 400; o.wMyth = w[6] / 400; o.w4Leg = w4[4] / 400; o.w4Myth = w4[6] / 400;
      return o;
    });
    ok(m.def && m.fix, 'Spielstand: SAVE.meta.lande mit Standardwerten, kaputte Daten werden repariert');
    ok(m.old, 'Spielstand aus 6.0: Ruf, Schlüssel, Statistik bleiben, Weltstufen entfallen, dafür Leuchtfeuersteine');
    ok(m.campLeg < 1.5 && m.campMyth === 0, `Kampagne: Legendär ${m.campLeg.toFixed(2)} %, kein Mythisch aus normaler Beute`);
    ok(m.wLeg > 1 && m.wLeg < 2 && m.wMyth > .05 && m.wMyth < .3 && m.w4Leg > m.wLeg * 2.5 && m.w4Myth > m.wMyth * 2.5, `Freiwelt: Legendär ${m.wLeg.toFixed(2)} % / ${m.w4Leg.toFixed(1)} %, Mythisch ${m.wMyth.toFixed(2)} % / ${m.w4Myth.toFixed(2)} % (am Tor / 4 h Fußmarsch)`);
    // Betreten: Weltentor in der Mitte, Chunks geladen, Kamera und Stufe
    await page.evaluate(() => { lBegin(); });
    await page.waitForTimeout(400);
    const g = await page.evaluate(() => {
      const o = {}, M = SAVE.meta.lande;
      o.on = landeActive() && G.type === 'lande' && state === 'play' && LW.cm.size >= 9 && !!bg.draw;
      o.gate = Math.hypot(P.x - LOFF - 384, P.y - LOFF - 372) < 30 && lWalk(P.x, P.y);
      o.npcs = ['mis', 'trade', 'heal'].every(r => lNear(P.x, P.y, 300).some(n => n.k === 'npc' && n.role === r));
      o.exit = lNear(P.x, P.y, 200).some(x => x.k === 'exit' && x.t === 'tor');
      o.stage = stageNum() === lStage(P.x, P.y) && lStage(P.x, P.y) <= 8;
      o.cur = !!M.cur && M.runs === 1;
      o.reg = !!LW.reg && LW.regs.has(LW.reg.id) && !SAVE.meta.lande.regs.includes(LW.reg.id);
      return o;
    });
    ok(g.on && g.gate && g.exit, 'Betreten: Start am Weltentor in der Mitte der Welt, Chunks geladen, Boden aus Chunks');
    ok(g.npcs && g.stage && g.cur && g.reg, 'Am Tor: Kundschafterin, Händler, Heilerin; leichte Gegnerstufe; Region entdeckt (noch nicht gesichert)');
    // Weit draußen: Chunk (5000, 0) streamen
    const far2 = await page.evaluate(([CALM_]) => {
      const CALM = eval('(' + CALM_ + ')'); CALM(); const t0 = performance.now(); lTeleport(5000 * LCK + LOFF + 384, LOFF + 384); const t = performance.now() - t0; CALM(); P.inv = 1e9;
      const r = lRecAt(P.x, P.y); return { rec: !!r && r.cx === 5000 && r.cy === 0, st: lStage(P.x, P.y), depth: landeDepth(), reg: lRegName(lRegAt(P.x, P.y)), t, n: LW.cm.size };
    }, [CALM.toString()]);
    await page.waitForTimeout(800);
    const far3 = await page.evaluate(() => { const r = lRecAt(P.x, P.y); return { painted: !!r && r.pd, alive: landeActive() && state === 'play' }; });
    ok(far2.rec && far3.painted && far3.alive && far2.st > 100 && far2.depth > .5, `Chunk (5000, 0) geladen und gemalt: ${far2.reg}, Stufe ${far2.st}, Tiefe ${(far2.depth * 100).toFixed(0)} % (Sprung ${far2.t.toFixed(0)} ms)`);
    // Rechenzeit je Chunk (Erzeugen in Häppchen, Malen in Häppchen)
    const perf = await page.evaluate(() => {
      let tot = 0, mx = 0, n = 0; for (let i = 0; i < 40; i++) { const it = lGenIt(300 + i * 7, -120 + i * 11); let r; do { const t = performance.now(); r = it.next(); mx = Math.max(mx, performance.now() - t); } while (!r.done); tot += r.value.ms; n++; }
      let pt = 0, pm = 0; for (let i = 0; i < 12; i++) { const d = lFixed(300 + i * 7, -120 + i * 11), rec = { cx: d.cx, cy: d.cy, d, X0: d.X0, Y0: d.Y0, cv: null, ps: 0, pd: false }, t0 = performance.now(); while (!rec.pd) { const t = performance.now(); lPaintStep(rec, 0); pm = Math.max(pm, performance.now() - t); } pt += performance.now() - t0; lUnpaint(rec); }
      return { gen: tot / n, step: mx, paint: pt / 12, pstep: pm };
    });
    console.log(`  Chunk erzeugen ${perf.gen.toFixed(2)} ms (größtes Häppchen ${perf.step.toFixed(2)} ms), Boden malen ${perf.paint.toFixed(2)} ms (größtes Häppchen ${perf.pstep.toFixed(2)} ms)`);
    ok(perf.gen < 8 && perf.paint < 16, `Rechenzeit je Chunk unter 8 ms: ${perf.gen.toFixed(2)} ms (in Häppchen vorgeladen, Boden in Häppchen von höchstens 4 ms je Bild)`);
    // Barriere: ohne Seil kein Weg über die Schlucht, mit Seil am Übergang schon
    const walk = async (fromRho, toRho, secs, tools) => page.evaluate(([fromRho, toRho, secs, tools, CALM_]) => {
      const CALM = eval('(' + CALM_ + ')'), M = SAVE.meta.lande; M.tools = tools;
      const c = lRoadCross(0, 0), [x0, y0] = lRoadPt(0, fromRho); lTeleport(x0 * LCK + LOFF, y0 * LCK + LOFF); CALM(); P.inv = 1e9;
      const tx = c.px * LCK + LOFF, ty = c.py * LCK + LOFF, [x2, y2] = lRoadPt(0, toRho), ex = x2 * LCK + LOFF, ey = y2 * LCK + LOFF; let bad = 0, maxRho = 0;
      $('toast').textContent = '';
      for (let i = 0; i < secs * 60; i++) { const gx = Math.hypot(tx - P.x, ty - P.y) > 12 && !(P.passed) ? tx : ex, gy = gx === tx ? ty : ey; if (gx === ex) P.passed = true; const dx = gx - P.x, dy = gy - P.y, d = Math.hypot(dx, dy) || 1; stick.id = 99; stick.x = dx / d; stick.y = dy / d; CALM(); update(1 / 60); if (!lWalk(P.x, P.y)) bad++; maxRho = Math.max(maxRho, Math.hypot(P.x - LOFF, P.y - LOFF) / LCK); }
      stick.id = null; stick.x = stick.y = 0; delete P.passed;
      return { bad, maxRho, ringR: Math.hypot(c.px, c.py), toast: $('toast').textContent };
    }, [fromRho, toRho, secs, tools, CALM.toString()]);
    const w0 = await page.evaluate(() => Math.hypot(lRoadCross(0, 0).px, lRoadCross(0, 0).py));
    const noTool = await walk(w0 - .45, w0 + 1.2, 8, 0);
    ok(noTool.bad === 0 && noTool.maxRho < noTool.ringR + .02 && /Du brauchst: Seil/.test(noTool.toast), `Barriere ohne Seil: kein Durchkommen, Meldung „${noTool.toast.slice(0, 60)}…“`);
    const withTool = await walk(w0 - .45, w0 + 1.2, 18, 1);
    ok(withTool.bad === 0 && withTool.maxRho > withTool.ringR + .4, `Mit Seil über den Übergang: ${withTool.maxRho.toFixed(2)} > ${withTool.ringR.toFixed(2)} Chunks vom Tor`);
    // Am Ausgang stehen dauert genau die angezeigte Zeit (nicht doppelt so schnell)
    const ch = await page.evaluate(([CALM_]) => {
      const CALM = eval('(' + CALM_ + ')'); lTeleport(LOFF + 384, LOFF + 372); CALM(); P.inv = 1e9;
      const ex = lNear(P.x, P.y, 200).find(o => o.k === 'exit' && o.t === 'tor'); P.x = ex.x; P.y = ex.y; LW.lx = P.x; LW.ly = P.y; const need = lChannel(ex); let t = 0;
      while (landeActive() && t < 20) { CALM(); P.x = ex.x; P.y = ex.y; update(1 / 60); t += 1 / 60; }
      return { need, t, done: !landeActive() && /ENTKOMMEN/.test(panel.textContent) };
    }, [CALM.toString()]);
    ok(ch.done && Math.abs(ch.t - ch.need) < .15, `Ausgang: ${ch.t.toFixed(2)} s gestanden für ${ch.need.toFixed(1)} s Anzeige`);
    // Leuchtfeuer: Stein kostet, nicht im Kampf, sichert die Karte, Start und Ausgang
    await page.evaluate(() => { ON.l_home(); lBegin(); });
    const cp = await page.evaluate(([CALM_]) => {
      const CALM = eval('(' + CALM_ + ')'), M = SAVE.meta.lande, o = {}; CALM(); P.inv = 1e9;
      const [x, y] = lRoadPt(2, 9); lTeleport(x * LCK + LOFF, y * LCK + LOFF); CALM(); lTick(.3); lTick(.3);
      M.stones = 1; LW.hurtT = T; o.fight = !!lCpBlock(); LW.hurtT = -99;
      const fog = LW.fog.size, map0 = Object.keys(M.map).length; o.free = lCpBlock() === '';
      ON.l_cpok(); o.set = M.cps.length === 1 && M.stones === 0 && M.start === 'c' + M.cps[0].i && Object.keys(M.map).length > map0 && fog > 0 && LW.fog.size === 0;
      o.beacon = lNear(P.x, P.y, 200).some(b => b.k === 'beacon');
      o.cp = M.cps[0]; o.regs = M.regs.length;
      return o;
    }, [CALM.toString()]);
    ok(cp.fight && cp.free, 'Leuchtfeuer: im Kampf gesperrt, sonst erlaubt');
    ok(cp.set && cp.beacon && cp.regs > 0, 'Leuchtfeuer gesetzt: Stein verbraucht, Karte und Regionen gesichert, Leuchtfeuer steht in der Welt');
    // Tod: was seit dem letzten Leuchtfeuer erkundet wurde, ist vergessen
    const dl = await page.evaluate(([CALM_]) => {
      const CALM = eval('(' + CALM_ + ')'), M = SAVE.meta.lande, map0 = JSON.stringify(M.map), regs0 = M.regs.length;
      lTeleport(LOFF + 40 * LCK, LOFF - 30 * LCK); CALM(); lTick(.3); lTick(.3); const fx = Math.floor((P.x - LOFF) / LFLD), fy = Math.floor((P.y - LOFF) / LFLD), known = lKnownF(fx, fy);
      P.inv = 0; hurtPlayer(1e9, null); for (let i = 0; i < 300 && state === 'dead'; i++) update(.05);
      return { known, after: lKnownF(fx, fy), same: JSON.stringify(M.map) === map0 && M.regs.length === regs0, screen: state === 'over' && /vergessen/.test(panel.textContent) };
    }, [CALM.toString()]);
    ok(dl.known && !dl.after && dl.same && dl.screen, 'Tod: neu Erkundetes ist vergessen, die Karte bis zum Leuchtfeuer bleibt');
    // Nächster Ausflug am Leuchtfeuer – und dort hinaus
    const cs = await page.evaluate(([CALM_]) => {
      const CALM = eval('(' + CALM_ + ')'), M = SAVE.meta.lande; ON.l_wake(); const st = lStarts(); const o = { starts: st.length === 2 && st[1].cp === M.cps[0] };
      lBegin(st.find(s => s.id === M.start)); CALM(); P.inv = 1e9;
      const b = lNear(P.x, P.y, 200).find(x => x.k === 'beacon'); o.near = !!b && Math.hypot(b.x - P.x, b.y - P.y) < 70;
      P.x = b.x; P.y = b.y; LW.lx = P.x; LW.ly = P.y; let t = 0; while (landeActive() && t < 20) { CALM(); P.x = b.x; P.y = b.y; update(1 / 60); t += 1 / 60; }
      o.out = !landeActive() && /ENTKOMMEN/.test(panel.textContent); o.ext = M.ext === 2;
      return o;
    }, [CALM.toString()]);
    ok(cs.starts && cs.near && cs.out && cs.ext, 'Start am Leuchtfeuer, Leuchtfeuer ist ein Ausgang');
    // Höchstens 12 Leuchtfeuer: das am längsten unbenutzte erlischt
    const lim = await page.evaluate(([CALM_]) => {
      const CALM = eval('(' + CALM_ + ')'), M = SAVE.meta.lande; ON.l_home(); lBegin(); CALM();
      for (let i = 0; i < 13; i++) { const [x, y] = lRoadPt(i % 6, 6 + i); lTeleport(x * LCK + LOFF, y * LCK + LOFF); CALM(); M.stones = 1; if (lCpBlock()) { P.x += 300; LW.lx = P.x; } ON.l_cpok(); M.cps[M.cps.length - 1].u = Date.now() + i; }
      return { n: M.cps.length, first: M.cps.every(c => c.i !== 0) };
    }, [CALM.toString()]);
    ok(lim.n === 12 && lim.first, 'Höchstens 12 Leuchtfeuer: das älteste erlischt');
    // Beute in den Rucksack, Tod, Entkommen, Neu laden, Kampf-Neuladen (Regeln aus 6.0)
    const pk = await page.evaluate(([CALM_]) => {
      const CALM = eval('(' + CALM_ + ')'); ON.l_home(); SAVE.meta.lande.cps = []; lBegin(); CALM();
      const o = {}, gold0 = P.gold, mats0 = P.mats.erz || 0; P.inv = 999;
      const put = c => { c.x = P.x; c.y = P.y; c.z = 0; c.vz = 0; c.vx = c.vy = 0; c.t = 1; pickups.push(c); };
      put({ k: 'coin', v: 25 }); put({ k: 'mat', m: 'erz', n: 3 }); put({ k: 'loot', it: makeItem({ slot: 'helm', base: 'helm', tier: 1, rar: 4 }) }); put({ k: 'lpart', pk: 'klinge:2', n: 1 }); put({ k: 'lmod', mk: 'test:1', n: 2 });
      updPickups(.016);
      o.gold = LW.pack.some(e => e.t === 'gold' && e.n === 25) && P.gold === gold0; o.mat = LW.pack.some(e => e.t === 'mat' && e.k === 'erz' && e.n === 3) && (P.mats.erz || 0) === mats0;
      o.item = LW.pack.some(e => e.t === 'item' && e.it.lw === LW.id); o.part = LW.pack.some(e => e.t === 'part' && e.k === 'klinge:2'); o.mod = LW.pack.some(e => e.t === 'mod' && e.k === 'test:1' && e.n === 2);
      put({ k: 'coin', v: 5 }); updPickups(.016); o.stack = LW.pack.filter(e => e.t === 'gold').length === 1 && LW.pack.find(e => e.t === 'gold').n === 30;
      const s0 = SAVE.meta.lande.stones; put({ k: 'lstone' }); updPickups(.016); o.stone = SAVE.meta.lande.stones === s0 + 1;
      P.hp = 10; put({ k: 'heart' }); updPickups(.016); o.heart = P.hp > 10;
      while (LW.pack.length < lCap()) LW.pack.push({ t: 'mat', k: MATORDER[LW.pack.length % 13], n: 1 }); LW.pack.length = lCap();
      const it = makeItem({ slot: 'weapon', base: CLASSES[P.cls].start, tier: 1, rar: 1 }); put({ k: 'loot', it }); updPickups(.016); o.full = pickups.some(c => c.it === it) && LW.pack.length === lCap();
      LW.pack.length = 4; const parts0 = JSON.stringify(P.parts); const e = lSpawn('goblin', P.x + 30, P.y, {}); lKillPre(e); P.parts['griff:3'] = (P.parts['griff:3'] || 0) + 1; lKillPost(e);
      o.parts = LW.pack.some(x => x.t === 'part' && x.k === 'griff:3') && JSON.stringify(P.parts) === parts0;
      // echte Mods (js/mods.js): Bodenbeute „mod“ → landePackAdd → Rucksack, daheim über modGive
      LW.pack.length = 0; pickups.length = 0; o.realMod = true;
      if (typeof modRoll === 'function' && typeof modDrop === 'function') {
        const k = modRoll(.1, 1), n0 = (P.mods && P.mods[k]) || 0; lDrop(P.x, P.y, { t: 'mod', k, n: 1 }); for (const c of pickups) { c.t = 1; c.z = 0; c.vz = 0; c.vx = c.vy = 0; c.x = P.x; c.y = P.y; } updPickups(.016);
        const inPack = LW.pack.some(e => e.t === 'mod' && e.k === k) && ((P.mods && P.mods[k]) || 0) === n0; lDeliver(LW.pack.splice(0)); o.realMod = inPack && P.mods[k] === n0 + 1;
      }
      LW.pack.length = 0; pickups.length = 0; return o;
    }, [CALM.toString()]);
    ok(pk.gold && pk.mat && pk.item && pk.part && pk.mod, 'Beute (Gold, Material, Gegenstand, Bauteil, Mod) kommt in den Rucksack, nicht nach Hause');
    ok(pk.realMod, 'Mods aus js/mods.js: Bodenbeute über landePackAdd in den Rucksack, daheim über modGive');
    ok(pk.stack && pk.heart && pk.stone, 'Gold stapelt sich, Herzen heilen wie immer, Leuchtfeuersteine gehen gleich aufs Konto');
    ok(pk.full && pk.parts, 'Rucksack voll: Beute bleibt liegen; Bauteile aus Kills wandern in den Rucksack');
    const eg = await page.evaluate(() => {
      const o = {}, n0 = SAVE.meta.pets.eggs.length; P.inv = 999; LW.pack.length = 0; pickups.length = 0;
      const d = lEgg(2); o.roll = !!d && !!PET_SP[d.sp];
      const land = () => { for (const c of pickups) { c.t = 1; c.z = 0; c.vz = 0; c.vx = c.vy = 0; c.x = P.x; c.y = P.y; } updPickups(.016); };
      lDrop(P.x, P.y, { t: 'egg', d }); land();
      o.inPack = LW.pack.some(e => e.t === 'egg' && e.d.sp === d.sp) && SAVE.meta.pets.eggs.length === n0;
      if (typeof eggGive === 'function') { const e = lSpawn('goblin', P.x + 30, P.y, {}); lKillPre(e); eggGive(null, true, { tier: 1 }); lKillPost(e); o.killEgg = SAVE.meta.pets.eggs.length === n0 && pickups.some(c => c.k === 'legg'); } else o.killEgg = true;
      const all = [{ t: 'item', it: lItem(2, 1) }, { t: 'mat', k: 'erz', n: 2 }, { t: 'gem', k: randomGem(10), n: 1 }, { t: 'part', k: lPart(10, 0) || 'griff:3', n: 1 }, { t: 'egg', d }, { t: 'gold', n: 9 }];
      o.fmt = typeof petLootFix !== 'function' || all.every(x => !!petLootFix(x));
      o.market = typeof lootValue === 'function'; o.val = !o.market || all.every(x => lootValue(x) <= 0 || lVal(x) === Math.round(lootValue(x)));
      const r = lDeliver([{ t: 'egg', d }]), E = SAVE.meta.pets.eggs; o.deliver = r.eggs === 1 && E.length === n0 + 1 && E[E.length - 1].sp === d.sp;
      LW.pack.length = 0; pickups.length = 0; return o;
    });
    ok(eg.roll && eg.inPack && eg.killEgg, 'Begleiter-Eier: Weltbeute im Rucksack – Eier aus Siegen landen wie in 6.0 erst am Boden');
    ok(eg.fmt && eg.val && eg.deliver, 'Beute-Format passt zum Begleiter-Beutel, Wert ' + (eg.market ? 'aus dem Basar' : 'geschätzt') + ', heimgebrachtes Ei ins Brutnest');
    // Tod: Ausrüstung und Rucksack weg, Begleiter-Tasche kommt heim, Begleiter verletzt
    const d = await page.evaluate(() => {
      const o = {}; SAVE.meta.pets.starter = true; const p = petGive('drache', { nm: 'Funki', lv: 20 }); SAVE.meta.pets.act = p.id;
      LW.pet = lPet(); LW.petBag = lBagSize(LW.pet); o.bagSize = LW.petBag;
      const saved = lItem(3, 2), lost = lItem(2, 1), bag0 = P.bag.length, w0 = P.gear.weapon.uid;
      lBag(LW.pet).push({ t: 'item', it: saved }); LW.pack = [{ t: 'item', it: lost }, { t: 'gold', n: 500 }];
      const g0 = P.gold; P.inv = 0; hurtPlayer(1e9, null); o.dead = state === 'dead';
      for (let i = 0; i < 300 && state === 'dead'; i++) update(.05);
      o.screen = state === 'over' && /GEFALLEN IN DEN ENDLOSEN LANDEN/.test(panel.textContent);
      o.gearLost = P.gear.weapon.uid !== w0 && P.gear.weapon.tier === 0 && P.gear.weapon.rar === 0 && P.gear.armor.rar === 0;
      o.saved = P.bag.length === bag0 + 1 && P.bag.some(x => x.uid === saved.uid) && !P.bag.some(x => x.uid === lost.uid) && !saved.lw;
      o.goldLost = P.gold === g0; o.g = [g0, P.gold, enemies.length, LW ? 1 : 0]; o.bagEmpty = lBag(p).length === 0; o.hurt = petIsHurt(p); o.noPet = !lPet();
      const M = SAVE.meta.lande; o.meta = M.cur === null && !landeActive();
      o.persist = JSON.parse(localStorage.getItem(SAVE_KEY)).chars[0].gear.weapon.tier === 0;
      ON.l_wake(); o.hide = G && G.type === 'versteck' && P.hp === P.st.hp && !document.body.classList.contains('lande');
      return o;
    });
    ok(d.dead && d.screen, 'Tod: eigener Bildschirm „Gefallen in den Endlosen Landen“');
    ok(d.gearLost && d.goldLost && d.saved && d.bagEmpty, 'Tod: Ausrüstung und Rucksack weg, nur die Begleiter-Tasche kommt heim' + (d.gearLost && d.goldLost && d.saved && d.bagEmpty ? '' : ' ' + JSON.stringify(d)));
    ok(d.hurt && d.noPet && d.meta && d.persist && d.hide, 'Tod: Begleiter verletzt, gespeichert, Held erwacht im Versteck');
    // Entkommen: alles in Sicherheit
    await page.evaluate(() => { const p = SAVE.meta.pets.list[0]; delete p.hurt; lBegin(); });
    const ex = await page.evaluate(([CALM_]) => {
      const CALM = eval('(' + CALM_ + ')'), o = {}, it = lItem(2, 1), it2 = lItem(2, 1), bag0 = P.bag.length; CALM(); LW.pack = [{ t: 'item', it }, { t: 'gold', n: 300 }, { t: 'mat', k: 'mithril', n: 4 }]; it.lw = LW.id;
      lBag(LW.pet).push({ t: 'item', it: it2 }); const g0 = P.gold, m0 = P.mats.mithril || 0, ext0 = SAVE.meta.lande.ext;
      const e0 = lNear(P.x, P.y, 300).find(e => e.k === 'exit'); P.x = e0.x; P.y = e0.y; P.inv = 999;
      for (let i = 0; i < 400 && landeActive(); i++) { CALM(); P.x = e0.x; P.y = e0.y; update(.05); }
      o.done = !landeActive() && /ENTKOMMEN/.test(panel.textContent);
      o.items = P.bag.length === bag0 + 2 && P.bag.every(i => !i.lw); o.gold = P.gold >= g0 + 300 && (P.mats.mithril || 0) === m0 + 4;
      const M = SAVE.meta.lande; o.meta = M.ext === ext0 + 1 && M.best > 0 && M.cur === null;
      return o;
    }, [CALM.toString()]);
    ok(ex.done && ex.items && ex.gold && ex.meta, 'Ausgang: stehen bleiben → entkommen, Rucksack und Tasche landen bei dir');
    // Abbruch durch Neu laden: Rucksack weg, Ausrüstung vom Aufbruch zurück – ohne Verdopplung
    await page.evaluate(() => { ON.l_home(); lBegin(); });
    const rl = await page.evaluate(() => {
      const of = (sl, r) => { let it; do it = lItem(r, 1); while (it.slot !== sl); return it; };
      const w0 = P.gear.weapon, found = of('weapon', 3); found.lw = LW.id; LW.pack.push({ t: 'item', it: w0 }); P.gear.weapon = found; LW.pack.push({ t: 'gold', n: 999 });
      const a0 = P.gear.armor; lBag(LW.pet).push({ t: 'item', it: a0 }); P.gear.armor = of('armor', 2); P.gear.armor.lw = LW.id;
      LW.hurtT = -99; for (const e of enemies) e.dead = true; SAVE.meta.lande.cur.fight = false; saveChar(); persist(); return { w0: w0.uid, a0: a0.uid, found: found.uid, ab: SAVE.meta.lande.aband };
    });
    await page.reload(); await page.waitForTimeout(1500);
    const rl2 = await page.evaluate(([ids, STANDIN_]) => {
      eval('(' + STANDIN_ + ')')(); activateChar(0);
      const M = SAVE.meta.lande, n = u => ['weapon', 'armor', 'helm'].filter(s => P.gear[s] && P.gear[s].uid === u).length + P.bag.filter(i => i.uid === u).length + SAVE.meta.pets.list.reduce((a, p) => a + (Array.isArray(p.bag) ? p.bag.filter(e => e.t === 'item' && e.it.uid === u).length : 0), 0);
      return { cur: M.cur === null, aband: M.aband === ids.ab + 1, weapon: P.gear.weapon.uid === ids.w0, armorNotDup: n(ids.a0) === 1, gold: !P.bag.some(i => i.uid === ids.found) && n(ids.found) === 0 };
    }, [rl, STANDIN.toString()]);
    ok(rl2.cur && rl2.aband && rl2.weapon && rl2.gold && rl2.armorNotDup, 'Neu laden mitten im Ausflug: Rucksack verloren, Waffe vom Aufbruch zurück, nichts verdoppelt');
    // Neu laden mitten im Kampf zählt als Tod
    const fl = await page.evaluate(() => {
      const PM = SAVE.meta.pets; if (PM.list[0]) { delete PM.list[0].hurt; PM.act = PM.list[0].id; }
      lBegin(); const w = P.gear.weapon, it = lItem(2, 1); if (LW.pet) lBag(LW.pet).push({ t: 'item', it }); LW.hurtT = T; LW.tick = 0; lTick(.01);
      const M = SAVE.meta.lande, o = { fight: !!M.cur && M.cur.fight === true, w: w.uid, it: it.uid, d0: M.deaths, pet: LW.pet && LW.pet.id }; saveChar(); persist(); return o;
    });
    await page.reload(); await page.waitForTimeout(1500);
    const fl2 = await page.evaluate(([o, STANDIN_]) => {
      eval('(' + STANDIN_ + ')')(); activateChar(0);
      const M = SAVE.meta.lande, p = SAVE.meta.pets.list.find(q => q.id === o.pet);
      return { cur: M.cur === null, dead: M.deaths === o.d0 + 1, gear: P.gear.weapon.uid !== o.w && P.gear.weapon.tier === 0, bag: P.bag.some(i => i.uid === o.it), hurt: !!p && (typeof petIsHurt !== 'function' || petIsHurt(p)) };
    }, [fl, STANDIN.toString()]);
    ok(fl.fight && fl2.cur && fl2.dead && fl2.gear && fl2.bag && fl2.hurt, 'Neu laden mitten im Kampf zählt als Tod: Ausrüstung weg, Begleiter-Tasche gerettet, Begleiter verletzt');
    // Abbrechen geht nicht mitten im Kampf
    const qa = await page.evaluate(() => { lBegin(); LW.hurtT = T; ON.l_quit(); const blocked = /MITTEN IM KAMPF/.test(panel.textContent) && !panel.querySelector('[data-act="l_quitok"]') && landeActive(); ON.l_resume(); LW.hurtT = -99; for (const e of enemies) e.dead = true; enemies = []; ON.l_quit(); const free = !!panel.querySelector('[data-act="l_quitok"]'); ON.l_quitok(); return blocked && free && !landeActive(); });
    ok(qa, 'Abbrechen: mitten im Kampf gesperrt, sonst möglich');
    // Aufträge, Händler, Tag und Nacht, Gefahren der Biome
    const ms = await page.evaluate(([CALM_]) => {
      const CALM = eval('(' + CALM_ + ')'), o = {}; SAVE.meta.pets.act = null; lBegin(); CALM();
      const npc = lNear(P.x, P.y, 300).find(n => n.k === 'npc' && n.role === 'mis'); lMisScreen(npc);
      o.mis = LW.misOn && LW.mis.length >= 3 && LW.mis.every(m => m.txt && m.rew.length && m.rep > 0) && /Gerücht/.test(panel.textContent);
      const k = LW.mis.find(m => m.t === 'kills') || (LW.mis.push(Object.assign({}, LW.mis[0], { t: 'kills', n: 2, c: 0, done: false, paid: false })), LW.mis[LW.mis.length - 1]); k.n = 2; k.c = 0; k.done = false;
      lMisEvent('kill'); lMisEvent('kill'); o.done = k.done;
      const rep0 = SAVE.meta.lande.rep; ON.l_claim(null, null, LW.mis.indexOf(k)); o.claim = k.paid && SAVE.meta.lande.rep === rep0 + k.rep;
      const tr = lNear(P.x, P.y, 300).find(n => n.k === 'npc' && n.role === 'trade'); LW.tnpc = tr; LW.offers.set(tr.op, [{ give: [{ t: 'gold', n: 50 }], get: { t: 'gem', k: 'rubin:1', n: 1 } }]); LW.pack = [{ t: 'gold', n: 60 }];
      ON.l_buyo(null, null, 0); o.trade = LW.pack.some(e => e.t === 'gem') && LW.pack.find(e => e.t === 'gold').n === 10;
      LW.t = LDAY * .75; LW.tick = 0; lTick(.016); o.night = LW.danger === 2 && bg.b.dark > .3; LW.t = LDAY * .2; LW.tick = 0; lTick(.016); o.day = LW.danger === 0;
      // Giftluft: ohne Kräutermaske tut es weh, mit nicht
      let R = null; for (let r = 60; r < 200 && !R; r += 2) for (let a = 0; a < 6.283 && !R; a += .05) { const c = lCell(Math.round(Math.cos(a) * r / LRC), Math.round(Math.sin(a) * r / LRC)); if (c.biome === 'giftmoor') R = c; }
      lResume(); const M = SAVE.meta.lande; M.tools = 0; lTeleport(R.sx * LCK + LOFF, R.sy * LCK + LOFF); CALM(); P.inv = 1e9; P.hp = P.st.hp; for (let i = 0; i < 10; i++) { LW.tick = 0; lTick(.2); } o.poison = P.hp < P.st.hp;
      M.tools = 4; P.hp = P.st.hp; for (let i = 0; i < 10; i++) { LW.tick = 0; lTick(.2); } o.mask = P.hp === P.st.hp; M.tools = 0;
      return o;
    }, [CALM.toString()]);
    ok(ms.mis && ms.done && ms.claim, 'Aufträge der Kundschafterin (mit Gerücht über das nächste Werkzeug): erfüllt, Belohnung und Ruf');
    ok(ms.trade, 'Händler: Tausch mit dem, was im Rucksack ist');
    ok(ms.night && ms.day, 'Tag und Nacht statt Zwangs-Ende: nachts dunkler und gefährlicher, morgens wieder Tag');
    ok(ms.poison && ms.mask, 'Giftluft im Giftmoor: ohne Kräutermaske Schaden, mit Maske nicht' + (ms.poison && ms.mask ? '' : ' ' + JSON.stringify(ms)));
    // Andere Teile (B, A, K, M): Schnittstellen werden aufgerufen, wenn es sie gibt
    const ot = await page.evaluate(([CALM_]) => {
      const CALM = eval('(' + CALM_ + ')'), o = {}, real = { boss: typeof bossSpawn === 'function', arte: typeof arteInChunk === 'function', enc: typeof encounterRoll === 'function', mod: typeof modRoll === 'function', egg: typeof eggForBiome === 'function' };
      const save = {}; for (const k of ['bossForLair', 'bossSpawn', 'bossLairReady', 'arteInChunk', 'artePickup', 'encounterRoll', 'encounterOpen', 'modRoll', 'modGive', 'eggForBiome']) save[k] = window[k];
      const log = []; ON.l_quitok && landeActive() && ON.l_quitok();
      window.bossForLair = (k, c) => { log.push('lair:' + k + ':' + c.stage); return 7; }; window.bossLairReady = () => true; window.bossSpawn = (id, x, y, op) => { log.push('spawn:' + id); return spawnEnemy('ogre', { x, y, boss: true, instant: true }); };
      window.arteInChunk = c => c.cx === 0 && c.cy === 0 ? [{ id: 42, x: 384 + 60, y: 372 }] : []; window.artePickup = id => log.push('arte:' + id);
      window.encounterRoll = c => c.cx === 3 && c.cy === 0 ? { key: 'test', x: 3 * LCK + 384, y: 384 } : null; window.encounterOpen = e => log.push('enc:' + e.key + ':' + typeof e.teleport);
      window.modRoll = (d, l) => 'glyphe:2'; window.modGive = (k, n) => { log.push('give:' + k + 'x' + n); return true; };
      window.eggForBiome = (b, d, l) => ({ sp: Object.keys(PET_SP)[0], tier: 0 });
      lBegin(); CALM(); P.inv = 1e9;
      const a = lNear(P.x, P.y, 200).find(x => x.k === 'arte'); o.arteObj = !!a; if (a) { P.x = a.x; P.y = a.y; LW.tick = 0; lTick(.2); }
      lTeleport(3 * LCK + LOFF + 384, LOFF + 384); CALM(); P.inv = 1e9; LW.tick = 0; lTick(.2);
      const lair = (() => { for (let r = 3; r < 40; r++) for (let a2 = 0; a2 < 6.283; a2 += .2) { const R = lCell(Math.round(Math.cos(a2) * r / 6 * 6 / LRC), Math.round(Math.sin(a2) * r / LRC)); if (R.dist > 5 && lF(R.rx, R.ry, 81) < .3 && R.ring === 0) return R; } return null; })();
      if (lair) { lTeleport(lair.sx * LCK + LOFF, lair.sy * LCK + LOFF + 100); CALM(); P.inv = 1e9; LW.tick = 0; lTick(.2); }
      o.egg = !!lEgg(2) && lEgg(2).sp === Object.keys(PET_SP)[0];
      o.mod = !!lMod(.1, 1); const r = lDeliver([{ t: 'mod', k: 'glyphe:2', n: 3 }]); o.give = log.includes('give:glyphe:2x3');
      o.log = log; o.lair = !!lair;
      for (const k in save) window[k] = save[k]; ON.l_quitok(); void real;
      return o;
    }, [CALM.toString()]);
    ok(ot.arteObj && ot.log.includes('arte:42'), 'Teil A: Artefakt-Fundstelle (arteInChunk) liegt in der Welt, Aufheben ruft artePickup');
    ok(ot.log.includes('enc:test:function'), 'Teil A: Begegnung (encounterRoll) öffnet encounterOpen mit enc.teleport');
    ok(!ot.lair || (ot.log.some(l => l.startsWith('lair:L')) && ot.log.includes('spawn:7')), 'Teil B: Hort fragt bossForLair und ruft bossSpawn');
    ok(ot.egg && ot.mod && ot.give, 'Teil K/M: eggForBiome für Eier, modRoll/modGive für Mods');
    // Mit den ECHTEN Teilen B (Bosse) und A (Artefakte), wenn sie geladen sind
    const xr = await page.evaluate(async ([CALM_, HERO_]) => {
      const CALM = eval('(' + CALM_ + ')'), o = { A: typeof arteInChunk === 'function' && typeof aChain === 'function' && typeof arteRumor === 'function', B: typeof bossSpawn === 'function' && typeof bossForLair === 'function' };
      if (landeActive()) ON.l_quitok();
      eval('(' + HERO_ + ')')();
      const c0 = landeCtx(40, -12); o.landmark = typeof c0.landmark === 'string' && c0.landmark.length > 0;
      SAVE.meta.lande.cps = [{ i: 0, x: 30 * 768, y: -12 * 768, t: 1, u: 1 }]; SAVE.meta.lande.cpn = 1;
      const bs = landeBeacons(); o.beacons = bs.length === 1 && bs[0].x === 30 * 768 && bs[0].y === -12 * 768 && /Leuchtfeuer 1/.test(bs[0].name);
      SAVE.meta.lande.cps = []; SAVE.meta.lande.cpn = 0;
      const at = (x, y) => { P.x = x; P.y = y; LW.tick = 0; lTick(.2); };
      if (o.A) {
        lBegin(); CALM(); P.inv = 1e9;
        // Elwa erzählt ein Gerücht über die nächste Spur (Suchkreis auf der Karte)
        const npc = lNear(P.x, P.y, 700).find(x => x.k === 'npc' && x.role === 'mis');
        lMisScreen(npc); o.rumor = /Gerücht über eine Spur/.test(panel.textContent) && /Man erzählt von/.test(panel.textContent); o.ru = SAVE.meta.arte.ru.length > 0 && arteHints().some(h => h.k === 'rumor'); lResume();
        // Artefakt: take() liest auf, die Fundstelle verschwindet
        const ch = arteRumor(0, 0).chain, C = aChain(ch), s0 = C.sites[0];
        lTeleport(s0.x + LOFF, s0.y + LOFF + 50); CALM(); P.inv = 1e9;
        const a = lNear(s0.x + LOFF, s0.y + LOFF, 60).find(x => x.k === 'arte' && x.s.id === s0.id); o.arteObj = !!a;
        if (a) { at(a.x, a.y); o.took = aHas(s0.id) && a.used && state === 'menu' && !lNear(a.x, a.y, 30).includes(a); lResume(); }
        // Schatz ohne Wächter: versiegelt bleibt er liegen und fragt erst nach dem Weggehen wieder; offen → Beute, Stelle weg
        const skip = []; let tc = -1; for (let k = 0; k < 40 && tc < 0; k++) { const r = arteRumor(0, 0, skip); if (!r) break; skip.push(r.chain); if (!aChain(r.chain).rw.guard) tc = r.chain; }
        if (tc >= 0) {
          const TC = aChain(tc), ts = TC.sites[TC.L];
          lTeleport(ts.x + LOFF, ts.y + LOFF + 60); CALM(); P.inv = 1e9;
          const t = lNear(ts.x + LOFF, ts.y + LOFF, 60).find(x => x.k === 'arteT' && x.s.chain === tc); o.trObj = !!t && !t.s.ready;
          if (t) {
            at(t.x, t.y); o.sealed = state === 'menu' && /VERSIEGELT/.test(panel.textContent) && lNear(t.x, t.y, 30).includes(t) && !aOpened(tc); lResume();
            at(t.x, t.y); o.noSpam = state === 'play';
            at(t.x, t.y + 80); at(t.x, t.y); o.again = state === 'menu'; lResume();
            for (let i = 0; i < TC.L; i++) artePickup(TC.sites[i].id, { quiet: true }); lArteReady(tc); o.ready = !!t.s.ready;
            CALM(); at(t.x, t.y + 80); const g0 = P.gold; at(t.x, t.y);
            o.opened = aOpened(tc) && !lNear(t.x, t.y, 30).includes(t) && state === 'menu' && P.gold > g0; lResume();
          }
        }
      }
      if (o.B) {
        // erster Sieg über einen Boss aus Teil B: Bauteile, Ei und Mods (direkt gutgeschrieben) kommen in den Rucksack, nicht nach Hause
        if (!landeActive()) lBegin(); lTeleport(LOFF + 384, LOFF + 420); CALM(); P.inv = 1e9; LW.pack = []; pickups.length = 0;
        SAVE.meta.pets.eggs = []; P.parts = {}; P.mods = {};
        const c = landeCtx(0, 0, 'Ltest'), id = bossForLair('Ltest', c), e = bossSpawn(id, P.x + 60, P.y, { ctx: c, lair: 'Ltest', stage: c.stage, instant: true, quiet: true });
        o.bossOk = !!e && e.bossId === id;
        if (e) {
          killEnemy(e, 1, 0);
          const n = t => LW.pack.filter(x => x.t === t).reduce((s, x) => s + (x.n || 1), 0);
          o.bPack = { part: n('part'), egg: pickups.filter(c => c.k === 'legg').length, mod: n('mod') };
          o.bHome = { parts: Object.values(P.parts).reduce((s, v) => s + v, 0), mods: Object.values(P.mods || {}).reduce((s, v) => s + v, 0), eggs: SAVE.meta.pets.eggs.length };
        }
        // tief draußen trägt die Welt-Stufe ihre Qual: Bosse aus B so stark wie die Gegner dort (Stufe heißt überall dasselbe)
        { const c2 = landeCtx(8000, 0, 'Lq'), id2 = bossForLair('Lq', c2), W2 = bossPower(bossDef(id2), c2.stage), e2 = bossSpawn(id2, P.x + 80, P.y, { ctx: c2, stage: c2.stage, instant: true, quiet: true }), k = Math.pow(1.3, worldQual(c2.stage));
          o.bossQual = !!e2 && c2.stage > 200 && Math.abs(e2.maxHp / W2.hp - k) < k * .01; if (e2) e2.dead = true; enemies = enemies.filter(x => !x.dead); $('bossbar').hidden = true; }
        // Wächter eines Schatzes (Teil A ruft Teil B): Stelle bleibt, bis der Wächter fällt – dann öffnet Teil A den Schatz selbst
        if (o.A) {
          const skip = []; let gc = -1; for (let k = 0; k < 60 && gc < 0; k++) { const r = arteRumor(0, 0, skip); if (!r) break; skip.push(r.chain); if (aChain(r.chain).rw.guard) gc = r.chain; }
          if (gc >= 0) {
            const GC = aChain(gc), gs = GC.sites[GC.L]; for (let i = 0; i < GC.L; i++) artePickup(GC.sites[i].id, { quiet: true });
            lTeleport(gs.x + LOFF, gs.y + LOFF + 60); CALM(); P.inv = 1e9;
            const t = lNear(gs.x + LOFF, gs.y + LOFF, 60).find(x => x.k === 'arteT' && x.s.chain === gc);
            if (t) {
              const n0 = enemies.length; at(t.x, t.y); const gd = enemies.slice(n0).find(x => x.boss);
              o.guard = !!gd && lNear(t.x, t.y, 30).includes(t) && !aOpened(gc);
              if (gd) { killEnemy(gd, 1, 0); await new Promise(r => setTimeout(r, 1500)); o.guardOpen = aOpened(gc); lResume(); CALM(); for (let i = 0; i < 6; i++) at(t.x, t.y + 80); o.guardGone = !lNear(t.x, t.y, 30).includes(t); }
            }
          }
        }
      }
      if (landeActive()) ON.l_quitok();
      return o;
    }, [CALM.toString(), HERO.toString()]);
    ok(xr.landmark && xr.beacons, 'landeCtx gibt das Wahrzeichen der Region (landmark), landeBeacons() die Leuchtfeuer mit Namen' + (xr.landmark && xr.beacons ? '' : ' ' + JSON.stringify(xr)));
    if (xr.A) {
      ok(xr.rumor && xr.ru, 'Teil A echt: Elwa erzählt ein Gerücht über die nächste Spur (arteRumor), Suchkreis auf der Karte');
      ok(xr.arteObj && xr.took, 'Teil A echt: Artefakt-Fundstelle in der Welt, take() liest auf, Stelle verschwindet' + (xr.arteObj && xr.took ? '' : ' ' + JSON.stringify(xr)));
      ok(xr.trObj && xr.sealed && xr.noSpam && xr.again, 'Teil A echt: versiegelter Schatz bleibt liegen (open() = false), fragt erst nach dem Weggehen wieder' + (xr.sealed && xr.noSpam && xr.again ? '' : ' ' + JSON.stringify(xr)));
      ok(xr.ready && xr.opened, 'Teil A echt: alle Artefakte gefunden → Siegel bricht, Schatz geöffnet, Stelle weg' + (xr.ready && xr.opened ? '' : ' ' + JSON.stringify(xr)));
    } else console.log('  (Teil A nicht geladen – übersprungen)');
    if (xr.B) {
      ok(xr.bossOk && xr.bPack && xr.bPack.part >= 2 && xr.bPack.egg >= 1 && xr.bPack.mod >= 1 && !xr.bHome.parts && !xr.bHome.mods && !xr.bHome.eggs, 'Teil B echt: erster Boss-Sieg – Bauteile und Mods im Rucksack, das Ei als Bodenbeute, nichts direkt daheim ' + JSON.stringify([xr.bPack, xr.bHome]));
      ok(xr.bossQual, 'Teil B echt: tief draußen (Stufe > 200) tragen Bosse die Qual der Welt-Stufe wie alle Gegner dort (worldQual)');
      if (xr.A) ok(xr.guard && xr.guardOpen && xr.guardGone, 'Teil A+B echt: Schatz-Wächter erscheint, Stelle bleibt; nach dem Sieg öffnet Teil A den Schatz, die Stelle verschwindet' + (xr.guard && xr.guardOpen && xr.guardGone ? '' : ' ' + JSON.stringify(xr)));
    } else console.log('  (Teil B nicht geladen – übersprungen)');
    // Spielstand nach 24 h Fußmarsch geradeaus: Karte und Regionen bleiben klein
    const sz = await page.evaluate(() => {
      const M = SAVE.meta.lande; M.map = {}; M.regs = []; LMAP = null; LREGS = null; lBegin(); const L = LW, t0 = performance.now();
      for (let x = 0; x < LWR * LCK; x += 192) { lRevealW(x, 384, 1); if (x % 768 === 0) { const R = lRegAtC(x / LCK, .5); L.regs.add(R.id); } if (x % (100 * LCK) === 0) lCommit(); }
      lCommit(); ON.l_quitok();
      return { kb: JSON.stringify(M).length / 1024, map: Object.keys(M.map).length, regs: M.regs.length, ms: performance.now() - t0, all: JSON.stringify(SAVE).length / 1024 };
    });
    console.log(`  Spielstand nach 24 h geradeaus: Lande ${sz.kb.toFixed(1)} KB (${sz.map} Kartenblöcke, ${sz.regs} Regionen), ganzer Spielstand ${sz.all.toFixed(1)} KB`);
    ok(sz.kb <= 200, `Speicher-Budget: ${sz.kb.toFixed(1)} KB ≤ 200 KB nach 24 h Fußmarsch`);
    ok(!errs.length, 'keine Fehler (Welt und Regeln)' + (errs.length ? ': ' + errs.slice(0, 3).join(' | ') : ''));
    await page.close();
  }
  // Durchlauf mit Antippen auf dem Handy, hoch und quer
  for (const [W, H] of [[390, 844], [844, 390]]) {
    console.log(`Endlose Lande – Antippen ${W}x${H}`);
    const ctx = await b.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: 'de-DE' });
    const page = await ctx.newPage();
    const errs = []; page.on('pageerror', e => errs.push(e.message)); page.on('console', m => { if (m.type() === 'error' && !/favicon|net::ERR/.test(m.text())) errs.push('console: ' + m.text()); });
    await page.goto(BASE + 'index.html'); await page.waitForTimeout(1500);
    await page.evaluate(STANDIN);
    await page.evaluate(([HERO_]) => { eval('(' + HERO_ + ')')('ranger', 12); SAVE.meta.pets.starter = true; petGive('eule', { nm: 'Hu', lv: 15 }); SAVE.meta.lande.cps = [{ i: 0, x: 30 * 768, y: -12 * 768, t: 1, u: 1 }]; SAVE.meta.lande.cpn = 1; saveChar(); persist(); }, [HERO.toString()]);
    const tap = async sel => { const el = page.locator(sel).first(); await el.scrollIntoViewIfNeeded().catch(() => { }); try { await el.tap({ timeout: 4000 }); } catch (e) { throw new Error('Antippen ' + sel + ': ' + e.message.split('\n')[0]); } await page.waitForTimeout(300); };
    const inView = async sel => { const el = page.locator(sel).first(); if (!(await el.count())) return false; const r = await el.boundingBox(); return !!r && r.y >= 0 && r.y + r.height <= H + 1 && r.x >= 0 && r.x + r.width <= W + 1; };
    const shot = async n => page.screenshot({ path: `${OUT}/${W}x${H}_${n}.png` });
    const pre = `${W}x${H}: `;
    const noScroll = () => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1 && panel.scrollWidth <= panel.clientWidth + 1);
    // Karte → Mehr → Endlose Lande
    await page.evaluate(() => { P.map = genMap(3); openMap(); });
    await tap('[data-act="mapmore"]'); await tap('[data-act="l_open"]');
    ok(await inView('[data-act="l_go"]'), pre + 'Weltentor von der Karte: „Betreten“ ohne Scrollen sichtbar');
    await shot('01_gate_map'); await tap('[data-act="l_back"]');
    // Versteck: zum Weltentor laufen und antippen
    await page.evaluate(() => { enterHideout(); const p = hidePos('weltentor'); P.x = p.x; P.y = p.y + 22; }); await page.waitForTimeout(700);
    ok(await page.locator('#bAct').isVisible(), pre + 'Versteck: Weltentor zum Interagieren');
    await page.locator('#bAct').tap(); await page.waitForTimeout(400);
    ok((await page.evaluate(() => (panel.querySelector('h2') || {}).textContent)) === 'WELTENTOR' && /WAS DU RISKIERST/.test(await page.evaluate(() => panel.textContent)) && await page.locator('[data-act="l_start"]').count() === 2, pre + 'Weltentor: Startpunkt (Tor oder Leuchtfeuer), Werkzeuge, „Was du riskierst“');
    ok(await noScroll(), pre + 'Weltentor: kein seitliches Scrollen');
    await shot('02_gate');
    await tap('[data-act="l_mapg"]');
    ok(await page.evaluate(() => !!$('lmapBig')) && await inView('[data-act="l_mz"][data-id="in"]'), pre + 'Karte der Lande vom Weltentor aus, Zoom-Knöpfe sichtbar');
    await shot('03_map_gate'); await tap('[data-act="l_gate"]');
    await tap('[data-act="l_start"][data-id="tor"]');
    await tap('[data-act="l_go"]'); await page.waitForTimeout(1400);
    ok(await page.evaluate(() => landeActive() && state === 'play'), pre + 'Betreten: Ausflug läuft');
    await page.evaluate(() => { LW.huntT = 1e9; LW.rivT = 1e9; P.inv = 1e9; });
    for (const id of ['#lhMap', '#lhPack', '#lhT', '#lhSt']) ok(await inView(id), pre + 'HUD sichtbar: ' + id);
    const over = await page.evaluate(() => { const a = $('lhud').getBoundingClientRect(), hit = (x, y) => x.left < y.right && x.right > y.left && x.top < y.bottom && x.bottom > y.top; return ['pauseBtn', 'bPot', 'bUlt', 'bAtk'].filter(id => hit(a, $(id).getBoundingClientRect())); });
    ok(!over.length, pre + 'HUD überdeckt weder Pause, Trank noch Knöpfe' + (over.length ? ': ' + over.join(', ') : ''));
    await page.waitForTimeout(1500); await shot('04_world');
    // Rucksack über das HUD
    await page.evaluate(() => { LW.pack.push({ t: 'item', it: lItem(2, 2) }, { t: 'gold', n: 120 }, { t: 'mat', k: 'erz', n: 6 }); });
    await page.locator('#lhPack').tap(); await page.waitForTimeout(400);
    ok(await page.evaluate(() => state === 'menu' && /RUCKSACK/.test(panel.textContent)), pre + 'Rucksack öffnet über das HUD');
    await tap('[data-act="l_sel"][data-id="p:0"]');
    ok(await inView('[data-act="l_tobag"]'), pre + 'Rucksack: „In die Begleiter-Tasche“ sichtbar');
    await shot('05_inv');
    await tap('[data-act="l_tobag"]');
    ok(await page.evaluate(() => lBag(LW.pet).length === 1 && LW.pack.length === 2), pre + 'Gegenstand liegt jetzt in der Begleiter-Tasche');
    await tap('[data-act="l_resume"]');
    // Karte groß über die Minikarte, zoomen
    await page.locator('#lhMap').tap(); await page.waitForTimeout(400);
    ok(await page.evaluate(() => !!$('lmapBig')), pre + 'Karte groß über die Minikarte');
    const z0 = await page.evaluate(() => LMV.z); await tap('[data-act="l_mz"][data-id="out"]'); await tap('[data-act="l_mz"][data-id="out"]');
    ok(await page.evaluate(z0 => LMV.z === z0 * 4, z0) && await noScroll(), pre + 'Karte: Zoom-Knöpfe, kein seitliches Scrollen');
    await shot('06_map'); await tap('[data-act="l_resume"]');
    // Kundschafterin: hinlaufen, Knopf, Aufträge
    await page.evaluate(() => { const o = lNear(P.x, P.y, 400).find(n => n.k === 'npc' && n.role === 'mis'); P.x = o.x + 18; P.y = o.y + 8; for (const e of enemies) e.dead = true; }); await page.waitForTimeout(700);
    ok(await page.locator('#bAct').isVisible(), pre + 'Kundschafterin: Knopf zum Interagieren');
    await page.locator('#bAct').tap(); await page.waitForTimeout(400);
    ok(await page.evaluate(() => LW.misOn && LW.mis.length >= 3 && /AUFTRÄGE/.test(panel.textContent)), pre + 'Aufträge angenommen');
    await shot('07_missions'); await tap('[data-act="l_resume"]');
    // Händler
    await page.evaluate(() => { const o = lNear(P.x, P.y, 400).find(n => n.k === 'npc' && n.role === 'trade'); P.x = o.x + 18; P.y = o.y + 8; }); await page.waitForTimeout(700);
    await page.locator('#bAct').tap(); await page.waitForTimeout(400);
    ok(await page.evaluate(() => /TAUSCH/.test(panel.textContent)), pre + 'Händler: Tauschangebote');
    await shot('08_trade'); await tap('[data-act="l_resume"]');
    // Leuchtfeuer setzen über das HUD
    await page.evaluate(() => { const [x, y] = lRoadPt(1, 8); lTeleport(x * LCK + LOFF, y * LCK + LOFF); LW.hurtT = -99; for (const e of enemies) e.dead = true; enemies = []; SAVE.meta.lande.stones = 2; }); await page.waitForTimeout(600);
    ok(await inView('#lhCp'), pre + 'HUD: Leuchtfeuer-Knopf sichtbar');
    await page.evaluate(() => { LW.hurtT = -99; for (const e of enemies) e.dead = true; enemies = []; LW.camps = null; for (const o of lNear(P.x, P.y, 400)) if (o.k === 'camp') o.state = 'done'; });
    await page.locator('#lhCp').tap(); await page.waitForTimeout(400);
    ok(await inView('[data-act="l_cpok"]') && /LEUCHTFEUER SETZEN/.test(await page.evaluate(() => panel.textContent)), pre + 'Leuchtfeuer: Erklärung und Knopf sichtbar');
    await shot('09_beacon');
    await page.evaluate(() => { LW.hurtT = -99; for (const e of enemies) e.dead = true; enemies = []; });
    await tap('[data-act="l_cpok"]');
    ok(await page.evaluate(() => SAVE.meta.lande.cps.length === 2 && state === 'play'), pre + 'Leuchtfeuer entzündet');
    await page.waitForTimeout(900); await shot('10_beacon_world');
    // Barriere ohne Werkzeug: Meldung
    await page.evaluate(() => { const c = lRoadCross(0, 0), [x, y] = lRoadPt(0, Math.hypot(c.px, c.py) - .25); lTeleport(x * LCK + LOFF, y * LCK + LOFF); SAVE.meta.lande.tools = 0; LW.hurtT = -99; for (const e of enemies) e.dead = true; enemies = []; lBlocked(c.px * LCK + LOFF, c.py * LCK + LOFF); });
    await page.waitForTimeout(700); await shot('11_barrier');
    ok(await page.evaluate(() => /Du brauchst/.test($('toast').textContent) && !!LW.hint), pre + 'Barriere: „Du brauchst: …“ und ein Pfeil zum nächsten Übergang');
    // Kampf an einem Lager (ein paar Sekunden echte Spielzeit)
    await page.evaluate(() => { for (let r = 1; r < 6; r++) { const c = lNear(P.x, P.y, 2000).find(o => o.k === 'camp' && o.state === 'dorm'); if (c) { P.x = c.x + 60; P.y = c.y; LW.lx = P.x; LW.ly = P.y; break; } lTeleport(P.x + 1500, P.y); } keys.Space = true; });
    await page.waitForTimeout(2500); await shot('12_fight'); await page.evaluate(() => { keys.Space = false; });
    // Pause: Abbrechen statt Hauptmenü
    await page.evaluate(() => showPause()); await page.waitForTimeout(300);
    ok(await page.locator('[data-act="l_quit"]').count() === 1 && await inView('[data-act="l_inv"]') && !(await page.locator('[data-act="title"]').count()), pre + 'Pause: Rucksack, Karte, Leuchtfeuer und „Ausflug abbrechen“ statt Hauptmenü');
    await shot('13_pause');
    await page.evaluate(() => { LW.hurtT = -99; for (const e of enemies) e.dead = true; enemies = []; });
    await tap('[data-act="l_quit"]'); await tap('[data-act="l_quitok"]');
    ok(await page.evaluate(() => G.type === 'versteck' && !landeActive() && P.bag.length >= 1), pre + 'Abbrechen: zurück im Versteck, Begleiter-Tasche geliefert');
    // Entkommen-Bildschirm
    await page.evaluate(() => { landeStart('tor'); }); await page.waitForTimeout(800);
    await page.evaluate(() => { for (let i = 0; i < 6; i++) LW.pack.push({ t: 'item', it: lItem(2, 3) }); LW.pack.push({ t: 'gold', n: 777 }); lExtract(lNear(P.x, P.y, 200).find(o => o.k === 'exit')); });
    await page.waitForTimeout(900);
    ok(await inView('[data-act="l_home"]'), pre + 'Entkommen: Liste der Beute, „Ins Versteck“ sichtbar');
    await shot('14_extract');
    await tap('[data-act="l_home"]');
    // Tod
    await page.evaluate(() => { landeStart('tor'); }); await page.waitForTimeout(800);
    await page.evaluate(() => { LW.pack.push({ t: 'item', it: lItem(3, 3) }); lBag(LW.pet).push({ t: 'item', it: lItem(3, 3) }); P.inv = 0; hurtPlayer(1e9, null); });
    await page.waitForTimeout(4500);
    ok(await page.evaluate(() => state === 'over') && await inView('[data-act="l_wake"]'), pre + 'Tod: Bildschirm mit Verlorenem und Gerettetem, Knopf sichtbar');
    await shot('15_death');
    await tap('[data-act="l_wake"]');
    ok(!errs.length, pre + 'keine Fehler' + (errs.length ? ': ' + errs.slice(0, 3).join(' | ') : ''));
    await ctx.close();
  }
  console.log('  Bilder: ' + OUT);
  await b.close();
  process.exit(fails.length ? 1 : 0);
})().catch(e => { console.log('  FAIL Abbruch: ' + e.message.split('\n')[0]); process.exit(1); });
