// Begleiter 2.0 (js/pets.js): Eier, Brutnest, 24 Kreaturen, Beutel, Verletzung, Tausch, Kampf je Art,
// erstes Ei vom ersten Boss → Pflege → Schlüpfen per Antippen auf dem Handy (hoch und quer), Bilder.
// Aufruf: node pets.js [ausgabeordner]   (BASE = Adresse des Spiels, Bilder nach /tmp/kh-b/screens)
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
    const o = {}, M = () => SAVE.meta.pets, H = 3600e3, now = Date.now();
    o.fresh = M() && !M().list.length && !M().eggs.length && M().act === null && M().first === false && M().intro === true && Array.isArray(M().seen) && !panel.querySelector('.petstart');
    o.api = ['petActive', 'petSel', 'petBagSize', 'petHurt', 'petIsHurt', 'eggGive', 'eggRoll', 'eggTierRoll', 'eggExport', 'petExport', 'petImport', 'petIconURL', 'petLabel', 'openNest', 'petBagAdd', 'petBagTake'].every(f => typeof window[f] === 'function') && PET_TIERS.length === 7 && PET_TIERS.every(t => t.n && t.c && t.egg);
    // alte und kaputte Daten: Begleiter bekommen Beutel/Verletzung, alte Eier (Siege) behalten ihren Anteil
    const m = fixMeta({ stats: {}, pets: { list: [{ sp: 'drache', lv: 999, xp: -5, col: 9 }, { sp: 'yeti', lv: 3 }, 'x', { sp: 'katze', id: 'a', nm: '<b>Mi</b>', lv: 7, xp: 1e12, col: 6, hurt: now + 99 * H, bag: [{ t: 'mat', k: 'glut', n: 3 }, { t: 'mat', k: 'laser', n: 1 }, { t: 'gold', n: -5 }, 'x'] }], eggs: [{ sp: 'eule', need: 150, got: 75 }, { sp: '??' }, { sp: 'natter', need: 150, got: 400 }, { sp: 'funke', need: 150, got: 0 }, { sp: 'katze', need: 150, got: 9 }], act: 'zzz', starter: true } });
    const L = m.pets.list, E = m.pets.eggs;
    o.fixPets = L.length === 2 && L[0].lv === 100 && L[0].xp === 0 && L[1].nm.indexOf('<') < 0 && L[1].col === 0 && L[1].xp < petNeed(7) && m.pets.act === null && L.every(p => Array.isArray(p.bag)) && L[1].bag.length === 2 && L[1].hurt <= now + 48 * H + 5000 && m.pets.seen.includes('drache') && m.pets.first === true;
    o.fixEggs = E.length === 4 && E.every(g => g.v === 2 && g.tier === PET_SP[g.sp].t && g.need === PET_TIERS[g.tier].care) && Math.abs(E[0].got / E[0].need - .5) < .01 && E[1].got === E[1].need && E.filter(g => g.nest).length === NEST_MAX && !E[3].nest;
    o.old = !!fixMeta({ stats: {} }).pets && fixMeta({ stats: {} }).pets.first === false;
    // EP-Kurve unverändert: schnell am Anfang, sehr lang am Ende
    let sum = 0; const tot = {}; for (let l = 1; l < 100; l++) { sum += petNeed(l); if (l === 9 || l === 24 || l === 99) tot[l + 1] = sum; } o.tot = tot;
    o.stage = [1, 9, 10, 24, 25, 49, 50, 74, 75, 99, 100].map(petStage).join('');
    // 24 Arten in 7 Seltenheiten, jede wird mit jeder Stufe größer, sechs Farben
    o.n = PET_ORDER.length; o.byTier = PET_BYT.map(l => l.length);
    o.grow = PET_ORDER.filter(sp => { let a = 0; for (let s = 0; s < 6; s++) { const S = petStrip(sp, s, 0, false), v = S.W * S.H; if (v <= a) return true; a = v; } return false; });
    o.vars = PET_ORDER.every(sp => petVariants(sp).length === 6) && !!petStrip('wal', 2, 6, true).c;
    o.data = PET_ORDER.every(sp => { const S = PET_SP[sp]; return S.n && S.an && S.ad && S.pn && S.sn && S.sd && S.st && PET_EL[S.el] && MATS[S.fav] && ['fire', 'ice', 'beam', 'zap', 'claw', 'bite', 'spit'].includes(S.atk) && ['breath', 'leap', 'nova', 'freeze', 'cloud', 'storm'].includes(S.spec) && Object.keys(S.pas).every(k => PET_PASTXT[k]); });
    o.eggArt = [0, 1, 2, 3, 4, 5, 6].every(t => eggURL(t, 0).startsWith('data:image') && eggURL(t, 3, 'feuer') !== eggURL(t, 0)) && new Set([0, 1, 2, 3, 4, 5, 6].map(t => eggURL(t, 0))).size === 7;
    // Seltenheit würfeln: Kampagne meist Plunder/Gewöhnlich, Mythisch extrem selten; mehr Glück → seltener
    const roll = luck => { const c = [0, 0, 0, 0, 0, 0, 0]; for (let i = 0; i < 40000; i++) c[eggTierRoll(luck)]++; return c.map(x => x / 400); };
    o.r0 = roll(0); o.r4 = roll(4); o.r2 = roll(2);
    o.avg = [0, 1, 2, 3, 4].map(l => roll(l).reduce((s, p, t) => s + p * t, 0));
    o.eggRoll = PET_TIERS.every((_, t) => { for (let i = 0; i < 30; i++) if (PET_SP[eggRoll(t)].t !== t) return false; return true; });
    // Held, Ei geben, Nest, Korb
    const c = newChar('knight', 'Test', 'normal', false); SAVE.chars.push(c); activateChar(0); P.lv = 30; computeStats();
    const g1 = eggGive(null, true, { tier: 6 }); o.give = !!g1 && g1.tier === 6 && g1.nest === 1 && PET_SP[g1.sp].t === 6;
    eggGive('maus', true); eggGive('drache', true); const g4 = eggGive('schnecke', true);
    o.nest = nestEggs().length === NEST_MAX && g4.nest === 0;
    for (let i = 0; i < 10; i++) eggGive(null, true); o.eggMax = M().eggs.length === EGG_MAX && eggGive('wal', true) === false;
    // Pflege in Echtzeit: wächst nur, solange Wärme, Futter, Zuwendung nicht leer; alles über 70 % = ×1,5
    M().eggs = []; const g = eggGive('maus', true), T0 = PET_TIERS[g.tier];
    g.t = now - 10 * 60e3; eggSim(g, now); o.noCare = g.got === 0;
    Object.assign(g, { w: 1, f: 1, z: 1, t: now - 10 * 60e3 }); eggSim(g, now); o.cozy = Math.abs(g.got - 900) < 1;
    Object.assign(g, { got: 0, w: .5, f: .5, z: .5, t: now - 10 * 60e3 }); eggSim(g, now); o.plain = Math.abs(g.got - 600) < 1;
    // offline: drei Tage weg → wächst nur, bis das erste Bedürfnis leer ist
    Object.assign(g, { got: 0, w: 1, f: 1, z: 1, t: now - 72 * H }); eggSim(g, now); o.offline = g.got === g.need && g.z === 0;
    const ge = eggGive('wal', true); Object.assign(ge, { got: 0, w: 1, f: 1, z: 1, t: now - 72 * H }); eggSim(ge, now); const zmax = T0 && PET_TIERS[6].dur[2] * 3600; o.offCap = ge.got > 0 && ge.got <= zmax * 1.5 + 1 && ge.z === 0;
    // Uhr zurückgestellt: kein Wachstum, kein Absturz
    Object.assign(ge, { got: 100, w: 1, f: 1, z: 1, t: now + 5 * H }); eggSim(ge, now); o.clock = ge.got === 100 && ge.t === now;
    // Pflegen: Wärmen gratis, Füttern kostet das passende Futter, Streicheln +34 %
    P.mats = {}; P.gold = 0; Object.assign(g, { got: 0, w: 0, f: 0, z: 0, t: now }); eggWarm(g); o.warm = g.w === 1;
    o.feedNo = !eggFeed(g) && g.f === 0; P.mats.leder = 5; o.feed = eggFeed(g) && g.f === 1 && P.mats.leder === 2;
    const gw = M().eggs.find(x => x.sp === 'wal'); P.mats.leder = 99; gw.f = 0; o.rareFood = !eggFeed(gw); P.mats.stern = 1; o.rareFood = o.rareFood && eggFeed(gw) && P.mats.stern === 0;
    eggPet(g); eggPet(g); o.pet = Math.abs(g.z - .68) < .01; eggPet(g); eggPet(g); o.pet = o.pet && g.z === 1;
    const V = eggView(g); o.view = V.grow && V.cozy && !V.ready && V.eta > 0 && V.until > 0;
    // Schlüpfen: neue Art in der Sammlung, schillernd mit 1 %
    g.got = g.need; const n0 = M().list.length, R = Math.random; Math.random = () => .005;
    const p1 = eggHatch(M().eggs.indexOf(g), true); Math.random = R;
    o.hatch = !!p1 && p1.sp === 'maus' && p1.shiny && p1.col === 6 && M().list.length === n0 + 1 && M().seen.includes('maus') && M().act === p1.id && M().hatched === 1;
    o.notReady = eggHatch(M().eggs.indexOf(gw), true) === null;
    // Erstes Ei: garantiert vom ersten besiegten Boss der Geschichte, danach 3 %
    M().first = false; M().eggs = []; G = { type: 'boss', row: 6 }; P.act = 1;
    Math.random = () => .9; petKill({ xp: 1, x: 0, y: 0, boss: true }); Math.random = R;
    o.first = M().eggs.length === 1 && M().first === true && M().intro === false && M().eggs[0].tier >= 1 && M().eggs[0].tier <= 3;
    Math.random = () => .2; petKill({ xp: 1, x: 0, y: 0, boss: true }); Math.random = R; o.second = M().eggs.length === 1;
    Math.random = () => .05; petKill({ xp: 1, x: 0, y: 0, boss: true }); Math.random = R; o.bossEgg = M().eggs.length === 2;
    M().first = false; G = { type: 'kampf', row: 2 }; Math.random = () => .9; petKill({ xp: 1, x: 0, y: 0, boss: true }); Math.random = R; o.firstOnlyBossRoom = M().eggs.length === 2 && M().first === false; M().first = true; G = null;
    // Stärke nach Seltenheit, Passiv wie bisher (Glutherz 3 % → 15 %)
    o.mul = Math.abs(petDmgK(50, 'schnecke') / petDmgK(50, 'wal') - .3 / 1.6) < 1e-9 && Math.abs(petDmgK(50, 'katze') - petDmgK(50)) < 1e-9;
    M().list = []; M().act = null; const pd = petGive('drache', { lv: 25 }); computeStats(); const d25 = P.st.m.dmg || 0; pd.lv = 100; computeStats(); o.pas = Math.abs(d25 - .03) < 1e-6 && Math.abs((P.st.m.dmg || 0) - .15) < 1e-6;
    // Beutel: Plätze nach Seltenheit, +1 ab Uralt
    o.bag = petBagSize({ sp: 'schnecke', lv: 1 }) === 1 && petBagSize({ sp: 'katze', lv: 1 }) === 2 && petBagSize({ sp: 'drache', lv: 74 }) === 3 && petBagSize({ sp: 'drache', lv: 75 }) === 4 && petBagSize({ sp: 'wal', lv: 100 }) === 6;
    pd.lv = 30; o.bagAdd = petBagAdd(pd, { t: 'mat', k: 'glut', n: 4 }) && petBagAdd(pd, { t: 'gold', n: 50 }) && petBagAdd(pd, { t: 'gem', k: 'rubin:2', n: 1 }) && !petBagAdd(pd, { t: 'mat', k: 'erz', n: 1 }) && !petBagAdd(pd, { t: 'mat', k: 'nix', n: 1 }) && pd.bag.length === 3;
    // Verletzung: kämpft nicht, keine Passivkraft, heilt mit der Zeit oder Heiltrank
    petHurt(pd, 30); computeStats(); o.hurt = petIsHurt(pd) && petActive() === null && petSel() === pd && !(P.st.m.dmg > 0) && petHurtLeft(pd) > 29 * 60e3;
    pd.hurt = Date.now() - 1; o.healTime = petActive() === pd;
    petHurt(pd, 60); P.potions = 2; ON.petheal(pd.id, null, 0); o.healPot = !petIsHurt(pd) && P.potions === 1;
    // Tausch: der Beutel geht vorher an den Absender, Ei-Codes verraten nur die Seltenheit
    const gold0 = P.gold, glut0 = P.mats.glut || 0; petGive('wal', { nm: 'Moby', lv: 40 });
    const i0 = M().list.indexOf(pd), d = petExport(i0);
    o.exp = !!d && !d.bag && P.gold === gold0 + 50 && P.mats.glut === glut0 + 4 && P.gems['rubin:2'] >= 1 && !M().list.includes(pd);
    o.imp = petImport(d) && M().list[M().list.length - 1].bag.length === 0 && M().list[M().list.length - 1].lv === 30;
    o.impBad = !petImport({ sp: 'yeti' }) && !petImport(null) && !petImport('x');
    M().eggs = []; eggGive('einhorn', true); const ed = eggExport(0);
    o.eggTrade = !!ed && ed.egg && ed.tier === 5 && !M().eggs.length && petImport(ed) && M().eggs.length === 1 && M().eggs[0].got === 0 && petLabel(ed) === PET_TIERS[5].egg && petIconURL(ed).startsWith('data:image') && petIconURL({ sp: 'wal', lv: 80 }).startsWith('data:image');
    while (M().list.length < PET_MAX) petGive('taube', {}); o.full = !petGive('drache', {}) && !petImport({ sp: 'katze', lv: 3 }) && petFree() === 0;
    // Sammlung: Glücksmünzen bei 4, 8, … Arten, jede nur einmal
    M().seen = ['maus', 'drache', 'wal']; M().cw = 0; const f0 = P.fate; petSeen('katze'); o.cw = P.fate === f0 + 2 && M().cw === 1; petSeen('katze'); o.cw = o.cw && P.fate === f0 + 2;
    // Drachentruhe: 10 % Ei mit etwas mehr Glück
    P.fate = 99; SAVE.meta.hide.b.tempel = 1; M().eggs = []; Math.random = () => .02; try { openChestLuck('drache'); } finally { Math.random = R; } ON.rollskip(); o.chestEgg = M().eggs.length === 1 && panel.textContent.includes('Begleiter-Ei');
    M().eggs = []; Math.random = () => .5; try { openChestLuck('drache'); } finally { Math.random = R; } ON.rollskip(); o.chestNoEgg = M().eggs.length === 0;
    // Speichern
    eggGive('wal', true); persist(); const saved = JSON.parse(localStorage.getItem(SAVE_KEY)).meta.pets; o.saved = saved.list.length === PET_MAX && saved.eggs[0].v === 2 && saved.eggs[0].sp === 'wal' && Array.isArray(saved.list[0].bag) && saved.seen.length >= 4;
    return o;
  });
  ok(r.fresh, 'neues Konto: keine Begleiter, kein Starter-Dialog, erstes Ei noch offen');
  ok(r.api, 'Schnittstelle: petActive, petSel, petBagSize, petHurt, petIsHurt, eggGive, eggRoll, eggTierRoll, PET_TIERS …');
  ok(r.old, 'alter Spielstand ohne Begleiter bekommt die Felder');
  ok(r.fixPets, 'kaputte Begleiter werden repariert (Level, EP, Farbe, Name, Beutel, Verletzung höchstens 2 Tage)');
  ok(r.fixEggs, 'alte Eier (Siege) werden zu Brutnest-Eiern und behalten ihren Fortschritt, höchstens 3 im Nest');
  ok(r.tot[10] > 3e4 && r.tot[10] < 15e4 && r.tot[25] > 1e6 && r.tot[100] > 2e8 && r.stage === '00112233445', `EP-Kurve und Entwicklungsstufen unverändert (LV 100: ${r.tot[100]} EP)`);
  ok(r.n === 24 && r.byTier.every(n => n >= 2), `24 Arten in 7 Seltenheiten (${r.byTier.join('/')})`);
  ok(!r.grow.length, 'jede Art wird mit jeder Stufe größer' + (r.grow.length ? ': ' + r.grow.join(', ') : ''));
  ok(r.vars && r.data, 'jede Art: Texte, Element, Angriff, Spezialangriff, Passiv, sechs Farben, schillernd');
  ok(r.eggArt, 'Eier sehen je Seltenheit anders aus, Risse und Element-Schimmer');
  ok(r.r0[0] + r.r0[1] > 55 && r.r0[6] < .5 && r.r0[5] < 3, `Kampagne: ${r.r0.map(x => x.toFixed(1)).join(' / ')} % (Plunder … Mythisch)`);
  ok(r.r4[5] + r.r4[6] > 12 && r.r4[6] > 1 && r.r4[6] < 6, `Glück 4 (Abgrund): ${r.r4.map(x => x.toFixed(1)).join(' / ')} %`);
  ok(r.avg.every((a, i) => !i || a > r.avg[i - 1]), `mehr Glück → seltenere Eier (Schnitt ${r.avg.map(a => a.toFixed(2)).join(' → ')})`);
  ok(r.eggRoll && r.give, 'eggRoll(tier) und eggGive(null, quiet, { tier }) liefern die richtige Seltenheit');
  ok(r.nest && r.eggMax, `höchstens ${3} Eier im Nest, Korb voll bei 9 → eggGive false`);
  ok(r.noCare && r.plain && r.cozy, 'Ei wächst nur mit Wärme, Futter und Zuwendung; alles über 70 % → 1,5× so schnell');
  ok(r.offline && r.offCap, 'offline: wächst weiter, bis das erste Bedürfnis leer ist (Vernachlässigung pausiert, kein Tod)');
  ok(r.clock, 'zurückgestellte Uhr: kein Wachstum, kein Fehler');
  ok(r.warm && r.feedNo && r.feed && r.rareFood && r.pet, 'Wärmen gratis, Füttern mit passendem Material (seltene Eier: seltenes Futter), Streicheln +34 %');
  ok(r.view, 'Anzeige: wächst, wohlig, Zeit bis leer, Schlüpfzeit');
  ok(r.hatch && r.notReady, 'Schlüpfen: Begleiter der Art, schillernd mit 1 %, Sammlung, nicht vor der Zeit');
  ok(r.first && r.second && r.bossEgg && r.firstOnlyBossRoom, 'erstes Ei garantiert vom ersten Boss der Geschichte (meist gewöhnlich), danach 10 %');
  ok(r.mul && r.pas, 'Schaden nach Seltenheit (Plunder 0,3 … Mythisch 1,6), Passiv der alten Arten unverändert');
  ok(r.bag && r.bagAdd, 'Beutel: Plätze nach Seltenheit, +1 ab Uralt, nur gültige Beute');
  ok(r.hurt && r.healTime && r.healPot, 'Verletzung: kämpft nicht, keine Passivkraft; heilt mit der Zeit oder per Heiltrank');
  ok(r.exp && r.imp && r.impBad && r.eggTrade, 'Tausch: Beutel geht an den Absender, Neuer kommt leer an; Ei-Code zeigt nur die Seltenheit');
  ok(r.full, `höchstens ${18} Begleiter`);
  ok(r.cw, 'Sammlung: Glücksmünzen bei 4 entdeckten Arten, nur einmal');
  ok(r.chestEgg && r.chestNoEgg, 'Drachentruhe: Begleiter-Ei mit 10 %');
  ok(r.saved, 'alles wird gespeichert');

  // Kampf: jede Art auf drei Stufen, Spezialangriffe ab LV 50, Versteck, verletzt
  console.log('Begleiter: Kampf');
  const k = await page.evaluate(() => {
    const res = {}, M = SAVE.meta.pets; let spec = 0; const os = petSpecial; petSpecial = function (...a) { spec++; return os(...a); };
    for (const sp of PET_ORDER) for (const lv of [1, 30, 60]) {
      M.list = []; M.act = null; petGive(sp, { lv }); P.lv = 30; computeStats();
      startRoom('kampf', 2); G.waves = []; G.phase = 'fight'; G.pending = []; enemies = []; P.inv = 999;
      for (let i = 0; i < 4; i++) { const e = spawnEnemy('orc', { x: P.x + 40 + i * 12, y: P.y + (i % 2 ? 14 : -14), instant: true }); e.hp = e.maxHp = 1e6; e.spd = 0; e.atk = 0; }
      spec = 0; for (let f = 0; f < 60 * 14; f++) update(1 / 60);
      res[sp + lv] = { dmg: enemies.some(e => e.hp < e.maxHp), spec, inBD: PET_RT.x >= BD.x0 && PET_RT.x <= BD.x1 && PET_RT.y >= BD.y0 && PET_RT.y <= BD.y1 };
    }
    petSpecial = os;
    M.list = []; M.act = null; const p = petGive('wolf', { lv: 40 }); enterHideout(); hideOverlay(); setState('play'); const pos = [];
    for (let f = 0; f < 60 * 15; f++) { update(1 / 60); if (f % 60 === 0) pos.push([PET_RT.x, PET_RT.y]); }
    res.hideMove = pos.some(([x, y]) => Math.hypot(x - pos[0][0], y - pos[0][1]) > 8);
    // verletzt: bleibt im Versteck liegen, kämpft nicht mit
    petHurt(p, 20); startRoom('kampf', 1); for (let f = 0; f < 120; f++) update(1 / 60); res.hurtNoFight = PET_RT.id === null;
    p.hurt = 0; M.act = null; startRoom('kampf', 1); for (let f = 0; f < 60; f++) update(1 / 60); enterHideout(); for (let f = 0; f < 60; f++) update(1 / 60);
    openChar('pet'); res.noPet = !!panel.querySelector('.petcard'); M.list = []; openChar('pet'); res.noPetList = panel.textContent.includes('Brutnest');
    return res;
  });
  const bad = PET_ORDER_ALL().filter(sp => ![1, 30, 60].every(lv => k[sp + lv].dmg && k[sp + lv].inBD));
  ok(!bad.length, 'alle 24 Arten greifen auf allen Stufen an und bleiben in der Arena' + (bad.length ? ': ' + bad.join(', ') : ''));
  const badS = PET_ORDER_ALL().filter(sp => !(k[sp + 1].spec === 0 && k[sp + 30].spec === 0 && k[sp + 60].spec > 0));
  ok(!badS.length, 'Spezialangriffe erst ab LV 50, bei allen Arten' + (badS.length ? ': ' + badS.join(', ') : ''));
  ok(k.hideMove && k.hurtNoFight, 'Versteck: Begleiter streunt; verletzt kämpft er nicht mit');
  ok(k.noPet && k.noPetList, 'ohne aktiven Begleiter: Raum, Versteck und Reiter laufen');
  ok(!errs.length, 'keine Fehler (Regeln, Kampf)' + (errs.length ? ': ' + errs.slice(0, 3).join(' | ') : ''));
  await page.close();

  // Alter Spielstand mit Begleiter-Wahl ausstehend: kein Starter-Dialog mehr, alte Eier im Brutnest
  console.log('Begleiter: alter Spielstand');
  {
    const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, locale: 'de-DE', deviceScaleFactor: 2 });
    const pg = await ctx.newPage(); const e2 = []; pg.on('pageerror', e => e2.push(e.message));
    await pg.goto(BASE + 'index.html'); await pg.waitForTimeout(800);
    await pg.evaluate(() => { localStorage.clear(); const c = newChar('rogue', 'Altheld', 'normal', false); c.lv = 18; c.act = 3; const s = { v: 3, chars: [c], active: 0, meta: { stats: {}, ach: {}, bestiary: {}, settings: { music: true, sfx: true }, seenVer: VERSION, pets: { list: [{ id: 'k1', sp: 'katze', lv: 33, xp: 5, c0: 1, col: 1 }], act: 'k1', eggs: [{ sp: 'drache', need: 150, got: 120 }], starter: true, hatched: 2 } } }; localStorage.setItem(SAVE_KEY, JSON.stringify(s)); });
    await pg.reload(); await pg.waitForTimeout(1500);
    const s = await pg.evaluate(() => ({ starter: !!panel.querySelector('.petstart'), pet: petActive() && petActive().sp, egg: SAVE.meta.pets.eggs[0], btn: !!panel.querySelector('[data-act="nestopen"]'), title: !!panel.querySelector('.logo') }));
    ok(!s.starter && s.title && s.pet === 'katze', 'alter Spielstand: Geisterkatze bleibt, kein Starter-Dialog');
    ok(s.egg && s.egg.v === 2 && s.egg.nest && Math.abs(s.egg.got / s.egg.need - .8) < .01 && s.btn, 'altes Ei (120/150 Siege) liegt mit 80 % im Brutnest, Titel zeigt „Brutnest“');
    await pg.screenshot({ path: `${OUT}/01_title_alt.png` });
    await pg.locator('[data-act="nestopen"]').first().tap(); await pg.waitForTimeout(400);
    ok(await pg.locator('.nestscr').count() === 1, 'Titel → Brutnest');
    await pg.screenshot({ path: `${OUT}/02_nest_alt.png` });
    await pg.locator('[data-act="nestback"]').tap(); await pg.waitForTimeout(300);
    ok(await pg.evaluate(() => !!panel.querySelector('.logo')), 'Zurück zum Titel');
    ok(!e2.length, 'keine Fehler (alter Spielstand)' + (e2.length ? ': ' + e2.slice(0, 3).join(' | ') : ''));
    await ctx.close();
  }

  // Handy: neuer Held → erster Boss → Ei → Hedda → Brutnest → pflegen → Schlüpfen → Reiter → Versteck
  for (const [W, H, tag] of [[390, 844, 'hoch'], [844, 390, 'quer']]) {
    console.log(`Begleiter: Handy ${W}x${H}`);
    const ctx = await b.newContext({ viewport: { width: W, height: H }, isMobile: true, hasTouch: true, locale: 'de-DE', deviceScaleFactor: 2 });
    const pg = await ctx.newPage(); const e3 = []; pg.on('pageerror', e => e3.push(e.message)); pg.on('console', m => { if (m.type() === 'error' && !/favicon|net::ERR/.test(m.text())) e3.push('console: ' + m.text()); });
    await pg.goto(BASE + 'index.html'); await pg.evaluate(() => localStorage.clear()); await pg.reload(); await pg.waitForTimeout(1500);
    const tap = async (sel, wait) => { const el = pg.locator(sel).first(); await el.scrollIntoViewIfNeeded().catch(() => { }); await el.tap({ timeout: 4000 }); await pg.waitForTimeout(wait || 250); };
    const inView = async sel => { const el = pg.locator(sel).first(); if (!(await el.count())) return false; const r = await el.boundingBox(); return !!r && r.y >= 0 && r.y + r.height <= H + 1 && r.x >= 0 && r.x + r.width <= W + 1; };
    const shot = async (name, fn, wait) => { if (fn) await pg.evaluate(fn); await pg.waitForTimeout(wait || 400); await pg.screenshot({ path: `${OUT}/${name}_${tag}.png` }); };
    const noOverflow = () => pg.evaluate(() => panel.scrollWidth <= panel.clientWidth + 1);
    await tap('[data-act="new"]'); await tap('[data-act="cstart"]');
    let sawStarter = false;
    for (let i = 0; i < 15 && await pg.locator('[data-act="dlgnext"]').count(); i++) { if (await pg.locator('.petstart, [data-act="petpick"]').count()) sawStarter = true; await tap('[data-act="dlgnext"]'); }
    ok(!sawStarter, 'kein Starter-Dialog nach dem Prolog');
    ok((await pg.evaluate(() => state)) === 'map' && (await pg.evaluate(() => !SAVE.meta.pets.list.length && !SAVE.meta.pets.eggs.length)), 'neuer Held auf der Karte – ohne Begleiter und ohne Ei');
    // erster Boss: wirklich besiegen (Kill-Hook), dann durch Raum-Ende, Akt-Bild und Geschichte tippen
    await pg.evaluate(() => { hideOverlay(); P.lv = 12; computeStats(); P.hp = P.st.hp; P.map.pos = { r: 5, i: 0 }; startRoom('boss', 6); P.inv = 999; });
    let egg = false;
    for (let i = 0; i < 60 && (await pg.evaluate(() => state)) === 'play'; i++) { const got = await pg.evaluate(() => { P.inv = 999; for (const e of enemies) if (!e.dead && e.st !== 'spawn') hurtEnemy(e, 1e9, 0, 0, 0); return SAVE.meta.pets.eggs.length > 0; }); egg = egg || got; await pg.waitForTimeout(250); }
    egg = egg || await pg.evaluate(() => SAVE.meta.pets.eggs.length > 0);
    ok(egg && await pg.evaluate(() => SAVE.meta.pets.first && SAVE.meta.pets.eggs[0].tier >= 1), 'erster Boss besiegt: garantiertes Begleiter-Ei');
    let hedda = false;
    for (let i = 0; i < 14 && !(await pg.locator('.nestscr').count()); i++) {
      if (await pg.evaluate(() => panel.textContent.includes('Nestmutter Hedda') && !!panel.querySelector('.dlg'))) { if (!hedda) await shot('03_hedda'); hedda = true; }
      const btn = pg.locator('#panel [data-act="dlgnext"], #panel [data-act="actnext"], #panel .btn:not(:disabled)').first(); if (await btn.count()) await btn.tap().catch(() => { }); await pg.waitForTimeout(450);
    }
    ok(hedda && await pg.locator('.nestscr').count() === 1, 'Hedda erklärt das erste Ei, danach öffnet sich das Brutnest');
    await shot('04_nest_erstes_ei');
    ok(await inView('[data-act="nestall"]') && await inView('.negg'), 'Brutnest: „Alle wärmen und füttern“ und das Ei ohne Scrollen sichtbar');
    ok(await pg.evaluate(() => panel.textContent.includes('Pausiert')), 'Ei ohne Pflege: „Pausiert“ mit Grund');
    // pflegen: alles wärmen + füttern, dreimal streicheln
    await pg.evaluate(() => { for (const k of MATORDER) P.mats[k] = 9; });
    await tap('[data-act="nestall"]');
    for (let i = 0; i < 3; i++) await tap('.negg', 120);
    const care = await pg.evaluate(() => { const g = SAVE.meta.pets.eggs[0], V = eggView(g); return { w: g.w, f: g.f, z: g.z, grow: V.grow, cozy: V.cozy, txt: panel.textContent.includes('Wächst') }; });
    ok(care.w > .99 && care.f > .99 && care.z > .99 && care.grow && care.cozy && care.txt, 'gepflegt: Wärme, Futter, Zuwendung voll – das Ei wächst wohlig');
    await shot('05_nest_gepflegt', null, 200);
    ok(await noOverflow(), 'Brutnest: kein seitliches Scrollen');
    // Zeit vergeht (auch bei geschlossenem Spiel) → bereit
    await pg.evaluate(() => { const g = SAVE.meta.pets.eggs[0]; g.t -= g.need / 1.4 * 1000; persist(); openNest(); });
    await pg.waitForTimeout(300);
    ok(await pg.evaluate(() => eggView(SAVE.meta.pets.eggs[0]).ready && panel.textContent.includes('bereit')), 'nach der Pflegezeit: bereit zum Schlüpfen');
    await shot('06_nest_bereit');
    await tap('.nsum [data-act="nesthatch"]', 900);
    await shot('07_schluepfen', null, 100);
    await tap('#hatchcv', 1200);
    ok(await pg.locator('[data-act="hatchok"]').count() === 1, 'Schlüpfen: Animation, Antippen überspringt, Kreatur wird gezeigt');
    await shot('08_geschluepft');
    const sp = await pg.evaluate(() => { const M = SAVE.meta.pets; return M.list.length === 1 && M.act === M.list[0].id && !M.eggs.length && M.seen.length === 1 ? M.list[0].sp : null; });
    ok(!!sp, `der erste Begleiter: ${sp} begleitet dich`);
    await tap('[data-act="hatchok"]');
    ok(await pg.locator('.nestscr').count() === 1, 'Weiter → zurück ins Brutnest');
    await tap('[data-act="nestback"]', 400);
    ok((await pg.evaluate(() => state)) === 'map', 'Brutnest → Weltkarte');
    // Reiter BEGLEITER: Seltenheit, Beutel, Eier, Sammlung; mehrere Begleiter
    await pg.evaluate(() => {
      const M = SAVE.meta.pets; M.list[0].lv = 27; M.list[0].nm = 'Pips';
      petGive('wal', { lv: 80 }); petGive('fuchs', { lv: 12 }); petGive('schnecke', { lv: 3, nw: 1 }); petGive('einhorn', { lv: 55, shiny: true });
      M.list[1].bag = [{ t: 'mat', k: 'stern', n: 3 }, { t: 'gold', n: 500 }, { t: 'egg', d: { sp: 'greif' } }];
      eggGive('greif', true); eggGive('kroete', true); eggGive('igel', true); for (const k of MATORDER) P.mats[k] = 25; P.potions = 3; P.mats.schleim = 9;
    });
    await tap('[data-act="char"]'); await tap('[data-act="ctab"][data-id="pet"]');
    ok(await pg.locator('.petcard').count() === 1 && await inView('.petprev'), 'Reiter BEGLEITER geöffnet, Vorschau sichtbar');
    await shot('09_reiter');
    await tap('[data-act="petsel"][data-id="' + await pg.evaluate(() => SAVE.meta.pets.list[1].id) + '"]');
    ok(await pg.evaluate(() => panel.textContent.includes('BEUTEL 3/6') && panel.textContent.includes('Mythisch')), 'Sternenwal: Mythisch, Beutel 3/6');
    await shot('10_reiter_wal', () => { panel.scrollTop = 0; });
    const st0 = await pg.evaluate(() => P.mats.stern);
    await tap('[data-act="petbag"]');
    const bg = await pg.evaluate(s => ({ stern: P.mats.stern - s, bag: SAVE.meta.pets.list[1].bag.length, eggs: SAVE.meta.pets.eggs.length, korb: SAVE.meta.pets.eggs.filter(g => !g.nest).length }), st0);
    ok(bg.stern === 3 && bg.bag === 0 && bg.eggs === 4 && bg.korb === 1, 'Beutel ausräumen: Beute geht an den Helden (auch das Ei) ' + JSON.stringify(bg));
    // Verletzt: Heiltrank geben
    await pg.evaluate(() => { const p = SAVE.meta.pets.list[1]; SAVE.meta.pets.act = p.id; petHurt(p, 40); openChar('pet'); panel.scrollTop = 0; });
    ok(await pg.evaluate(() => panel.textContent.includes('Verletzt')), 'verletzter Begleiter: Hinweis mit Restzeit');
    await shot('11_reiter_verletzt');
    await tap('.petcard [data-act="petheal"][data-i="0"]');
    ok(await pg.evaluate(() => !petIsHurt(SAVE.meta.pets.list[1]) && P.potions === 2), 'Heiltrank heilt sofort');
    await shot('12_reiter_unten', () => { panel.scrollTop = 99999; });
    ok(await noOverflow(), 'Reiter: kein seitliches Scrollen');
    await tap('[data-act="nestopen"]');
    ok(await pg.locator('.nestscr').count() === 1, 'Reiter → Brutnest');
    await tap('[data-act="nestout"]');
    ok(await pg.evaluate(() => nestEggs().length === 2 && SAVE.meta.pets.eggs.filter(g => !g.nest).length === 2), 'Ei aus dem Nest in den Korb gelegt');
    await tap('[data-act="nestput"]');
    ok(await pg.evaluate(() => nestEggs().length === 3), 'Ei aus dem Korb ins Nest gelegt');
    await shot('13_nest_voll', () => { panel.scrollTop = 0; });
    await tap('[data-act="nestback"]');
    ok(await pg.evaluate(() => !!panel.querySelector('.petcard')), 'Brutnest → zurück in den Reiter');
    await tap('[data-act="cback"]');
    // Versteck: Brutnest-Station mit Eiern und Hedda, Interagieren öffnet das Nest
    await pg.evaluate(() => { SAVE.meta.hide.intro = true; });
    await tap('[data-act="hide"]', 1200);
    await shot('14_versteck', () => { const p = hidePos('brutnest'); P.x = p.x + 60; P.y = p.y - 40; }, 900);
    await pg.evaluate(() => { const p = hidePos('brutnest'); P.x = p.x; P.y = p.y + 16; }); await pg.waitForTimeout(500);
    await pg.locator('#bAct').tap(); await pg.waitForTimeout(400);
    ok(await pg.evaluate(() => (panel.querySelector('h2') || {}).textContent === 'BRUTNEST'), 'Versteck: Brutnest-Station öffnet das Nest');
    await tap('[data-act="nestback"]', 500);
    ok((await pg.evaluate(() => state)) === 'play' && (await pg.evaluate(() => G && G.type)) === 'versteck', 'Zurück ins Versteck');
    // Kämpfe: Bilder einiger Arten
    for (const [s2, lv, room] of [['wal', 80, 'kampf'], ['fuchs', 55, 'elite'], ['schnecke', 30, 'kampf'], ['einhorn', 100, 'boss']]) {
      await pg.evaluate(([sp, lv, room]) => { hideOverlay(); setState('play'); const M = SAVE.meta.pets; const p = M.list.find(x => x.sp === sp); p.lv = lv; p.hurt = 0; M.act = p.id; P.lv = 40; computeStats(); P.hp = P.st.hp; startRoom(room, room === 'boss' ? 6 : 3); P.inv = 999; }, [s2, lv, room]);
      await pg.waitForTimeout(room === 'boss' ? 4200 : 3400); await shot(`15_kampf_${s2}_${lv}`);
    }
    await pg.evaluate(() => { hideOverlay(); titleScene(); showTitle(); }); await pg.waitForTimeout(300);
    ok(await pg.locator('[data-act="nestopen"]').count() === 1, 'Titel: Knopf „Brutnest“');
    await shot('16_titel');
    ok(!e3.length, 'keine Fehler auf dem Handy' + (e3.length ? ': ' + e3.slice(0, 3).join(' | ') : ''));
    await ctx.close();
  }
  console.log('  Bilder: ' + OUT);
  await b.close();
  process.exit(fails.length ? 1 : 0);
})().catch(e => { console.log('  FAIL Abbruch: ' + e.message.split('\n')[0]); process.exit(1); });
function PET_ORDER_ALL() { return ['schnecke', 'assel', 'taube', 'maus', 'kroete', 'huhn', 'fuchs', 'igel', 'fleder', 'irrlicht', 'katze', 'natter', 'eule', 'kaefer', 'drache', 'funke', 'golem', 'wolf', 'phoenix', 'greif', 'eisdrache', 'einhorn', 'schlange', 'wal']; }
