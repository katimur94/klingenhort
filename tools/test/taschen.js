// Taschen & Vögel (6.2 „Sammeln & Bauen“, Teil T). Aufruf: node taschen.js [bildordner]   (BASE = Adresse des Spiels)
// Prüft: Größen nach Sattlerei (Beutel 30 … 90, Rucksack 20 … 40 + Ruf, Begleiter-Taschen + Stufe/2), Schatzkammer-Tabelle bis 400,
// kein festes „30“ mehr im Code; Sammelbeutel der Lande (Gold, Material, Edelsteine, Bauteile, Mods ohne Platz, heim beim Entkommen,
// weg bei Tod und Abbruch, alter Rucksack mit Stapeln); Magische Vögel (heimschicken, Plätze je Art, nicht im Kampf, Voliere je Stufe,
// Fund und Händler, alte Spielstände ohne P.birds); Lager beim Händler, im Basar und an der Werkbank (verkaufen, aufwerten,
// zerlegen, verschmelzen, nichts doppelt). Fotos hoch, quer und PC: Beutel 90, Lager 400, Rucksack mit Sammelbeutel, Vogel schicken, Voliere.
// Läuft auch ohne Teil B (Sattlerei, Voliere, Feder/Holz/Fasern): dann mit kleinen Ersatz-Einträgen.
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
const OUT = process.argv[2] || '/tmp/klingenhort-test/taschen';
const BASE = (process.env.BASE || 'http://localhost:8777/').replace(/\/?$/, '/');
const fails = [], ok = (c, msg) => { if (!c) fails.push(msg); console.log((c ? '  ok   ' : '  FAIL ') + msg); };
const HERO = (cls, lv) => {
  localStorage.clear(); loadAll();
  const c = newChar(cls || 'knight', 'Taschenträger', 'normal', false); c.lv = lv || 30; c.act = 4; c.maxAct = 4; c.story = { a1: 1, a2: 1, a3: 1 };
  SAVE.chars.push(c); activateChar(0); SAVE.meta.hide.intro = true; SAVE.meta.lande.tips = 0xffff; for (const a of ACH) SAVE.meta.ach[a.id] = 1;
  P.gear.weapon = makeItem({ slot: 'weapon', base: CLASSES[P.cls].start, tier: 2, rar: 3 }); computeStats(); P.hp = P.st.hp; saveChar();
};
// Ersatz für Teil B (Gebäude Voliere, Federn/Holz/Fasern), falls es (noch) fehlt
const SHIM = () => {
  const o = [];
  if (!BUILD.voliere) { BUILD.voliere = { n: 'Voliere', icon: 'bau', lv: [{ gold: 100 }, { gold: 200 }, { gold: 300 }, { gold: 400 }, { gold: 500 }], d: ['Vogelhaus', 'Spatzen', 'Tauben', 'Raben', 'Eulen', 'Phönixfedern'] }; o.push('voliere'); }
  for (const k of ['feder', 'holz', 'faser']) if (!MATS[k]) { MATS[k] = { n: { feder: 'Feder', holz: 'Holz', faser: 'Pflanzenfaser' }[k], c: '#c8a050', c2: '#8a6a30' }; o.push(k); }
  return o.length ? 'Ersatz: ' + o.join(', ') : 'echt';
};
const CALM = () => { LW.huntT = 1e9; LW.rivT = 1e9; for (const e of enemies) e.dead = true; enemies = []; LW.hurtT = -99; };

(async () => {
  fs.rmSync(OUT, { recursive: true, force: true }); fs.mkdirSync(OUT, { recursive: true });
  console.log('Taschen & Vögel – Code');
  // kein festes 30 als Beutelgrenze mehr (alle Skripte außer den Übersetzungen)
  {
    const dir = path.join(__dirname, '../../js'), bad = [], re = /bag\.length[^;]{0,14}\b30\b|\b30\b[^;]{0,10}bag\.length|\{n\}\/30|30\/30|MK_BAG\s*=\s*30/;
    for (const f of fs.readdirSync(dir).filter(f => f.endsWith('.js'))) fs.readFileSync(path.join(dir, f), 'utf8').split('\n').forEach((l, i) => { if (re.test(l)) bad.push(f + ':' + (i + 1)); });
    ok(!bad.length, 'Kein festes „30“ als Beutelgrenze mehr im Code (bagCap())' + (bad.length ? ': ' + bad.join(', ') : ''));
  }
  const b = await chromium.launch();
  console.log('Taschen & Vögel – Regeln');
  {
    const page = await b.newPage({ viewport: { width: 844, height: 390 }, locale: 'de-DE' });
    const errs = []; page.on('pageerror', e => errs.push(e.message + ' @ ' + ((e.stack || '').split('\n')[1] || '').trim()));
    await page.goto(BASE + 'index.html'); await page.waitForTimeout(1500);
    console.log('  Teil B: ' + await page.evaluate(SHIM));
    await page.evaluate(([H]) => eval('(' + H + ')')('knight', 30), [HERO.toString()]);

    /* ---------- Größen ---------- */
    const cap = await page.evaluate(() => {
      const o = {}, H = SAVE.meta.hide; SAVE.meta.pets.starter = true; const p = petGive('drache', { nm: 'Funki', lv: 20 }); SAVE.meta.pets.act = p.id;
      const at = lv => { H.b.sattler = lv; return [bagCap(), packCap(), petBagSize(p)]; };
      const r0 = at(0), r5 = at(5), r10 = at(10), r99 = at(99); H.b.sattler = 0;
      o.s0 = r0[0] === 30 && r0[1] === 20; o.s5 = r5[0] === 60 && r5[1] === 30 && r5[2] === r0[2] + 2; o.s10 = r10[0] === 90 && r10[1] === 40 && r10[2] === r0[2] + 5; o.clamp = r99[0] === 90 && r99[1] === 40;
      o.r = [r0, r5, r10, r99];
      SAVE.meta.lande.rep = 999999; H.b.sattler = 10; o.perk = packCap() === 40 + lPerk('pack') && lPerk('pack') === 2; SAVE.meta.lande.rep = 0; H.b.sattler = 0;
      const T = [0, 12, 24, 36, 48, 60, 80, 100, 125, 150, 180, 210, 250, 300, 350, 400]; o.stash = T.every((v, lv) => { H.b.lager = lv; return stashCap() === v; }); H.b.lager = 20; o.stashMax = stashCap() === 400; H.b.lager = 0;
      // Beutel füllt sich bis bagCap, danach wird verkauft (wie bisher bei 30)
      H.b.sattler = 10; P.bag = []; for (let i = 0; i < 89; i++) P.bag.push(makeItem({ slot: 'helm', tier: 0, rar: 0 })); const g0 = P.gold; addToBag(makeItem({ slot: 'helm', tier: 0, rar: 0 })); o.bag90 = P.bag.length === 90 && P.gold === g0;
      const g1 = addToBag(makeItem({ slot: 'helm', tier: 1, rar: 1 })); o.sold = P.bag.length === 90 && g1 > 0 && P.gold === g0 + g1;
      H.b.sattler = 0; o.bag30 = (() => { const n0 = P.bag.length, g = P.gold, r = addToBag(makeItem({ slot: 'helm', tier: 0, rar: 0 })); return r > 0 && P.bag.length === n0 && P.gold === g + r; })();
      // Basar und Tausch prüfen dieselbe Grenze
      H.b.sattler = 4; P.bag = P.bag.slice(0, 50); o.room = MK_HERO.room() === true && P.bag.length < bagCap(); while (P.bag.length < 54) P.bag.push(makeItem({ slot: 'helm', tier: 0, rar: 0 })); o.full = trAccept({ id: 'x' + Date.now(), t: 'i', d: {} }) === 'bag' && /54\/54/.test(trErr('bag'));
      P.bag = []; H.b.sattler = 0; saveChar(); return o;
    });
    ok(cap.s0 && cap.s5 && cap.s10 && cap.clamp, 'Sattlerei 0/5/10: Beutel 30/60/90, Rucksack 20/30/40, Begleiter-Tasche +0/+2/+5 (über 10 gedeckelt) ' + JSON.stringify(cap.r));
    ok(cap.perk, 'Rucksack: Ruf-Bonus der Kundschafter kommt zur Sattlerei dazu');
    ok(cap.stash && cap.stashMax, 'Schatzkammer: 12, 24, 36, 48, 60, 80, 100, 125, 150, 180, 210, 250, 300, 350, 400 Plätze (Stufe 0–15, darüber 400)');
    ok(cap.bag90 && cap.sold && cap.bag30, 'Beutel nimmt bis bagCap() auf (90 bei Sattlerei 10, 30 ohne), darüber wird wie bisher verkauft');
    ok(cap.room && cap.full, 'Basar und Tausch prüfen dieselbe Grenze („Dein Beutel ist voll (54/54)“)');

    /* ---------- Alte Spielstände: ohne P.birds, kaputte Werte ---------- */
    const old = await page.evaluate(() => {
      const o = {}, c = JSON.parse(JSON.stringify(SAVE.chars[0])); delete c.birds; SAVE.chars[0] = c; activateChar(0); o.none = P.birds && typeof P.birds === 'object' && birdTotal() === 0;
      SAVE.chars[0].birds = { spatz: '3', rabe: -2, kuckuck: 5, eule: 1e9 }; activateChar(0); o.fix = birdCount('spatz') === 3 && !birdCount('rabe') && !('kuckuck' in P.birds) && birdCount('eule') === 99;
      SAVE.chars[0].birds = 'kaputt'; activateChar(0); o.broken = birdTotal() === 0;
      o.give = birdGive('taube', 2) && birdCount('taube') === 2 && !birdGive('kuckuck', 1) && !birdGive('spatz', 0) && !birdGive('spatz', -3);
      saveChar(); o.saved = JSON.parse(localStorage.getItem(SAVE_KEY)).chars[0].birds.taube === 2; activateChar(0); o.load = birdCount('taube') === 2;
      P.birds = {}; saveChar(); return o;
    });
    ok(old.none && old.fix && old.broken, 'Alte Spielstände ohne P.birds laden, kaputte Vogel-Zahlen werden repariert');
    ok(old.give && old.saved && old.load, 'birdGive(kind, n): nur bekannte Arten, gespeichert und wieder geladen');

    /* ---------- Sammelbeutel ---------- */
    const pu = await page.evaluate(([CALM_]) => {
      const CALM = eval('(' + CALM_ + ')'), o = {}; SAVE.meta.pets.act = null; SAVE.meta.lande.cps = [];
      o.offLand = landePouchAdd('erz', 5) === false;
      lBegin(); CALM(); P.inv = 1e9;
      const put = c => { c.x = P.x; c.y = P.y; c.z = 0; c.vz = 0; c.vx = c.vy = 0; c.t = 1; pickups.push(c); };
      const gold0 = P.gold, erz0 = P.mats.erz || 0, gem0 = P.gems['rubin:2'] || 0, part0 = P.parts['klinge:3'] || 0;
      put({ k: 'coin', v: 40 }); put({ k: 'mat', m: 'erz', n: 4 }); put({ k: 'gem', g: 'rubin:2' }); put({ k: 'lpart', pk: 'klinge:3', n: 2 }); put({ k: 'lmod', mk: 'test:1', n: 1 }); put({ k: 'loot', it: lItem(2, 1) }); updPickups(.016);
      o.noSlots = LW.pack.length === 1 && LW.pack[0].t === 'item';
      o.pouch = lPouchHas('gold') === 40 && lPouchHas('erz') === 4 && lPouchHas('gem:rubin:2') === 1 && lPouchHas('part:klinge:3') === 2 && lPouchHas('mod:test:1') === 1;
      o.notHome = P.gold === gold0 && (P.mats.erz || 0) === erz0;
      // Schnittstelle für Teil B: landePouchAdd(k, n)
      o.api = landePouchAdd('leder', 3) && landePouchAdd('gem:saphir:1', 2) && landePouchAdd('gold', 10) && !landePouchAdd('laser', 1) && !landePouchAdd('__proto__', 1) && !landePouchAdd('erz', 0) && !landePouchAdd('gem:nix:9', 1) && lPouchHas('leder') === 3 && lPouchHas('gold') === 50;
      // Rucksack voll mit Gegenständen: Material, Gold und Edelsteine kommen trotzdem mit
      while (LW.pack.length < lCap()) LW.pack.push({ t: 'item', it: makeItem({ slot: 'helm', tier: 0, rar: 0 }) });
      put({ k: 'mat', m: 'kristall', n: 2 }); put({ k: 'coin', v: 5 }); const it2 = lItem(2, 1); put({ k: 'loot', it: it2 }); updPickups(.016);
      o.fullPack = lPouchHas('kristall') === 2 && lPouchHas('gold') === 55 && pickups.some(c => c.it === it2) && LW.pack.length === lCap();
      // alter Ausflug (6.1): Stapel im Rucksack → beim nächsten Blick in den Sammelbeutel, nichts doppelt
      LW.pack.length = 2; delete LW.pouch; LW.pack.push({ t: 'gold', n: 7 }, { t: 'mat', k: 'erz', n: 2 }, { t: 'gem', k: 'rubin:0', n: 1 }); lPouch();
      o.migrate = LW.pack.length === 2 && lPouchHas('gold') === 7 && lPouchHas('erz') === 2 && lPouchHas('gem:rubin:0') === 1;
      // Händler, Heilerin, Aufträge bezahlen mit dem Sammelbeutel
      landePouchAdd('gold', 200); const tr = lNear(P.x, P.y, 400).find(n => n.k === 'npc' && n.role === 'trade'); LW.tnpc = tr; LW.offers.set(tr.op, [{ give: [{ t: 'mat', k: 'erz', n: 2 }], get: { t: 'item', it: lItem(1, 1) } }]);
      LW.pack.length = 0; ON.l_buyo(null, null, 0); o.trade = LW.pack.length === 1 && !lPouchHas('erz');
      lTradeScreen(tr); LG.tab = 'verkauf'; lTradeScreen(); o.sellRow = !!panel.querySelector('[data-act="l_sellp"][data-id="gem:rubin:0"]'); const gb = lPouchHas('gold'); ON.l_sellp('gem:rubin:0'); o.sellp = !lPouchHas('gem:rubin:0') && lPouchHas('gold') > gb; lResume();
      // Entkommen: alles daheim
      landePouchAdd('leder', 3); landePouchAdd('gem:saphir:1', 2); landePouchAdd('erz', 6);
      const g1 = P.gold, e1 = (P.mats.erz || 0) + lPouchHas('erz'), l1 = (P.mats.leder || 0) + lPouchHas('leder'), s1 = (P.gems['saphir:1'] || 0) + lPouchHas('gem:saphir:1'), pv = lPouchHas('gold'); const e0 = lNear(P.x, P.y, 300).find(e => e.k === 'exit'); lExtract(e0);
      o.extract = P.gold === g1 + pv && P.mats.erz === e1 && P.mats.leder === l1 && P.gems['saphir:1'] === s1 && pv > 0 && !landeActive(); o.exd = [g1, pv, P.gold, e1, P.mats.erz, l1, P.mats.leder, s1, P.gems['saphir:1']];
      o.screen = /SAMMELBEUTEL|IN SICHERHEIT/.test(panel.textContent);
      ON.l_home();
      // Tod: Sammelbeutel verloren
      lBegin(); CALM(); landePouchAdd('gold', 999); landePouchAdd('erz', 9); const g2 = P.gold, e2 = P.mats.erz; P.inv = 0; hurtPlayer(1e9, null);
      for (let i = 0; i < 300 && state === 'dead'; i++) update(.05);
      o.death = state === 'over' && P.gold === g2 && P.mats.erz === e2 && /GEFALLEN/.test(panel.textContent);
      ON.l_wake();
      // Abbruch: Sammelbeutel verloren
      lBegin(); CALM(); landePouchAdd('gold', 500); const g3 = P.gold; const r = lAbandon('quit'); o.quit = P.gold === g3 && r.lost.some(e => e.t === 'gold' && e.n === 500);
      enterHideout(); return o;
    }, [CALM.toString()]);
    ok(pu.offLand, 'landePouchAdd außerhalb der Lande: false (der Aufrufer gibt selbst)');
    ok(pu.noSlots && pu.pouch && pu.notHome, 'Gold, Material, Edelsteine, Bauteile und Mods brauchen keinen Rucksack-Platz – sie liegen im Sammelbeutel, nicht daheim');
    ok(pu.api, 'landePouchAdd(k, n): Gold, Material, gem:/part:/mod:-Schlüssel – Unsinn wird abgelehnt');
    ok(pu.fullPack, 'Rucksack voll: Gegenstand bleibt liegen, Gold und Material kommen trotzdem mit');
    ok(pu.migrate, 'Alter Ausflug mit Stapeln im Rucksack: wandern in den Sammelbeutel, nichts doppelt');
    ok(pu.trade && pu.sellRow && pu.sellp, 'Händler Bodo: Tausch bezahlt aus dem Sammelbeutel, Stapel aus dem Sammelbeutel verkaufen');
    ok(pu.extract && pu.screen, 'Entkommen: Sammelbeutel kommt vollständig heim (Gold, Material, Edelsteine)' + (pu.extract ? '' : ' ' + JSON.stringify(pu)));
    ok(pu.death, 'Tod: Sammelbeutel ist verloren');
    ok(pu.quit, 'Abbruch: Sammelbeutel ist verloren (wie der Rucksack)');

    /* ---------- Vögel ---------- */
    const bd = await page.evaluate(([CALM_]) => {
      const CALM = eval('(' + CALM_ + ')'), o = {}, H = SAVE.meta.hide;
      o.slots = BIRDORDER.map(k => BIRDS[k].slots).join() === '3,5,7,9,10';
      H.b.lager = 2; SAVE.meta.hide.stash = []; P.bag = []; P.birds = {}; birdGive('spatz', 2); birdGive('eule', 1); birdGive('phoenix', 1);
      lBegin(); CALM(); P.inv = 1e9;
      const its = []; for (let i = 0; i < 12; i++) { const it = lItem(2, 1); it.lw = LW.id; its.push(it); LW.pack.push({ t: 'item', it }); }
      const E = () => LW.pack.slice();
      o.tooMany = birdSend('spatz', E().slice(0, 4), false).err === 'slots' && LW.pack.length === 12 && birdCount('spatz') === 2;
      o.empty = birdSend('spatz', [], false).err === 'empty';
      LW.hurtT = T; o.fight = birdSend('spatz', E().slice(0, 1), false).err === 'fight' && LW.pack.length === 12; LW.hurtT = -99;
      const send3 = E().slice(0, 3), r = birdSend('spatz', send3, false);
      o.send = r.ok && r.r.stash === 3 && LW.pack.length === 9 && birdCount('spatz') === 1 && send3.every(e => H.stash.includes(e.it) && !e.it.lw) && !send3.some(e => P.bag.includes(e.it));
      // Sammelbeutel zählt als ein Platz, Gold sofort beim Helden
      landePouchAdd('gold', 321); landePouchAdd('erz', 4); const g0 = P.gold, e0 = P.mats.erz || 0;
      o.pouchSlot = birdSend('spatz', E().slice(0, 3), true).err === 'slots';
      const r2 = birdSend('spatz', E().slice(0, 2), true); o.pouch = r2.ok && P.gold === g0 + 321 && P.mats.erz === e0 + 4 && !lPouchList().length && birdCount('spatz') === 0;
      o.noBird = birdSend('spatz', E().slice(0, 1), false).err === 'bird';
      // Ausrüstung vom Aufbruch per Vogel heim, danach neu geladen (wie Abbruch): nichts verdoppelt
      const w0 = P.gear.weapon, w1 = makeItem({ slot: 'weapon', base: CLASSES[P.cls].start, tier: 2, rar: 2 }); w1.lw = LW.id; P.gear.weapon = w1; const we = { t: 'item', it: w0 }; LW.pack.push(we);
      birdGive('spatz', 1); const rw = birdSend('spatz', [we], false); lRestoreGear(lMeta().cur); const cnt = [P.gear.weapon].concat(H.stash, P.bag).filter(x => x && x.uid === w0.uid).length;
      o.noDup = rw.ok && cnt === 1 && H.stash.includes(w0) && P.gear.weapon !== w0;
      // Lager voll → Beutel → Fundkiste
      while (H.stash.length < stashCap()) H.stash.push(makeItem({ slot: 'helm', tier: 0, rar: 0 }));
      P.bag = []; for (let i = 0; i < bagCap() - 2; i++) P.bag.push(makeItem({ slot: 'helm', tier: 0, rar: 0 })); const box0 = SAVE.meta.lande.box.length;
      const r3 = birdSend('eule', E().slice(0, 4), false); o.overflow = r3.ok && r3.r.bag === 2 && r3.r.box === 2 && SAVE.meta.lande.box.length === box0 + 2 && P.bag.length === bagCap();
      // Ei ins Brutnest, Begleiter-Tasche als Quelle
      const d = lEgg(2), ne = SAVE.meta.pets.eggs.length; LW.pack.push({ t: 'egg', d }); const r4 = birdSend('phoenix', [LW.pack[LW.pack.length - 1]], false); o.egg = r4.ok && r4.r.eggs === 1 && SAVE.meta.pets.eggs.length === ne + 1;
      o.flight = VG.fly.length >= 1;
      // Fund in der Welt: Vogel als Bodenbeute
      P.birds = {}; lDrop(P.x, P.y, { t: 'bird', k: 'rabe' }); for (const c of pickups) { c.t = 1; c.z = 0; c.vz = 0; c.vx = c.vy = 0; c.x = P.x; c.y = P.y; } updPickups(.016); o.found = birdCount('rabe') === 1 && !pickups.some(c => c.k === 'lbird');
      o.roll = Array.from({ length: 300 }, () => birdRoll(Math.random())).every(k => !!BIRDS[k]);
      // Händler Bodo verkauft Vögel – einmal je Außenposten
      const tr = lNear(P.x, P.y, 400).find(n => n.k === 'npc' && n.role === 'trade'); LW.tnpc = tr; LG.tab = 'kauf'; landePouchAdd('gold', 5000); lTradeScreen(tr);
      const btn = panel.querySelector('[data-act="l_buyx"][data-id="bird:spatz"]'), pr = btn ? +btn.dataset.i : 0, gb = lPouchHas('gold');
      if (btn) ON.l_buyx('bird:spatz', btn, pr); o.shop = !!btn && birdCount('spatz') === 1 && lPouchHas('gold') === gb - pr;
      lTradeScreen(); o.shopOnce = !!panel.querySelector('[data-act="l_buyx"][data-id="bird:spatz"][disabled]');
      lResume(); ON.l_quitok && lAbandon('quit'); enterHideout();
      // Voliere: Stufe entscheidet, was gezüchtet wird
      P.birds = {}; P.mats.feder = 200; P.mats.holz = 200; P.mats.faser = 200; P.gold = 1e6;
      H.b.voliere = 0; o.lv0 = birdCraft('spatz').err === 'lv';
      H.b.voliere = 1; const f0 = P.mats.feder, gg = P.gold, c1 = voliereCost('spatz'), r5 = birdCraft('spatz'); o.lv1 = r5.ok && birdCount('spatz') >= 1 && P.mats.feder === f0 - c1.mats.feder && P.gold === gg - c1.gold && birdCraft('taube').err === 'lv';
      H.b.voliere = 2; o.lv2 = !!birdCraft('taube').ok && birdCraft('rabe').err === 'lv';
      H.b.voliere = 5; o.lv5 = BIRDORDER.every(k => birdCraft(k).ok) && voliereCost('spatz').gold < BIRDS.spatz.gold;
      P.mats.feder = 0; o.poor = birdCraft('spatz').err === 'poor';
      o.station = (() => { openStation('voliere'); const t = panel.textContent; return /VOLIERE/.test(t) && /MAGISCHE VÖGEL/.test(t) && panel.querySelectorAll('[data-act="v_craft"]').length === 5; })();
      P.mats.feder = 100; H.b.voliere = 3; openStation('voliere'); const n0 = birdCount('rabe'); ON.v_craft('rabe'); o.tap = birdCount('rabe') > n0;
      H.b.voliere = 0; H.stash = []; P.bag = []; saveChar(); return o;
    }, [CALM.toString()]);
    ok(bd.slots, 'Vogelarten: Spatz 3, Taube 5, Rabe 7, Eule 9, Phönixfeder 10 Plätze');
    ok(bd.tooMany && bd.empty && bd.noBird, 'Zu viel für den Vogel, nichts gewählt oder kein Vogel: abgelehnt, nichts geht verloren');
    ok(bd.fight, 'Mitten im Kampf fliegt kein Vogel (wie Abbrechen)');
    ok(bd.send, 'Vogel schicken: Gegenstände sofort ins Lager (ohne Lande-Marke), ein Vogel verbraucht');
    ok(bd.pouchSlot && bd.pouch, 'Sammelbeutel mitschicken: zählt als ein Platz, Gold und Material sofort beim Helden');
    ok(bd.overflow, 'Lager voll → Beutel, Beutel voll → Fundkiste am Weltentor');
    ok(bd.noDup, 'Ausrüstung vom Aufbruch per Vogel heim, dann neu geladen: nichts verdoppelt');
    ok(bd.egg && bd.flight, 'Ei per Vogel ins Brutnest; der Vogel fliegt sichtbar davon');
    ok(bd.found && bd.roll, 'Vögel als seltene Bodenbeute (Truhen, Elite) landen beim Helden');
    ok(bd.shop && bd.shopOnce, 'Händler Bodo verkauft Vögel gegen Gold aus dem Sammelbeutel, einmal je Außenposten');
    ok(bd.lv0 && bd.lv1 && bd.lv2 && bd.lv5 && bd.poor, 'Voliere: Stufe 1 Spatz … Stufe 5 Phönixfeder, Feder + Holz + Fasern + Gold, höhere Stufe billiger' + (bd.lv0 && bd.lv1 && bd.lv2 && bd.lv5 && bd.poor ? '' : ' ' + JSON.stringify(bd)));
    ok(bd.station && bd.tap, 'Voliere-Station (HOOK.station): Erklärung, fünf Arten, Züchten per Knopf');

    /* ---------- Lager beim Verkaufen und an der Werkbank ---------- */
    const st = await page.evaluate(() => {
      const o = {}, H = SAVE.meta.hide, mk = (slot, rar, x) => Object.assign(makeItem({ slot, base: slot === 'weapon' ? CLASSES[P.cls].start : slot, tier: 2, rar }), x || {});
      H.b.lager = 3; H.stash = []; P.bag = []; P.gold = 1e6; for (const m of MATORDER) P.mats[m] = 500;
      const uids = () => P.bag.concat(H.stash, ['weapon', 'armor', 'helm'].map(s => P.gear[s]).filter(Boolean)).map(x => x.uid), dup = () => { const u = uids(); return new Set(u).size !== u.length; };
      // Händler auf der Karte: aus dem Lager verkaufen
      P.map = genMap(4); const a = mk('helm', 2); H.stash.push(a); const g0 = P.gold; ON.msell(a.uid);
      o.msell = !H.stash.includes(a) && !P.bag.includes(a) && P.gold === g0 + itemPrice(a);
      // Alles Gewöhnliche: Standard nur Beutel, mit „Lager einbeziehen“ auch das Lager; Aufgewertetes und Mods bleiben
      const b1 = mk('helm', 0), b2 = mk('armor', 1), s1 = mk('helm', 0), s2 = mk('armor', 1, { up: 2 }), s3 = mk('helm', 1, { mods: ['x:1'] });
      P.bag.push(b1); H.stash.push(s1, s2, s3); mSellStash = false; ON.sellall(); o.bulkBag = !P.bag.length && H.stash.length === 3;
      P.bag.push(b2); mSellStash = true; const g1 = P.gold; ON.sellall(); o.bulkStash = !P.bag.length && H.stash.length === 2 && H.stash.includes(s2) && H.stash.includes(s3) && P.gold === g1 + itemPrice(b2) + itemPrice(s1);
      mSellStash = false; H.stash = []; o.dupSell = !dup();
      // Basar: Sofortverkauf und Versteigern aus dem Lager
      mkOpen('hide'); MK.tab = 'sell'; MK.cat = 'item'; MK.isrc = 'stash'; const c = mk('weapon', 1); H.stash.push(c); MK.sel = c.uid; mkShow();
      o.mkList = !!panel.querySelector(`[data-act="mk_sel"][data-id="${c.uid}"]`); const q = mkQuote({ t: 'item', it: c }), g2 = P.gold; ON.mk_sell(); if (MK.conf === 'sell') ON.mk_sell();
      o.mkSell = !H.stash.includes(c) && P.gold === g2 + q;
      const d = mk('armor', 2); H.stash.push(d); MK.sel = d.uid; ON.mk_set(); ON.mk_go(); o.mkAuc = !H.stash.includes(d) && mkM().own.some(A => A.e.it && A.e.it.uid === d.uid);
      MK.bst = true; H.stash.push(mk('helm', 0)); P.bag.push(mk('helm', 1)); MK.conf = 'bulk'; ON.mk_bulk(); o.mkBulk = !P.bag.length && !H.stash.length; MK.bst = false;
      mkClose && mkClose();
      // Werkbank: Lager-Gegenstand aufwerten, zerlegen, als Opfer verschmelzen, Essenz extrahieren, anlegen
      const e = mk('weapon', 2); H.stash.push(e); selItem = e.uid; wbTab = 'ver'; WB.src = 'stash'; openWorkbench('smith'); o.wbPick = !!panel.querySelector(`[data-act="wsel"][data-id="${e.uid}"]`) && /IM LAGER/.test(panel.textContent);
      const erz = P.mats.erz; ON.up(); o.up = e.up === 1 && H.stash.includes(e) && P.mats.erz < erz;
      const v = mk('weapon', 1); H.stash.push(v); const A = mk('weapon', 2); P.bag.push(A); const fr = fuseItems(A, v); o.fuse = fr.r === 'ok' && !H.stash.includes(v) && P.bag.includes(A);
      const z = mk('armor', 2), p0 = pcount(); H.stash.push(z); selItem = z.uid; wbTab = 'zer'; openWorkbench(); ON.zr_one(z.uid); if (H.stash.includes(z)) ON.zr_one(z.uid); o.salv = !H.stash.includes(z) && pcount() > p0;
      const z1 = mk('helm', 0), z2 = mk('helm', 0); H.stash.push(z1); P.bag.push(z2); WB.zst = false; zrArm = 'all0'; ON.zr_all('0'); o.zrBag = !P.bag.includes(z2) && H.stash.includes(z1);
      WB.zst = true; zrArm = 'all0'; ON.zr_all('0'); o.zrStash = !H.stash.includes(z1); WB.zst = false;
      if (typeof affExtract === 'function') { const x = mk('weapon', 3); H.stash.push(x); const k = Object.keys(x.aff)[0], ek = affExtract(x, k); o.extract = !!ek && ek !== 'poor' && !H.stash.includes(x); } else o.extract = true;
      const w = mk('weapon', 3), w0 = P.gear.weapon; H.stash.push(w); o.equip = equipItem(w) && P.gear.weapon === w && H.stash.includes(w0) && !H.stash.includes(w);
      const foreign = Object.assign(makeItem({ slot: 'weapon', base: Object.keys(WT).find(k => !CLASSES[P.cls].weapons.includes(k)), tier: 1, rar: 1 })); H.stash.push(foreign); o.noForeign = !equipItem(foreign) && H.stash.includes(foreign);
      selItem = foreign.uid; wbTab = 'ver'; openWorkbench(); o.noEquipBtn = !panel.querySelector('[data-act="mw_equip"]');
      // Neues von der Werkbank: Beutel voll → Lager
      P.bag = []; for (let i = 0; i < bagCap(); i++) P.bag.push(mk('helm', 0)); H.stash = []; const n0 = H.stash.length; const f = forgeItem(1, 'armor'); o.forgeStash = !!f && H.stash.includes(f) && P.bag.length === bagCap();
      o.dup = !dup(); P.bag = []; H.stash = []; selItem = null; saveChar(); return o;
    });
    ok(st.msell && st.dupSell, 'Händler: Gegenstand aus dem Lager verkaufen – Gold kommt an, nichts doppelt');
    ok(st.bulkBag && st.bulkStash, '„Alles Gewöhnliche verkaufen“: nur Beutel, mit „Lager einbeziehen“ auch das Lager – Aufgewertetes und Gegenstände mit Mods bleiben');
    ok(st.mkList && st.mkSell && st.mkAuc && st.mkBulk, 'Basar: Lager-Gegenstände sofort verkaufen, versteigern und gesammelt verkaufen' + (st.mkList && st.mkSell && st.mkAuc && st.mkBulk ? '' : ' ' + JSON.stringify(st)));
    ok(st.wbPick && st.up, 'Werkbank: Lager-Gegenstand wählen und aufwerten – er bleibt im Lager, Material wird bezahlt');
    ok(st.fuse && st.salv && st.zrBag && st.zrStash && st.extract, 'Werkbank: Opfer aus dem Lager, Zerlegen aus dem Lager (Sammel-Zerlegen nur mit „Lager einbeziehen“), Essenz extrahieren');
    ok(st.equip && st.noForeign && st.noEquipBtn, 'Anlegen aus dem Lager: Altes kommt an dieselbe Stelle, fremde Klassen-Waffen werden nicht angeboten');
    ok(st.forgeStash && st.dup, 'Geschmiedetes bei vollem Beutel ins Lager; kein Gegenstand doppelt');
    ok(!errs.length, 'keine Fehler (Regeln)' + (errs.length ? ': ' + errs.slice(0, 3).join(' | ') : ''));
    await page.close();
  }

  /* ---------- Oberfläche: hoch, quer, PC ---------- */
  for (const [W, H, pc] of [[390, 844, false], [844, 390, false], [1920, 1080, true]]) {
    console.log(`Taschen & Vögel – Oberfläche ${W}x${H}`);
    const ctx = await b.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: pc ? 1 : 2, isMobile: !pc, hasTouch: !pc, locale: 'de-DE' });
    const page = await ctx.newPage();
    const errs = []; page.on('pageerror', e => errs.push(e.message)); page.on('console', m => { if (m.type() === 'error' && !/favicon|net::ERR/.test(m.text())) errs.push('console: ' + m.text()); });
    await page.goto(BASE + 'index.html'); await page.waitForTimeout(1500); await page.evaluate(SHIM);
    await page.evaluate(([H_]) => { eval('(' + H_ + ')')('ranger', 30); const H = SAVE.meta.hide; H.b.sattler = 10; H.b.lager = 15; H.b.voliere = 4; P.gold = 99999; for (const m of MATORDER) P.mats[m] = 60; for (const k of ['feder', 'holz', 'faser']) P.mats[k] = 40;
      for (let i = 0; i < 90; i++) P.bag.push(randomItem(8 + i % 30, i % 5)); for (let i = 0; i < 400; i++) H.stash.push(randomItem(4 + i % 40, i % 4)); SAVE.meta.pets.starter = true; petGive('eule', { nm: 'Hu', lv: 15 }); P.map = genMap(4); saveChar(); }, [HERO.toString()]);
    const tap = async sel => { const el = page.locator(sel).first(); await el.scrollIntoViewIfNeeded().catch(() => { }); try { if (pc) await el.click({ timeout: 4000 }); else await el.tap({ timeout: 4000 }); } catch (e) { throw new Error('Antippen ' + sel + ': ' + e.message.split('\n')[0]); } await page.waitForTimeout(260); };
    const inView = async sel => { const el = page.locator(sel).first(); if (!(await el.count())) return false; const r = await el.boundingBox(); return !!r && r.y >= 0 && r.y + r.height <= H + 1 && r.x >= 0 && r.x + r.width <= W + 1; };
    const shot = async n => { await page.waitForTimeout(220); await page.screenshot({ path: `${OUT}/${W}x${H}_${n}.png` }); };
    const pre = `${W}x${H}: `, noScroll = () => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1 && panel.scrollWidth <= panel.clientWidth + 1);
    // Charakter: Beutel 90/90, eigenes Scroll-Raster, Auswahl bleibt an der Stelle
    await page.evaluate(() => { selItem = null; openChar('gear', 'map'); });
    ok(await page.evaluate(() => /BEUTEL 90\/90/.test(panel.textContent) && panel.querySelectorAll('[data-act="isel"]').length === 90 + 3), pre + 'Charakter: „BEUTEL 90/90“, alle 90 Gegenstände im Raster');
    ok(await noScroll(), pre + 'Charakter: kein seitliches Scrollen');
    await shot('01_beutel90');
    const keep = await page.evaluate(async () => { const g = panel.querySelector('[data-sk="cbag"]'); if (!g || g.scrollHeight <= g.clientHeight + 4) return 'kein Scroll'; g.scrollTop = g.scrollHeight; const t0 = g.scrollTop, last = [...g.querySelectorAll('[data-act="isel"]')].pop(); ON.isel ? ON.isel(last.dataset.id) : (selItem = last.dataset.id, openChar()); await new Promise(r => setTimeout(r, 50)); const g2 = panel.querySelector('[data-sk="cbag"]'); return Math.abs(g2.scrollTop - t0) < 4 ? 'ok' : 'weg ' + t0 + '→' + g2.scrollTop; });
    ok(keep === 'ok' || (pc && keep === 'kein Scroll'), pre + 'Charakter: großes Raster scrollt für sich, Position bleibt nach dem Antippen (' + keep + ')');
    await shot('02_beutel90_auswahl');
    // Schatzkammer mit 400
    await page.evaluate(() => { enterHideout(); selItem = null; openStation('lager'); });
    ok(await page.evaluate(() => /LAGER 400\/400/.test(panel.textContent) && /BEUTEL 90\/90/.test(panel.textContent) && panel.querySelectorAll('[data-act="stout"]').length === 400), pre + 'Schatzkammer: „LAGER 400/400“ und „BEUTEL 90/90“');
    ok(await noScroll(), pre + 'Schatzkammer: kein seitliches Scrollen');
    await shot('03_lager400');
    await tap('[data-act="stsort"][data-id="stash"]');
    ok(await page.evaluate(() => { const S = SAVE.meta.hide.stash; return S.every((x, i) => !i || itemSortKey(S[i - 1], x) <= 0); }), pre + 'Schatzkammer: „Sortieren“ ordnet das Lager');
    // Händler: Verkaufen mit Umschalter Beutel | Lager
    await page.evaluate(() => { mTab = 'sell'; mSrc = 'bag'; openMerchant(); });
    await tap('[data-act="msrc"][data-id="stash"]');
    ok(await page.evaluate(() => mSrc === 'stash' && panel.querySelectorAll('[data-act="msell"]').length === 400) && await inView('[data-act="mstash"]'), pre + 'Händler: Umschalter „Lager“ zeigt das Lager, „Lager einbeziehen“ sichtbar');
    const sold = await page.evaluate(() => { const S = SAVE.meta.hide.stash, it = S[0], g = P.gold; ON.msell(it.uid); return !S.includes(it) && P.gold === g + itemPrice(it); });
    ok(sold, pre + 'Händler: aus dem Lager verkauft');
    await shot('04_haendler_lager');
    // Werkbank: Lager-Gegenstand bearbeiten
    await page.evaluate(() => { selItem = null; wbTab = 'ver'; openWorkbench('node'); });
    if (!pc && W < 600) await tap('[data-act="wb_bag"]');
    await tap('[data-act="wb_src"][data-id="stash"]');
    ok(await page.evaluate(() => WB.src === 'stash' && /LAGER 399\/400/.test(panel.textContent)), pre + 'Werkbank: Umschalter „Lager“ in VERBESSERN');
    const sid = await page.evaluate(() => SAVE.meta.hide.stash[5].uid);
    await tap(`[data-act="wsel"][data-id="${sid}"]`);
    ok(await page.evaluate(id => selItem === id && /IM LAGER/.test(panel.textContent), sid), pre + 'Werkbank: Lager-Gegenstand gewählt („IM LAGER“)');
    await shot('05_werkbank_lager');
    await page.evaluate(() => { wbTab = 'zer'; openWorkbench(); });
    ok(await page.evaluate(() => !!panel.querySelector('[data-act="wb_zst"]')) && await noScroll(), pre + 'Zerlegen: „Lager einbeziehen“ für Sammel-Zerlegen');
    await shot('06_zerlegen_lager');
    // Basar
    await page.evaluate(() => { mkOpen('hide'); MK.tab = 'sell'; MK.cat = 'item'; MK.isrc = 'bag'; mkShow(); }); await page.waitForTimeout(400);   // Basar: Schutz vor Doppeltipp nach dem Öffnen
    await tap('[data-act="mk_isrc"][data-id="stash"]');
    ok(await page.evaluate(() => MK.isrc === 'stash' && /LAGER 399\/400/.test(panel.textContent)) && await noScroll(), pre + 'Basar: Umschalter „Lager“ beim Verkaufen');
    await shot('07_basar_lager');
    await page.evaluate(() => { mkClose(); });
    // Voliere
    await page.evaluate(() => { enterHideout(); openStation('voliere'); });
    ok(await page.evaluate(() => panel.querySelectorAll('.vrow').length === 5 && panel.querySelectorAll('[data-act="v_craft"]').length === 4 && panel.querySelectorAll('.vrow.lock').length === 1) && await noScroll(), pre + 'Voliere Stufe 4: fünf Arten, vier züchtbar, Phönixfeder gesperrt');
    await tap('[data-act="v_craft"][data-id="spatz"]');
    ok(await page.evaluate(() => birdCount('spatz') >= 1), pre + 'Voliere: Spatz gezüchtet (Antippen)');
    await shot('08_voliere');
    // Endlose Lande: HUD, Rucksack mit Sammelbeutel, Vogel schicken
    await page.evaluate(() => { P.bag.length = 20; SAVE.meta.hide.stash.length = 100; birdGive('rabe', 1); birdGive('phoenix', 1); landeStart('tor'); }); await page.waitForTimeout(1400);
    await page.evaluate(() => { LW.huntT = 1e9; LW.rivT = 1e9; P.inv = 1e9; for (const e of enemies) e.dead = true; enemies = []; LW.hurtT = -99; for (let i = 0; i < 14; i++) LW.pack.push({ t: 'item', it: lItem(2, 2 + (i % 3)) }); LW.pack.push({ t: 'egg', d: lEgg(3) }); landePouchAdd('gold', 4321, true); for (const k of MATORDER.slice(0, 9)) landePouchAdd(k, 3 + MATORDER.indexOf(k), true); landePouchAdd('gem:rubin:2', 2, true); landePouchAdd('gem:saphir:1', 1, true); landePouchAdd('part:klinge:3', 2, true); });
    await page.waitForTimeout(600);
    ok(await inView('#lhPo') && await page.evaluate(() => /4\.3k|4321/.test($('lhPg').textContent)), pre + 'HUD: Sammelbeutel-Zähler (Gold und Material) sichtbar');
    await shot('09_hud');
    await page.locator('#lhPack').click(); await page.waitForTimeout(400);
    ok(await page.evaluate(() => /SAMMELBEUTEL/.test(panel.textContent) && panel.querySelectorAll('.lpouch .lslot').length >= 12), pre + 'Rucksack: Sammelbeutel mit Bildern und Anzahl');
    ok(await inView('[data-act="v_open"]'), pre + 'Rucksack: „Vogel schicken“ ohne Scrollen sichtbar');
    ok(await noScroll(), pre + 'Rucksack: kein seitliches Scrollen');
    await shot('10_rucksack_sammelbeutel');
    await tap('[data-act="v_open"]');
    ok(await page.evaluate(() => /VOGEL SCHICKEN/.test(panel.textContent) && panel.querySelectorAll('[data-act="v_kind"]').length === 5), pre + 'Vogel schicken: Auswahl der Vogelarten');
    await tap('[data-act="v_kind"][data-id="rabe"]'); await tap('[data-act="v_best"]');
    ok(await page.evaluate(() => vgUsed() === 7), pre + 'Vogel schicken: „Wertvollstes wählen“ füllt alle 7 Plätze des Raben');
    ok(await inView('[data-act="v_go"]') && await noScroll(), pre + 'Vogel schicken: „losschicken“ sichtbar, kein seitliches Scrollen');
    await shot('11_vogel_schicken');
    const before = await page.evaluate(() => ({ s: SAVE.meta.hide.stash.length, p: LW.pack.length, b: birdCount('rabe') }));
    await tap('[data-act="v_go"]'); await page.waitForTimeout(350);
    const after = await page.evaluate(() => ({ s: SAVE.meta.hide.stash.length, p: LW.pack.length, b: birdCount('rabe'), play: state === 'play', fly: VG.fly.length }));
    ok(after.play && after.b === before.b - 1 && after.p < before.p && after.s > before.s && after.fly === 1, pre + 'Losgeschickt: zurück im Spiel, Rabe fliegt, Dinge im Lager ' + JSON.stringify([before, after]));
    await shot('12_vogel_flug');
    // im Kampf: Knopf gesperrt
    await page.evaluate(() => { LW.hurtT = T; LG.sel = null; lInv(); });
    ok(await page.evaluate(() => !!panel.querySelector('[data-act="v_open"][disabled]')), pre + 'Im Kampf: „Vogel schicken“ gesperrt');
    await page.evaluate(() => { LW.hurtT = -99; lResume(); lAbandon('quit'); enterHideout(); });
    ok(!errs.length, pre + 'keine Fehler' + (errs.length ? ': ' + errs.slice(0, 3).join(' | ') : ''));
    await ctx.close();
  }
  console.log('  Bilder: ' + OUT);
  await b.close();
  process.exit(fails.length ? 1 : 0);
})().catch(e => { console.log('  FAIL Abbruch: ' + e.message.split('\n')[0]); process.exit(1); });
