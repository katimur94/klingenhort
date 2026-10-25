// Begleiter (js/pets.js): Regeln, alte Spielstände, Kampf je Art und Stufe, Antippen auf dem Handy, Bilder.
// Aufruf: node pets.js [ausgabeordner]   (BASE = Adresse des Spiels, Bilder hoch und quer nach /tmp/kh-b/screens)
const { chromium } = require('playwright');
const fs = require('fs');
const BASE = (process.env.BASE || 'http://localhost:8777/').replace(/\/?$/, '/'), OUT = process.argv[2] || '/tmp/kh-b/screens';
const fails = [], ok = (c, msg) => { if (!c) fails.push(msg); console.log((c ? '  ok   ' : '  FAIL ') + msg); };

(async () => {
  fs.rmSync(OUT, { recursive: true, force: true }); fs.mkdirSync(OUT, { recursive: true });
  const b = await chromium.launch();
  const page = await b.newPage({ viewport: { width: 844, height: 390 }, locale: 'de-DE' });
  const errs = []; page.on('pageerror', e => errs.push(e.message)); page.on('console', m => { if (m.type() === 'error' && !/favicon|net::ERR/.test(m.text())) errs.push('console: ' + m.text()); });
  await page.goto(BASE + 'index.html'); await page.evaluate(() => localStorage.clear()); await page.reload(); await page.waitForTimeout(1500);
  console.log('Begleiter: Regeln');
  const r = await page.evaluate(() => {
    const o = {}, M = () => SAVE.meta.pets;
    o.fresh = M() && Array.isArray(M().list) && !M().list.length && !M().eggs.length && M().act === null && M().starter === false;
    // alte und kaputte Daten
    const m = fixMeta({ stats: {}, pets: { list: [{ sp: 'drache', lv: 999, xp: -5, col: 9 }, { sp: 'yeti', lv: 3 }, 'x', { sp: 'katze', id: 'a', nm: '<b>Mi</b>', lv: 7, xp: 1e12, col: 6 }], eggs: [{ sp: 'eule', need: 150, got: 400 }, { sp: '??' }], act: 'zzz' } });
    o.fix = m.pets.list.length === 2 && m.pets.list[0].lv === 100 && m.pets.list[0].xp === 0 && m.pets.list[1].nm.indexOf('<') < 0 && m.pets.list[1].col === 0 && m.pets.list[1].xp < petNeed(7) && m.pets.eggs.length === 1 && m.pets.eggs[0].got === 150 && m.pets.act === null;
    o.old = !!fixMeta({ stats: {} }).pets;
    // Kurve: schnell am Anfang, sehr lang am Ende
    let sum = 0; const tot = {}; for (let l = 1; l < 100; l++) { sum += petNeed(l); if (l === 9 || l === 24 || l === 49 || l === 99) tot[l + 1] = sum; }
    o.tot = tot; o.need1 = petNeed(1); let mono = true; for (let l = 2; l < 100; l++) if (petNeed(l) <= petNeed(l - 1)) mono = false; o.mono = mono;
    // Spielzeit aus den echten Wellen: Räume bis LV 10 / 25 / 100 (Geschichte: 7 Räume je Akt, Qual: ein Akt alle 40 Räume bis Akt 40; 80 % Kampfräume, ~1 Min. je Raum)
    const c = newChar('knight', 'Test', 'normal', false); SAVE.chars.push(c); activateChar(0);
    const xpR = {}; for (let act = 1; act <= 40; act++) for (let row = 0; row < 7; row++) { P.act = act; G = { row, lootMul: 1 }; const st = stageNum(), S = scaleOf(st), base = 4 + st * 1.4; let xp = 0; for (let k = 0; k < 4; k++) for (let w = 0; w < Math.min(4, 2 + Math.floor(st / 6)); w++) for (const e of buildWave(st, base + w * 1.3)) xp += EN[e].xp * S.rm * 1.15 / 4; if (row === 6) xp += 60 * S.rm * 8; xpR[act * 10 + row] = xp * .8; }
    let pxp = 0, lv = 1, rooms = 0; const at = {};
    while (lv < 100 && rooms < 60000) { const act = rooms < 56 ? 1 + Math.floor(rooms / 7) : Math.min(40, 9 + Math.floor((rooms - 56) / 40)); pxp += xpR[act * 10 + rooms % 7] * .5; rooms++; while (lv < 100 && pxp >= petNeed(lv)) { pxp -= petNeed(lv); lv++; if (lv === 10 || lv === 25 || lv === 50 || lv === 100) at[lv] = rooms; } }
    o.rooms = at;
    o.stage = [1, 9, 10, 24, 25, 49, 50, 74, 75, 99, 100].map(petStage).join('');
    // Bilder werden mit jeder Stufe größer
    o.grow = PSPORDER.every(sp => { let a = 0; for (let s = 0; s < 6; s++) { const S = petStrip(sp, s, 0, false), v = S.W * S.H; if (v <= a) return false; a = v; } return true; });
    o.vars = PSPORDER.every(sp => petVariants(sp).length === 6 && new Set(petVariants(sp).map(v => v.n)).size === 6);
    o.shinyStrip = !!petStrip('katze', 2, 6, true).c;
    // EP aus Siegen, Entwicklung, Farben
    M().starter = true; const p = petGive('drache', {}); o.give = !!p && M().act === p.id && p.lv === 1;
    petKill({ xp: 40, x: 0, y: 0 }); o.killxp = p.lv > 1 || p.xp === 20;
    p.lv = 9; p.xp = petNeed(9) - 1; petKill({ xp: 4, x: 0, y: 0 }); o.evo = p.lv === 10 && petStage(p.lv) === 1 && petCols(p).length === 2;
    // Passiv ab LV 25 über HOOK.stats
    computeStats(); const d0 = P.st.m.dmg || 0; p.lv = 25; computeStats(); const d25 = P.st.m.dmg || 0; p.lv = 100; computeStats(); const d100 = P.st.m.dmg || 0;
    o.pas = Math.abs(d0) < 1e-9 && Math.abs(d25 - .03) < 1e-6 && Math.abs(d100 - .15) < 1e-6;
    M().act = null; computeStats(); o.noPas = !(P.st.m.dmg > 0); M().act = p.id;
    // Beutemagnet ab LV 10
    G = { type: 'kampf', phase: 'fight', row: 0 }; setState('play'); P.x = 200; P.y = 200; PET.id = null;
    const coin = (d) => ({ k: 'coin', x: 200 + d, y: 200, z: 0, vz: 0, vx: 0, vy: 0, v: 1, t: 1 });
    p.lv = 5; pickups = [coin(60)]; petTick(.016); o.mag5 = !pickups[0].mag;
    p.lv = 10; pickups = [coin(60), coin(120)]; petTick(.016); o.mag10 = !!pickups[0].mag && !pickups[1].mag;
    p.lv = 100; pickups = [coin(180)]; petTick(.016); o.mag100 = !!pickups[0].mag;
    pickups = []; setState('menu');
    // Füttern (Leibspeise doppelt)
    p.lv = 30; p.xp = 0; P.mats.glut = 10; petView = p.id; petAmt = 10; ON.petfeed('glut'); o.feed = P.mats.glut === 0 && (p.xp === PFEED.glut * 20 || p.lv > 30);
    // Eier: Brutnest, Schlüpfen nach 150 Siegen, voll
    M().eggs = []; o.egg = eggGive('eule', true) && M().eggs.length === 1;
    const n0 = M().list.length; for (let i = 0; i < 150; i++) petKill({ xp: 1, x: 0, y: 0 }); o.hatch = M().list.length === n0 + 1 && !M().eggs.length && M().list[M().list.length - 1].sp === 'eule' && !!M().list[M().list.length - 1].nw;
    for (let i = 0; i < 6; i++) eggGive(null, true); o.eggMax = M().eggs.length === EMAX && !eggGive('funke', true);
    // schillernd (1 %) und Boss-Ei (3 %)
    const R = Math.random; M().eggs = [{ sp: 'funke', need: 1, got: 1 }]; Math.random = () => .005; const sh = eggHatch(0, true); Math.random = R; o.shiny = !!sh && sh.shiny && sh.col === 6 && petCols(sh).includes(6);
    P.act = 9; M().eggs = []; Math.random = () => .04; petKill({ xp: 1, x: 0, y: 0, boss: true }); Math.random = R; o.bossEgg = M().eggs.length === 1;
    M().eggs = []; Math.random = () => .06; petKill({ xp: 1, x: 0, y: 0, boss: true }); Math.random = R; o.bossNoEgg = M().eggs.length === 0;
    // Tausch: Export entfernt, Import fügt hinzu (neue id), Eier, Fehler
    const cnt = M().list.length, d = petExport(0), id0 = d && M().list.every(x => x.sp !== 'drache' || x.lv !== 100);
    o.exp = !!d && d.sp === 'drache' && M().list.length === cnt - 1 && id0 && !!petLabel(d) && petIconURL(d).startsWith('data:image');
    o.imp = petImport(d) && M().list.length === cnt && M().list[M().list.length - 1].lv === d.lv;
    o.impBad = !petImport({ sp: 'yeti' }) && !petImport(null) && !petImport('x');
    eggGive('natter', true); const ed = eggExport(0); o.eggTrade = !!ed && ed.egg && !M().eggs.length && petImport(ed) && M().eggs.length === 1;
    while (M().list.length < PMAX) petGive('funke', {}); o.full = !petGive('drache', {}) && !petImport({ sp: 'katze', lv: 3 }) && petFree() === 0;
    // Laden und Speichern
    persist(); const saved = JSON.parse(localStorage.getItem(SAVE_KEY)); o.saved = saved.meta.pets.list.length === PMAX && saved.meta.pets.eggs.length === 1;
    return o;
  });
  ok(r.fresh, 'neues Konto: leere Begleiter-Daten');
  ok(r.old, 'alter Spielstand ohne Begleiter bekommt die Felder');
  ok(r.fix, 'kaputte Begleiter-Daten werden repariert (Level, EP, Farbe, Name, unbekannte Art)');
  ok(r.mono && r.need1 <= 30, `EP-Kurve steigt stetig, LV 2 nach ${r.need1} EP`);
  ok(r.tot[10] > 3e4 && r.tot[10] < 15e4 && r.tot[25] > 1e6 && r.tot[100] > 2e8, `EP gesamt: LV 10 ${r.tot[10]}, LV 25 ${r.tot[25]}, LV 50 ${r.tot[50]}, LV 100 ${r.tot[100]}`);
  ok(r.rooms[10] >= 25 && r.rooms[10] <= 70, `Räume bis LV 10: ${r.rooms[10]} (etwa eine Stunde)`);
  ok(r.rooms[25] >= 200 && r.rooms[25] <= 700, `Räume bis LV 25: ${r.rooms[25]} (etwa ein Spieltag)`);
  ok(!r.rooms[100] || r.rooms[100] > 8000, `Räume bis LV 50: ${r.rooms[50]}, bis LV 100: ${r.rooms[100] || 'über 60000'} (Hunderte Stunden)`);
  ok(r.stage === '00112233445', 'Entwicklungsstufen bei LV 10, 25, 50, 75, 100');
  ok(r.grow, 'jede Art wird mit jeder Stufe größer');
  ok(r.vars && r.shinyStrip, 'sechs Farben je Art und schillernde Variante');
  ok(r.give && r.killxp, 'Begleiter bekommt die Hälfte der Gegner-EP');
  ok(r.evo, 'LV 10: Entwicklung zu „Jung“ und eine neue Farbe');
  ok(r.pas && r.noPas, 'Passiv ab LV 25 (Glutherz +3 % → +15 % Schaden), ohne Begleiter nichts');
  ok(r.mag5 && r.mag10 && r.mag100, 'Beutemagnet ab LV 10, Reichweite wächst');
  ok(r.feed, 'Füttern verbraucht Material und gibt EP (Leibspeise doppelt)');
  ok(r.egg && r.hatch && r.eggMax, 'Eier schlüpfen nach 150 Siegen, Brutnest fasst 6');
  ok(r.shiny, 'schillernde Begleiter (1 %) mit eigener Farbe');
  ok(r.bossEgg && r.bossNoEgg, 'Boss-Ei: 5 % in der Qual');
  ok(r.exp && r.imp && r.impBad && r.eggTrade, 'Tausch: petExport/petImport/eggExport/eggGive');
  ok(r.full && r.saved, 'höchstens 12 Begleiter, alles wird gespeichert');

  // Kampf: jede Art auf jeder Stufe, Spezialangriffe, Versteck, ohne Begleiter
  console.log('Begleiter: Kampf');
  const k = await page.evaluate(() => {
    const res = {}, M = SAVE.meta.pets; let spec = 0; const os = petSpecial; petSpecial = function (...a) { spec++; return os(...a); };
    for (const sp of PSPORDER) for (const lv of [1, 12, 30, 55, 80, 100]) {
      M.list = []; M.act = null; const p = petGive(sp, { lv }); P.lv = 30; computeStats();
      startRoom('kampf', 2); G.waves = []; G.phase = 'fight'; G.pending = []; enemies = []; P.inv = 999;
      for (let i = 0; i < 4; i++) { const e = spawnEnemy('orc', { x: P.x + 40 + i * 12, y: P.y + (i % 2 ? 14 : -14), instant: true }); e.hp = e.maxHp = 1e6; e.spd = 0; e.atk = 0; }
      spec = 0; for (let f = 0; f < 60 * 25; f++) update(1 / 60);
      const lost = enemies.reduce((s, e) => s + e.maxHp - e.hp, 0);
      res[sp + lv] = { dmg: lost > 0, spec, inBD: PET.x >= BD.x0 && PET.x <= BD.x1 && PET.y >= BD.y0 && PET.y <= BD.y1 };
    }
    petSpecial = os;
    // Versteck: Begleiter streunt herum und bleibt im Bild
    M.list = []; M.act = null; petGive('katze', { lv: 40 }); leaveHideout; enterHideout(); hideOverlay(); setState('play'); const pos = [];
    for (let f = 0; f < 60 * 20; f++) { update(1 / 60); if (f % 60 === 0) pos.push([PET.x, PET.y]); }
    res.hideMove = pos.some(([x, y]) => Math.hypot(x - pos[0][0], y - pos[0][1]) > 8) && PET.x >= BD.x0 && PET.x <= BD.x1;
    // ohne Begleiter: Raum, Versteck, Charakter
    M.act = null; startRoom('kampf', 1); for (let f = 0; f < 120; f++) update(1 / 60); enterHideout(); for (let f = 0; f < 60; f++) update(1 / 60);
    openChar('pet'); res.noPet = !!panel.querySelector('.petcard'); M.list = []; openChar('pet'); res.noPetList = panel.textContent.includes('niemand');
    return res;
  });
  for (const sp of ['drache', 'katze', 'kaefer', 'eule', 'natter', 'funke']) {
    ok([1, 12, 30, 55, 80, 100].every(lv => k[sp + lv].dmg && k[sp + lv].inBD), `${sp}: greift auf allen Stufen an und bleibt in der Arena`);
    ok(k[sp + 1].spec === 0 && k[sp + 30].spec === 0 && k[sp + 55].spec > 0 && k[sp + 100].spec >= k[sp + 55].spec, `${sp}: Spezialangriff ab LV 50 (${k[sp + 55].spec}× / ${k[sp + 100].spec}× in 25 s)`);
  }
  ok(k.hideMove, 'Versteck: Begleiter streunt herum');
  ok(k.noPet && k.noPetList, 'ohne aktiven Begleiter: Raum, Versteck und Reiter laufen');
  ok(!errs.length, 'keine Fehler (Regeln, Kampf)' + (errs.length ? ': ' + errs.slice(0, 3).join(' | ') : ''));
  await page.close();

  // Alter Spielstand: Auswahl-Dialog im Titelmenü
  console.log('Begleiter: alter Spielstand');
  {
    const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, locale: 'de-DE', deviceScaleFactor: 2 });
    const pg = await ctx.newPage(); const e2 = []; pg.on('pageerror', e => e2.push(e.message));
    await pg.goto(BASE + 'index.html'); await pg.waitForTimeout(800);
    await pg.evaluate(() => { localStorage.clear(); const c = newChar('rogue', 'Altheld', 'normal', false); c.lv = 18; c.act = 3; const s = { v: 3, chars: [c], active: 0, meta: { stats: {}, ach: {}, bestiary: {}, settings: { music: true, sfx: true }, seenVer: VERSION } }; localStorage.setItem(SAVE_KEY, JSON.stringify(s)); });
    await pg.reload(); await pg.waitForTimeout(1500);
    ok(await pg.locator('.petstart').count() === 1, 'alter Spielstand: Begleiter-Auswahl im Titelmenü');
    await pg.screenshot({ path: `${OUT}/01_starter_hoch.png` });
    await pg.locator('[data-act="petpick"][data-id="kaefer"]').tap(); await pg.waitForTimeout(250);
    await pg.locator('[data-act="dlgnext"]').tap(); await pg.waitForTimeout(400);
    const s = await pg.evaluate(() => ({ st: SAVE.meta.pets.starter, sp: petActive() && petActive().sp, title: !!panel.querySelector('.logo'), btn: !!panel.querySelector('[data-act="petstart"]') }));
    ok(s.st && s.sp === 'kaefer' && s.title && !s.btn, 'Goldkäfer gewählt, zurück im Titel, kein Hinweis mehr');
    await pg.screenshot({ path: `${OUT}/02_title_with_pet.png` });
    // nach einem Update kommen erst die Neuigkeiten, danach die Auswahl
    await pg.evaluate(() => { const s = JSON.parse(localStorage.getItem(SAVE_KEY)); s.meta.pets = undefined; s.meta.seenVer = '4.0.1'; localStorage.setItem(SAVE_KEY, JSON.stringify(s)); });
    await pg.reload(); await pg.waitForTimeout(1500);
    ok(await pg.locator('details.news').count() > 0 && !(await pg.locator('.petstart').count()), 'nach dem Update: zuerst die Neuigkeiten');
    await pg.locator('[data-act="newsback"]').first().tap(); await pg.waitForTimeout(500);
    ok(await pg.locator('.petstart').count() === 1, 'danach die Begleiter-Auswahl');
    await pg.locator('[data-act="dlgnext"]').tap(); await pg.waitForTimeout(400);
    ok(await pg.evaluate(() => SAVE.meta.pets.starter && petActive().sp === 'drache' && !!panel.querySelector('.logo')), 'Glutdrache (Vorauswahl) gewählt');
    ok(!e2.length, 'keine Fehler (alter Spielstand)' + (e2.length ? ': ' + e2.slice(0, 3).join(' | ') : ''));
    await ctx.close();
  }

  // Handy: neuer Held → Auswahl nach dem Prolog → Kampf, Reiter BEGLEITER antippen, Bilder
  for (const [W, H, tag] of [[390, 844, 'hoch'], [844, 390, 'quer']]) {
    console.log(`Begleiter: Handy ${W}x${H}`);
    const ctx = await b.newContext({ viewport: { width: W, height: H }, isMobile: true, hasTouch: true, locale: 'de-DE', deviceScaleFactor: 2 });
    const pg = await ctx.newPage(); const e3 = []; pg.on('pageerror', e => e3.push(e.message)); pg.on('console', m => { if (m.type() === 'error' && !/favicon|net::ERR/.test(m.text())) e3.push('console: ' + m.text()); });
    await pg.goto(BASE + 'index.html'); await pg.evaluate(() => localStorage.clear()); await pg.reload(); await pg.waitForTimeout(1500);
    const tap = async (sel, wait) => { const el = pg.locator(sel).first(); await el.scrollIntoViewIfNeeded().catch(() => { }); await el.tap({ timeout: 4000 }); await pg.waitForTimeout(wait || 250); };
    const inView = async sel => { const el = pg.locator(sel).first(); if (!(await el.count())) return false; const r = await el.boundingBox(); return !!r && r.y >= 0 && r.y + r.height <= H + 1 && r.x >= 0 && r.x + r.width <= W + 1; };
    const shot = async (name, fn, wait) => { if (fn) await pg.evaluate(fn); await pg.waitForTimeout(wait || 400); await pg.screenshot({ path: `${OUT}/${name}_${tag}.png` }); };
    await tap('[data-act="new"]'); await tap('[data-act="cstart"]');
    let sawStarter = false;
    for (let i = 0; i < 15 && await pg.locator('[data-act="dlgnext"]').count(); i++) {
      if (await pg.locator('.petstart').count()) { sawStarter = true; await shot('03_starter_nach_prolog'); ok(await inView('.petstart [data-act="dlgnext"]'), 'Auswahl: Bestätigen ohne Scrollen sichtbar'); await tap('[data-act="petpick"][data-id="katze"]'); }
      await tap('[data-act="dlgnext"]');
    }
    ok(sawStarter, 'neuer Held: Begleiter-Auswahl direkt nach dem Prolog');
    ok((await pg.evaluate(() => state)) === 'map' && (await pg.evaluate(() => petActive() && petActive().sp)) === 'katze', 'Geisterkatze begleitet den Helden, zurück auf der Karte');
    // Kampf
    await pg.evaluate(() => { hideOverlay(); startRoom('kampf', 0); P.inv = 999; });
    await pg.waitForTimeout(3200); await shot('04_kampf_katze_baby');
    let hit = false; for (let i = 0; i < 20 && !hit; i++) { hit = await pg.evaluate(() => enemies.some(e => e.hp < e.maxHp) || G.kills > 0); if (!hit) await pg.waitForTimeout(400); }
    ok(hit, 'Kampf: die Geisterkatze greift an');
    // Reiter BEGLEITER mit mehreren Begleitern und Eiern
    await pg.evaluate(() => {
      const M = SAVE.meta.pets; M.list[0].lv = 27; M.list[0].xp = 1234; M.list[0].k = 321; M.list[0].nm = 'Mimi';
      petGive('drache', { lv: 63, col: 2 }); petGive('eule', { lv: 100, shiny: true }); petGive('natter', { lv: 8, col: 4 }); petGive('funke', { lv: 77 }); petGive('kaefer', { lv: 12, nw: 1 });
      M.eggs = [{ sp: 'drache', need: 150, got: 40 }, { sp: 'funke', need: 150, got: 120 }, { sp: 'natter', need: 150, got: 150 }];
      for (const k of MATORDER) P.mats[k] = 25; setState('play'); showPause(); openChar('gear', 'pause');
    });
    await tap('[data-act="ctab"][data-id="pet"]');
    ok(await pg.locator('.petcard').count() === 1, 'Reiter BEGLEITER geöffnet');
    await shot('05_reiter');
    ok(await inView('.petprev'), 'Vorschau ohne Scrollen sichtbar');
    // Füttern ×10 Leibspeise
    const xp0 = await pg.evaluate(() => petViewed().xp + petViewed().lv * 1e9);
    await tap('[data-act="petamt"][data-i="10"]'); await tap('[data-act="petfeed"][data-id="kristall"]');
    ok(await pg.evaluate(x0 => petViewed().xp + petViewed().lv * 1e9 > x0 && P.mats.kristall === 15, xp0), 'Füttern per Antippen');
    // Umbenennen
    await tap('[data-act="petren"]'); await pg.locator('#petnm').fill('Schnurri'); await tap('[data-act="petrenok"]');
    ok(await pg.evaluate(() => petViewed().nm === 'Schnurri' && panel.querySelector('.petnm').textContent.includes('Schnurri')), 'Umbenennen');
    // Farbe (Stark: 3 Farben frei)
    await tap('[data-act="petcol"]:not([disabled]):not(.sel)');
    ok(await pg.evaluate(() => petViewed().col !== petViewed().c0), 'Farbe wechseln');
    await shot('06_reiter_farbe');
    // anderen Begleiter ansehen und mitnehmen
    await tap('[data-act="petsel"][data-id="' + await pg.evaluate(() => SAVE.meta.pets.list[1].id) + '"]');
    await shot('07_reiter_drache', () => { panel.scrollTop = 0; });
    await tap('.petcard [data-act="petact"]');
    ok(await pg.evaluate(() => petActive().sp === 'drache'), 'Glutdrache mitnehmen');
    await tap('[data-act="petsel"][data-id="' + await pg.evaluate(() => SAVE.meta.pets.list[2].id) + '"]');
    await shot('08_reiter_mythisch', () => { panel.scrollTop = 0; });
    await shot('09_reiter_unten', () => { panel.scrollTop = 99999; });
    // Ei schlüpfen lassen
    const n0 = await pg.evaluate(() => SAVE.meta.pets.list.length);
    await tap('[data-act="pethatch"]');
    ok(await pg.evaluate(n => SAVE.meta.pets.list.length === n + 1 && SAVE.meta.pets.eggs.length === 2, n0), 'Ei schlüpfen lassen');
    // Freilassen mit Nachfrage
    await tap('.petcard [data-act="petrel"]'); await tap('[data-act="petrelok"]');
    ok(await pg.evaluate(n => SAVE.meta.pets.list.length === n, n0), 'Freilassen mit Nachfrage');
    await tap('[data-act="cback"]');
    // Kämpfe: Bilder je Art und Stufe
    const fights = [['drache', 63, 'kampf'], ['eule', 100, 'kampf'], ['funke', 80, 'elite'], ['natter', 52, 'kampf'], ['kaefer', 26, 'dunkel'], ['katze', 100, 'boss']];
    for (const [sp, lv, room] of fights) {
      await pg.evaluate(([sp, lv, room]) => { hideOverlay(); setState('play'); const M = SAVE.meta.pets; let p = M.list.find(x => x.sp === sp); if (!p) p = petGive(sp, {}); p.lv = lv; M.act = p.id; computeStats(); P.lv = 40; computeStats(); P.hp = P.st.hp; P.inv = 999; startRoom(room, room === 'boss' ? 6 : 3); P.inv = 999; }, [sp, lv, room]);
      await pg.waitForTimeout(room === 'boss' ? 4500 : 3600); await shot(`10_kampf_${sp}_${lv}`);
    }
    await shot('11_versteck', () => { SAVE.meta.hide.intro = true; enterHideout(); }, 2500);
    ok(!e3.length, 'keine Fehler auf dem Handy' + (e3.length ? ': ' + e3.slice(0, 3).join(' | ') : ''));
    await ctx.close();
  }
  console.log('  Bilder: ' + OUT);
  await b.close();
  process.exit(fails.length ? 1 : 0);
})().catch(e => { console.log('  FAIL Abbruch: ' + e.message.split('\n')[0]); process.exit(1); });
