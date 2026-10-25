// Die Verlorenen Lande (6.0): Regeln, Tod, Entkommen, Abbruch, Begleiter-Tasche – und ein Durchlauf mit Antippen.
// Aufruf: node lande.js [ausgabeordner]   (BASE = Adresse des Spiels)
// Läuft auch ohne die neue Begleiter-Schnittstelle (petBagSize, petHurt, petIsHurt): dann mit einem kleinen Ersatz.
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
  SAVE.chars.push(c); activateChar(0); SAVE.meta.hide.intro = true;
  P.gear.weapon = makeItem({ slot: 'weapon', base: CLASSES[P.cls].start, tier: 2, rar: 3 }); P.gear.armor = makeItem({ slot: 'armor', base: 'armor', tier: 2, rar: 2 });
  computeStats(); P.hp = P.st.hp; saveChar();
};

(async () => {
  fs.rmSync(OUT, { recursive: true, force: true }); fs.mkdirSync(OUT, { recursive: true });
  const b = await chromium.launch();
  console.log('Verlorene Lande – Regeln');
  {
    const page = await b.newPage({ viewport: { width: 844, height: 390 }, locale: 'de-DE' });
    const errs = []; page.on('pageerror', e => errs.push(e.message + ' @ ' + ((e.stack || '').split('\n')[1] || '').trim()));
    await page.goto(BASE + 'index.html'); await page.waitForTimeout(1500);
    const api = await page.evaluate(STANDIN);
    console.log('  Begleiter-Schnittstelle:', api);
    const r = await page.evaluate(([HERO_]) => {
      const o = {}; eval('(' + HERO_ + ')')();
      const M = SAVE.meta.lande;
      o.meta = !!M && M.runs === 0 && Array.isArray(M.box) && M.cur === null && M.keys === 0;
      // alter Spielstand ohne lande-Feld und mit kaputten Werten lädt
      const fixed = lMetaFix({ runs: 'x', box: [{ t: 'item' }, { t: 'gold', n: 5 }], cur: 7 }); o.fix = fixed.runs === 0 && fixed.box.length === 1 && fixed.cur === null;
      o.tier0 = lTierOpen(0) && !lTierOpen(1) && lCanGo(0); M.tx = [1]; o.tier1 = lTierOpen(1) && lCanGo(1) && !lTierOpen(2); P.lv = 4; o.lvReq = !lCanGo(0); P.lv = 14; M.tx = [];
      o.tiers = LANDE_TIER.length >= 10 && LANDE_TIER.every((t, i) => !i || t.st > LANDE_TIER[i - 1].st);
      // Seltenheit: Kampagne unverändert, Freiwelt besser – und nur dort Mythisch
      const cnt = [0, 0, 0, 0, 0, 0, 0]; for (let i = 0; i < 20000; i++) cnt[randomItem(10, 0).rar]++;
      o.campLeg = cnt[4] / 200; o.campMyth = cnt[6];
      const w = [0, 0, 0, 0, 0, 0, 0], w4 = [0, 0, 0, 0, 0, 0, 0]; for (let i = 0; i < 40000; i++) { w[landeRar(Math.random(), 1)]++; w4[landeRar(Math.random(), 3.8)]++; }
      o.wLeg = w[4] / 400; o.wMyth = w[6] / 400; o.w4Leg = w4[4] / 400; o.w4Myth = w4[6] / 400;
      // Welt erzeugen
      lBegin(0); return o;
    }, [HERO.toString()]);
    await page.waitForTimeout(300);
    ok(r.meta && r.fix, 'Spielstand: SAVE.meta.lande mit Standardwerten, kaputte Daten werden repariert');
    ok(r.tier0 && r.tier1 && r.lvReq && r.tiers, 'Weltstufen: Grenzland ab Level 5, nächste Stufe erst nach dem Entkommen, immer schwerer');
    ok(r.campLeg < 1.5 && r.campMyth === 0, `Kampagne: Legendär ${r.campLeg.toFixed(2)} %, kein Mythisch aus normaler Beute`);
    ok(r.wLeg > 1 && r.wLeg < 2 && r.wMyth > .05 && r.wMyth < .3 && r.w4Leg > r.wLeg * 2.5 && r.w4Myth > r.wMyth * 2.5, `Freiwelt: Legendär ${r.wLeg.toFixed(2)} % / ${r.w4Leg.toFixed(1)} %, Mythisch ${r.wMyth.toFixed(2)} % / ${r.w4Myth.toFixed(2)} % (Grenzland / Abgrund)`);
    const g = await page.evaluate(() => {
      const L = LW, S = L.S, sp = L.spawn, o = {};
      o.on = landeActive() && G.type === 'lande' && state === 'play' && AW === S && AH === S;
      o.size = S >= 1700;
      o.exits = L.exits.length >= 2 && L.exits.every(e => Math.hypot(e.x - sp.x, e.y - sp.y) > S * .35);
      o.npcs = ['mis', 'trade', 'heal'].every(k => !!L.npcs[k]);
      o.camps = L.camps.length >= 4 && L.camps.every(c => Math.hypot(c.x - sp.x, c.y - sp.y) > 200);
      o.spots = L.spots.length >= 15; o.bosses = L.bosses.length >= 1; o.rivals = L.rivals.length >= 1;
      o.free = !L.objs.some(x => x.solid && Math.hypot(x.x - sp.x, x.y - sp.y) < 40);
      o.fog = L.fog.some(v => v) && L.fog.some(v => !v);
      o.stage = stageNum() === lStage(P.x, P.y);
      return o;
    });
    ok(g.on && g.size, 'Welt betreten: eigene große Karte, Spiel läuft');
    ok(g.exits && g.npcs && g.camps && g.spots && g.bosses && g.rivals, 'Welt: Ausgänge weit weg vom Start, Händler/Auftraggeberin/Heilerin, Lager, Fundstellen, Ungeheuer, Rivalen');
    ok(g.free && g.fog && g.stage, 'Start frei von Hindernissen, Nebel des Krieges, Gegnerstufe nach Ort');
    const pk = await page.evaluate(() => {
      const o = {}, gold0 = P.gold, mats0 = P.mats.erz || 0; P.inv = 999;
      const put = c => { c.x = P.x; c.y = P.y; c.z = 0; c.vz = 0; c.vx = c.vy = 0; c.t = 1; pickups.push(c); };
      put({ k: 'coin', v: 25 }); put({ k: 'mat', m: 'erz', n: 3 }); put({ k: 'loot', it: makeItem({ slot: 'helm', base: 'helm', tier: 1, rar: 4 }) }); put({ k: 'lpart', pk: 'klinge:2', n: 1 });
      updPickups(.016);
      o.gold = LW.pack.some(e => e.t === 'gold' && e.n === 25) && P.gold === gold0; o.mat = LW.pack.some(e => e.t === 'mat' && e.k === 'erz' && e.n === 3) && (P.mats.erz || 0) === mats0;
      o.item = LW.pack.some(e => e.t === 'item' && e.it.lw === LW.id); o.part = LW.pack.some(e => e.t === 'part' && e.k === 'klinge:2');
      put({ k: 'coin', v: 5 }); updPickups(.016); o.stack = LW.pack.filter(e => e.t === 'gold').length === 1 && LW.pack.find(e => e.t === 'gold').n === 30;
      P.hp = 10; put({ k: 'heart' }); updPickups(.016); o.heart = P.hp > 10;
      while (LW.pack.length < lCap()) LW.pack.push({ t: 'mat', k: MATORDER[LW.pack.length % 13], n: 1 }); LW.pack.length = lCap();
      const it = makeItem({ slot: 'weapon', base: CLASSES[P.cls].start, tier: 1, rar: 1 }); put({ k: 'loot', it }); updPickups(.016); o.full = pickups.some(c => c.it === it) && LW.pack.length === lCap();
      // Bauteile aus Kills (js/forge.js) landen im Rucksack statt daheim
      LW.pack.length = 4; const parts0 = JSON.stringify(P.parts); const e = lSpawn('goblin', P.x + 30, P.y, {}); lKillPre(e); P.parts['griff:3'] = (P.parts['griff:3'] || 0) + 1; lKillPost(e);
      o.parts = LW.pack.some(x => x.t === 'part' && x.k === 'griff:3') && JSON.stringify(P.parts) === parts0;
      return o;
    });
    ok(pk.gold && pk.mat && pk.item && pk.part, 'Beute (Gold, Material, Gegenstand, Bauteil) kommt in den Rucksack, nicht nach Hause');
    ok(pk.stack && pk.heart, 'Gold stapelt sich in einem Platz, Herzen heilen wie immer');
    ok(pk.full, 'Rucksack voll: Beute bleibt liegen');
    ok(pk.parts, 'Bauteile aus Kills wandern in den Rucksack');
    // Begleiter-Eier und Beutewert über die echten Schnittstellen (js/pets.js, js/market.js), falls vorhanden
    const eg = await page.evaluate(() => {
      const o = {}, n0 = SAVE.meta.pets.eggs.length; P.inv = 999; LW.pack.length = 0; pickups.length = 0;
      const d = lEgg(2); o.roll = !!d && !!PET_SP[d.sp] && (d.tier == null || d.tier === PET_SP[d.sp].t);
      const land = () => { for (const c of pickups) { c.t = 1; c.z = 0; c.vz = 0; c.vx = c.vy = 0; c.x = P.x; c.y = P.y; } updPickups(.016); };
      lDrop(P.x, P.y, { t: 'egg', d }); land();
      o.inPack = LW.pack.some(e => e.t === 'egg' && e.d.sp === d.sp) && SAVE.meta.pets.eggs.length === n0;
      // Ein Ei vom Begleiter-System beim Sieg (Champion/Ungeheuer) liegt in der Freiwelt am Boden, nicht im Nest
      if (typeof eggGive === 'function') { const e = lSpawn('goblin', P.x + 30, P.y, {}); lKillPre(e); eggGive(null, true, { tier: 1 }); lKillPost(e); o.killEgg = SAVE.meta.pets.eggs.length === n0 && pickups.some(c => c.k === 'legg'); } else o.killEgg = true;
      const all = [{ t: 'item', it: lItem(2, 1) }, { t: 'mat', k: 'erz', n: 2 }, { t: 'gem', k: randomGem(10), n: 1 }, { t: 'part', k: lPart(10, 0) || 'griff:3', n: 1 }, { t: 'egg', d }, { t: 'gold', n: 9 }];
      o.fmt = typeof petLootFix !== 'function' || all.every(x => !!petLootFix(x));
      o.market = typeof lootValue === 'function'; o.val = !o.market || all.every(x => lootValue(x) <= 0 || lVal(x) === Math.round(lootValue(x)));
      const r = lDeliver([{ t: 'egg', d }]), E = SAVE.meta.pets.eggs; o.deliver = r.eggs === 1 && E.length === n0 + 1 && E[E.length - 1].sp === d.sp;
      LW.pack.length = 0; pickups.length = 0; return o;
    });
    ok(eg.roll && eg.inPack && eg.killEgg, 'Begleiter-Eier: Weltbeute im Rucksack – auch Eier aus Siegen landen erst am Boden, nicht direkt im Nest');
    ok(eg.fmt, 'Beute-Einträge passen ins gemeinsame Format des Begleiter-Beutels (petLootFix)');
    ok(eg.val, 'Beutewert: ' + (eg.market ? 'aus dem Basar (lootValue)' : 'eigene Schätzung (ohne Basar)'));
    ok(eg.deliver, 'Heimgebrachtes Ei kommt über eggGive ins Brutnest');
    // Tod: Ausrüstung und Rucksack weg, Begleiter-Tasche kommt heim, Begleiter verletzt
    const d = await page.evaluate(() => {
      const o = {}; SAVE.meta.pets.starter = true; const p = petGive('drache', { nm: 'Funki', lv: 20 }); SAVE.meta.pets.act = p.id;
      LW.pet = lPet(); LW.petBag = lBagSize(LW.pet); o.bagSize = LW.petBag;
      const saved = lItem(3, 2), lost = lItem(2, 1), bag0 = P.bag.length, w0 = P.gear.weapon.uid;
      lBag(LW.pet).push({ t: 'item', it: saved }); LW.pack = [{ t: 'item', it: lost }, { t: 'gold', n: 500 }];
      const g0 = P.gold; P.inv = 0; hurtPlayer(1e9, null); o.dead = state === 'dead';
      for (let i = 0; i < 300 && state === 'dead'; i++) update(.05);
      o.screen = state === 'over' && /GEFALLEN IN DEN VERLORENEN LANDEN/.test(panel.textContent);
      o.gearLost = P.gear.weapon.uid !== w0 && P.gear.weapon.tier === 0 && P.gear.weapon.rar === 0 && P.gear.armor.rar === 0;
      o.saved = P.bag.length === bag0 + 1 && P.bag.some(x => x.uid === saved.uid) && !P.bag.some(x => x.uid === lost.uid) && !saved.lw;
      o.goldLost = P.gold === g0; o.bagEmpty = lBag(p).length === 0; o.hurt = petIsHurt(p); o.noPet = !lPet();
      const M = SAVE.meta.lande; o.meta = M.deaths === 1 && M.cur === null && !landeActive();
      o.persist = JSON.parse(localStorage.getItem(SAVE_KEY)).chars[0].gear.weapon.tier === 0;
      ON.l_wake(); o.hide = G && G.type === 'versteck' && P.hp === P.st.hp && !document.body.classList.contains('lande');
      return o;
    });
    ok(d.dead && d.screen, 'Tod: eigener Bildschirm „Gefallen in den Verlorenen Landen“');
    ok(d.gearLost && d.goldLost, 'Tod: angelegte Ausrüstung weg, Held bekommt einfache Ausrüstung (Gold daheim bleibt)');
    ok(d.saved && d.bagEmpty, 'Tod: nur der Inhalt der Begleiter-Tasche kommt heim');
    ok(d.hurt && d.noPet, 'Tod: Begleiter verletzt (petHurt), kann nicht mit');
    ok(d.meta && d.persist && d.hide, 'Tod: gespeichert, Held erwacht im Versteck');
    // Entkommen: alles in Sicherheit, Statistik, nächste Stufe frei
    const x = await page.evaluate(() => {
      const o = {}; const p = SAVE.meta.pets.list[0]; delete p.hurt; P.lv = 14; lBegin(0); return 1;
    });
    await page.waitForTimeout(200);
    const ex = await page.evaluate(() => {
      const o = {}, it = lItem(2, 1), it2 = lItem(2, 1), bag0 = P.bag.length; LW.pack = [{ t: 'item', it }, { t: 'gold', n: 300 }, { t: 'mat', k: 'mithril', n: 4 }]; it.lw = LW.id;
      lBag(LW.pet).push({ t: 'item', it: it2 }); const g0 = P.gold, m0 = P.mats.mithril || 0;
      const e0 = LW.exits.find(e => e.t === 'portal'); P.x = e0.x; P.y = e0.y; P.inv = 999; for (const e of enemies) e.dead = true; enemies = [];
      for (let i = 0; i < 200 && landeActive(); i++) { LW.hurtT = -9; for (const e of enemies) e.dead = true; update(.05); }
      o.done = !landeActive() && /ENTKOMMEN/.test(panel.textContent);
      o.items = P.bag.length === bag0 + 2 && P.bag.every(i => !i.lw); o.gold = P.gold >= g0 + 300 && (P.mats.mithril || 0) === m0 + 4;
      const M = SAVE.meta.lande; o.meta = M.ext === 1 && M.tx[0] === 1 && M.best > 0 && M.cur === null && lTierOpen(1);
      return o;
    });
    ok(ex.done && ex.items && ex.gold, 'Ausgang: stehen bleiben → entkommen, Rucksack und Tasche landen bei dir' + (ex.done && ex.items && ex.gold ? '' : ' ' + JSON.stringify(ex)));
    ok(ex.meta, 'Entkommen zählt: Statistik, Bestwert, Wildnis freigeschaltet');
    // Abbruch durch Neu laden: Rucksack weg, Ausrüstung vom Aufbruch zurück – ohne Verdopplung
    await page.evaluate(() => { ON.l_home(); lBegin(0); });
    await page.waitForTimeout(200);
    const rl = await page.evaluate(() => {
      const of = (sl, r) => { let it; do it = lItem(r, 1); while (it.slot !== sl); return it; };
      const w0 = P.gear.weapon, found = of('weapon', 3); found.lw = LW.id; LW.pack.push({ t: 'item', it: w0 }); P.gear.weapon = found; LW.pack.push({ t: 'gold', n: 999 });
      const a0 = P.gear.armor; lBag(LW.pet).push({ t: 'item', it: a0 }); P.gear.armor = of('armor', 2); P.gear.armor.lw = LW.id;
      saveChar(); persist(); return { w0: w0.uid, a0: a0.uid, found: found.uid };
    });
    await page.reload(); await page.waitForTimeout(1500);
    const rl2 = await page.evaluate(([ids, STANDIN_]) => {
      eval('(' + STANDIN_ + ')')(); activateChar(0);
      const M = SAVE.meta.lande, n = u => ['weapon', 'armor', 'helm'].filter(s => P.gear[s] && P.gear[s].uid === u).length + P.bag.filter(i => i.uid === u).length + SAVE.meta.pets.list.reduce((a, p) => a + (Array.isArray(p.bag) ? p.bag.filter(e => e.t === 'item' && e.it.uid === u).length : 0), 0);
      return { cur: M.cur === null, aband: M.aband === 1, weapon: P.gear.weapon.uid === ids.w0, armorNotDup: n(ids.a0) === 1, gold: !P.bag.some(i => i.uid === ids.found) && n(ids.found) === 0 };
    }, [rl, STANDIN.toString()]);
    ok(rl2.cur && rl2.aband && rl2.weapon && rl2.gold, 'Neu laden mitten im Ausflug: Rucksack verloren, Waffe vom Aufbruch zurück');
    ok(rl2.armorNotDup, 'Neu laden: was in der Begleiter-Tasche lag, wird nicht verdoppelt');
    // Ohne Begleiter: nichts überlebt
    const np = await page.evaluate(() => {
      SAVE.meta.pets.act = null; lBegin(0); return 1;
    });
    await page.waitForTimeout(200);
    const np2 = await page.evaluate(() => {
      const bag0 = P.bag.length; LW.pack = [{ t: 'item', it: lItem(3, 1) }]; P.inv = 0; hurtPlayer(1e9, null); for (let i = 0; i < 300 && state === 'dead'; i++) update(.05);
      return { none: P.bag.length === bag0 && /Ohne Begleiter wurde nichts gerettet/.test(panel.textContent) };
    });
    ok(np2.none, 'Ohne Begleiter: beim Tod ist alles verloren');
    // Aufträge, Händler, Gefahr
    const ms = await page.evaluate(() => {
      const o = {}; ON.l_wake(); SAVE.meta.pets.act = SAVE.meta.pets.list[0].id; delete SAVE.meta.pets.list[0].hurt; lBegin(0); LW.misOn = true; LW.mis = lMisGen();
      o.mis = LW.mis.length >= 3 && LW.mis.every(m => m.txt && m.rew.length && m.rep > 0);
      const k = LW.mis.find(m => m.t === 'kills') || (LW.mis.push(Object.assign(lMisGen()[0], { t: 'kills', n: 2, c: 0, done: false })), LW.mis[LW.mis.length - 1]); k.n = 2; k.c = 0; k.done = false;
      lMisEvent('kill'); lMisEvent('kill'); o.done = k.done;
      const rep0 = SAVE.meta.lande.rep; ON.l_claim(null, null, LW.mis.indexOf(k)); o.claim = k.paid && SAVE.meta.lande.rep === rep0 + k.rep;
      LW.offers = [{ give: [{ t: 'gold', n: 50 }], get: { t: 'gem', k: 'rubin:1', n: 1 } }]; LW.pack = [{ t: 'gold', n: 60 }];
      ON.l_buyo(null, null, 0); o.trade = LW.pack.some(e => e.t === 'gem') && LW.pack.find(e => e.t === 'gold').n === 10;
      LW.t = 430; LW.tick = 0; lTick(.016); o.danger = LW.danger === 2; LW.t = 700; lTick(.016); o.rift = LW.cr > 0;
      return o;
    });
    ok(ms.mis && ms.done && ms.claim, 'Aufträge: werden erfüllt, Belohnung und Ruf bei Elwa');
    ok(ms.trade, 'Händler: Tausch mit dem, was im Rucksack ist');
    ok(ms.danger && ms.rift, 'Gefahr steigt mit der Zeit, die Verderbnis breitet sich aus');
    ok(!errs.length, 'keine Fehler (Regeln)' + (errs.length ? ': ' + errs.slice(0, 3).join(' | ') : ''));
    await page.close();
  }
  // Durchlauf mit Antippen auf dem Handy, hoch und quer
  for (const [W, H] of [[390, 844], [844, 390]]) {
    console.log(`Verlorene Lande – Antippen ${W}x${H}`);
    const ctx = await b.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: 'de-DE' });
    const page = await ctx.newPage();
    const errs = []; page.on('pageerror', e => errs.push(e.message)); page.on('console', m => { if (m.type() === 'error' && !/favicon|net::ERR/.test(m.text())) errs.push('console: ' + m.text()); });
    await page.goto(BASE + 'index.html'); await page.waitForTimeout(1500);
    await page.evaluate(STANDIN);
    await page.evaluate(([HERO_]) => { eval('(' + HERO_ + ')')('ranger', 12); SAVE.meta.pets.starter = true; petGive('eule', { nm: 'Hu', lv: 15 }); saveChar(); persist(); }, [HERO.toString()]);
    const tap = async sel => { const el = page.locator(sel).first(); await el.scrollIntoViewIfNeeded().catch(() => { }); try { await el.tap({ timeout: 4000 }); } catch (e) { throw new Error('Antippen ' + sel + ': ' + e.message.split('\n')[0]); } await page.waitForTimeout(300); };
    const inView = async sel => { const el = page.locator(sel).first(); if (!(await el.count())) return false; const r = await el.boundingBox(); return !!r && r.y >= 0 && r.y + r.height <= H + 1 && r.x >= 0 && r.x + r.width <= W + 1; };
    const shot = async n => page.screenshot({ path: `${OUT}/${W}x${H}_${n}.png` });
    const pre = `${W}x${H}: `;
    // Karte → Mehr → Verlorene Lande
    await page.evaluate(() => { P.map = genMap(3); openMap(); });
    await tap('[data-act="mapmore"]'); await tap('[data-act="l_open"]');
    ok(await inView('[data-act="l_go"]'), pre + 'Weltentor von der Karte: „Betreten“ ohne Scrollen sichtbar');
    await shot('01_gate_map'); await tap('[data-act="l_back"]');
    // Versteck: zum Weltentor laufen und antippen
    await page.evaluate(() => { enterHideout(); const p = hidePos('weltentor'); P.x = p.x; P.y = p.y + 22; }); await page.waitForTimeout(700);
    ok(await page.locator('#bAct').isVisible(), pre + 'Versteck: Weltentor zum Interagieren');
    await page.locator('#bAct').tap(); await page.waitForTimeout(400);
    ok((await page.evaluate(() => (panel.querySelector('h2') || {}).textContent)) === 'WELTENTOR' && /WAS DU RISKIERST/.test(await page.evaluate(() => panel.textContent)), pre + 'Weltentor: „Was du riskierst“ mit Ausrüstung, Begleiter und Regeln');
    await shot('02_gate');
    await tap('[data-act="l_go"]'); await page.waitForTimeout(1400);
    ok(await page.evaluate(() => landeActive() && state === 'play'), pre + 'Betreten: Ausflug läuft');
    for (const id of ['#lhMap', '#lhPack', '#lhT']) ok(await inView(id), pre + 'HUD sichtbar: ' + id);
    const over = await page.evaluate(() => { const a = $('lhud').getBoundingClientRect(), p = $('pauseBtn').getBoundingClientRect(), pot = $('bPot').getBoundingClientRect(), s3 = $('bUlt').getBoundingClientRect(); const hit = (x, y) => x.left < y.right && x.right > y.left && x.top < y.bottom && x.bottom > y.top; return hit(a, p) || hit(a, pot) || hit(a, s3); });
    ok(!over, pre + 'HUD überdeckt weder Pause, Trank noch Knöpfe');
    await shot('03_world');
    // Rucksack über das HUD
    await page.evaluate(() => { LW.pack.push({ t: 'item', it: lItem(2, 2) }, { t: 'gold', n: 120 }, { t: 'mat', k: 'erz', n: 6 }); });
    await page.locator('#lhPack').tap(); await page.waitForTimeout(400);
    ok(await page.evaluate(() => state === 'menu' && /RUCKSACK/.test(panel.textContent)), pre + 'Rucksack öffnet über das HUD');
    await tap('[data-act="l_sel"][data-id="p:0"]');
    ok(await inView('[data-act="l_tobag"]'), pre + 'Rucksack: „In die Begleiter-Tasche“ sichtbar');
    await shot('04_inv');
    await tap('[data-act="l_tobag"]');
    ok(await page.evaluate(() => lBag(LW.pet).length === 1 && LW.pack.length === 2), pre + 'Gegenstand liegt jetzt in der Begleiter-Tasche');
    await tap('[data-act="l_resume"]');
    await page.locator('#lhMap').tap(); await page.waitForTimeout(400);
    ok(await page.evaluate(() => !!$('lmapBig')), pre + 'Karte groß über die Minikarte');
    await shot('05_map'); await tap('[data-act="l_resume"]');
    // Kundschafterin: hinlaufen, Knopf, Aufträge
    await page.evaluate(() => { const o = LW.npcs.mis; P.x = o.x + 18; P.y = o.y + 8; P.inv = 999; for (const e of enemies) e.dead = true; }); await page.waitForTimeout(700);
    ok(await page.locator('#bAct').isVisible(), pre + 'Kundschafterin: Knopf zum Interagieren');
    await page.locator('#bAct').tap(); await page.waitForTimeout(400);
    ok(await page.evaluate(() => LW.misOn && LW.mis.length >= 3 && /AUFTRÄGE/.test(panel.textContent)), pre + 'Aufträge angenommen');
    await shot('06_missions'); await tap('[data-act="l_resume"]');
    // Händler
    await page.evaluate(() => { const o = LW.npcs.trade; P.x = o.x + 18; P.y = o.y + 8; }); await page.waitForTimeout(700);
    await page.locator('#bAct').tap(); await page.waitForTimeout(400);
    ok(await page.evaluate(() => /TAUSCH/.test(panel.textContent)), pre + 'Händler: Tauschangebote');
    await shot('07_trade'); await tap('[data-act="l_resume"]');
    // Kampf an einem Lager (ein paar Sekunden echte Spielzeit)
    await page.evaluate(() => { const c = LW.camps[0]; P.x = c.x + 60; P.y = c.y; keys.Space = true; });
    await page.waitForTimeout(2500); await shot('08_fight'); await page.evaluate(() => { keys.Space = false; });
    ok(await page.evaluate(() => enemies.some(e => e.lw) || LW.camps[0].state !== 'dorm'), pre + 'Lager erwacht, wenn du näher kommst');
    // Pause: Abbrechen statt Hauptmenü
    await page.evaluate(() => showPause()); await page.waitForTimeout(300);
    ok(await page.locator('[data-act="l_quit"]').count() === 1 && await inView('[data-act="l_inv"]') && !(await page.locator('[data-act="title"]').count()), pre + 'Pause: Rucksack und „Ausflug abbrechen“ statt Hauptmenü');
    await shot('09_pause');
    await tap('[data-act="l_quit"]'); await tap('[data-act="l_quitok"]');
    ok(await page.evaluate(() => G.type === 'versteck' && !landeActive() && SAVE.meta.lande.aband === 1 && P.bag.length >= 1), pre + 'Abbrechen: zurück im Versteck, Begleiter-Tasche geliefert');
    // Entkommen-Bildschirm
    await page.evaluate(() => { landeStart(0); }); await page.waitForTimeout(800);
    await page.evaluate(() => { for (let i = 0; i < 6; i++) LW.pack.push({ t: 'item', it: lItem(2, 3) }); LW.pack.push({ t: 'gold', n: 777 }); lExtract(); });
    await page.waitForTimeout(900);
    ok(await inView('[data-act="l_home"]'), pre + 'Entkommen: Liste der Beute, „Ins Versteck“ sichtbar');
    await shot('10_extract');
    await tap('[data-act="l_home"]');
    // Tod
    await page.evaluate(() => { landeStart(0); }); await page.waitForTimeout(800);
    await page.evaluate(() => { LW.pack.push({ t: 'item', it: lItem(3, 3) }); lBag(LW.pet).push({ t: 'item', it: lItem(3, 3) }); P.inv = 0; hurtPlayer(1e9, null); });
    await page.waitForTimeout(4500);
    ok(await page.evaluate(() => state === 'over') && await inView('[data-act="l_wake"]'), pre + 'Tod: Bildschirm mit Verlorenem und Gerettetem, Knopf sichtbar');
    await shot('11_death');
    await tap('[data-act="l_wake"]');
    ok(!errs.length, pre + 'keine Fehler' + (errs.length ? ': ' + errs.slice(0, 3).join(' | ') : ''));
    await ctx.close();
  }
  console.log('  Bilder: ' + OUT);
  await b.close();
  process.exit(fails.length ? 1 : 0);
})().catch(e => { console.log('  FAIL Abbruch: ' + e.message.split('\n')[0]); process.exit(1); });
