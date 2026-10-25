// Elemente & Schmiede der Meister (5.0): Regeln, Antippen auf dem Handy, Bildschirmfotos.
// Aufruf: node forge.js [ausgabeordner]   (BASE = lokale Version, Standard http://localhost:8777/)
// Prüft Schwächen/Resistenzen, Element-Effekte, Rüstungsschutz, Bauteile (Beute, Kombinieren, Zerlegen),
// Meisterwerke (Werte, Seltenheit, Umbau), Schmiedemeisterschaft, alte Spielstände und beide Werkbank-Reiter
// hoch und quer – nichts abgeschnitten, kein Seiten-Scrollen zur Seite, keine Fehler.
const { chromium } = require('playwright');
const fs = require('fs');
const BASE = (process.env.BASE || 'http://localhost:8777/').replace(/\/?$/, '/');
const OUT = process.argv[2] || '/tmp/klingenhort-test/forge';
const fails = [], ok = (c, msg) => { if (!c) fails.push(msg); console.log((c ? '  ok   ' : '  FAIL ') + msg); };

(async () => {
  fs.rmSync(OUT, { recursive: true, force: true }); fs.mkdirSync(OUT, { recursive: true });
  const b = await chromium.launch();
  /* ---------- Regeln ---------- */
  {
    const page = await b.newPage({ viewport: { width: 844, height: 390 }, locale: 'de-DE' });
    const errs = []; page.on('pageerror', e => errs.push(e.message));
    await page.goto(BASE + 'index.html'); await page.evaluate(() => localStorage.clear()); await page.reload(); await page.waitForTimeout(1500);
    console.log('Elemente & Schmiede: Regeln');
    const r = await page.evaluate(() => { const o = {}; try {
      const c = newChar('knight', 'Test', 'normal', false); SAVE.chars.push(c); activateChar(0); P.lv = 20; computeStats();
      o.meta = SAVE.meta.smith && SAVE.meta.smith.lv === 1 && SAVE.meta.smith.xp === 0;
      // Gegner-Elemente: Bosse immer, etwa ein Viertel bis die Hälfte neutral
      const ks = Object.keys(EN).filter(k => !EN[k].hidden);
      o.bossEl = ks.filter(k => EN[k].boss).every(k => EN_EL[k]) && BOSSES.every(B => EN_EL[B.type] || BOSS_EL);
      o.neutral = ks.filter(k => !EN_EL[k]).length / ks.length;
      o.types = { skeleton: EN_EL.skeleton, pyro: EN_EL.pyro, icez: EN_EL.icez, toxslime: EN_EL.toxslime, golem: EN_EL.golem, engel: EN_EL.engel };
      // Schwäche / Resistenz
      G = { type: 'kampf', row: 0, lootMul: 1, kills: 0 }; P.act = 1; enemies = [];
      const mk = t => { const e = spawnEnemy(t, { x: 100, y: 100, instant: true }); e.st = 'move'; return e; };
      const ice = mk('icez'), fire = mk('pyro'), gob = mk('goblin');
      o.weak = hookVal('hit', 100, ice, { el: 'feuer', dmg: 10 }, false);
      o.res = hookVal('hit', 100, fire, { el: 'feuer', dmg: 10 }, false);
      o.neu = hookVal('hit', 100, gob, { el: 'feuer', dmg: 10 }, false);
      o.none = hookVal('hit', 100, ice, { el: null, dmg: 10 }, false);
      const boss = spawnEnemy('ogre', { x: 120, y: 100, instant: true, boss: true }); o.bossOgre = enemyEl(boss);
      // Element-Effekte beim Treffer
      const t1 = mk('goblin'); elProcFx('feuer', t1, { dmg: 20 }, 20, 3); o.burn = t1.burn > 0 && t1.burnDmg > 0;
      const t2 = mk('goblin'); elProcFx('frost', t2, { dmg: 20 }, 20, 3); o.chill = t2.chill > 0;
      const t3 = mk('goblin'); elProcFx('gift', t3, { dmg: 20 }, 20, 3); o.poison = t3.poison > 0 && t3.poisonDmg > 0;
      for (const x of enemies) x.dead = true; const t4 = mk('goblin'), t5 = mk('goblin'); t5.x = t4.x + 20; const hp5 = t5.hp; elProcFx('blitz', t4, { dmg: 20 }, 20, 3); o.arc = t5.hp < hp5;
      P.hp = 10; elHealT = 0; elProcFx('licht', mk('goblin'), { dmg: 20 }, 20, 3); o.heal = P.hp > 10; P.hp = P.st.hp;
      const t6 = mk('goblin'), hp6 = t6.hp; elProcFx('schatten', t6, { dmg: 20 }, 20, 3); o.shadow = t6.hp < hp6;
      // Fähigkeiten mit natürlichem Element
      const w1 = playerW(); hook('skill', 'm1', w1); const w2 = playerW(); hook('skill', 'k1', w2);
      o.skillFire = w1.el === 'feuer'; o.skillWeapon = w2.el === (P.gear.weapon.el || null);
      // Schutz der Rüstung gegen das Element des Angreifers
      const plain = hookVal('hurt', 100, fire);
      P.gear.armor.el = 'feuer'; P.gear.helm.el = 'feuer'; const guarded = hookVal('hurt', 100, fire); const other = hookVal('hurt', 100, ice);
      o.guard = guarded < plain * .8 && other === 100 && plain === 100; delete P.gear.armor.el; delete P.gear.helm.el;
      o.fireBreath = srcEl({ k: 'fire' }) === 'feuer' && srcEl({ k: 'arrow', src: ice }) === 'frost';
      // Element seltener Beute (~25 % der Waffen ab Selten)
      let n = 0, el = 0, low = 0; for (let i = 0; i < 6000; i++) { const it = makeItem({ slot: 'weapon', base: 'sword', tier: 2, rar: 2 + (i % 3) }); n++; if (it.el) el++; if (makeItem({ slot: 'weapon', base: 'sword', tier: 2, rar: i % 2 }).el) low++; }
      o.dropEl = el / n; o.lowEl = low;
      // Bauteile: Beute mit Stufe nach Gebiet
      const grades = st => { const c = {}; for (let i = 0; i < 4000; i++) { const g = partGrade(st); c[g] = (c[g] || 0) + 1; } return c; };
      o.g1 = grades(3); o.g45 = grades(45); o.gq = (() => { P.act = 14; const r = grades(95); P.act = 1; return r; })();
      // Erste Funde: schnell ein ganzes Set
      SAVE.meta.smith.found = 0; P.parts = {}; for (let i = 0; i < 6; i++) partGive(partRoll(partType(), 1, 'feuer'));
      o.firstSet = PARTORDER.every(t => Object.keys(P.parts).some(k => pparse(k).t === t));
      // Kombinieren 3 → 1
      P.parts = { 'klinge:1': 7 }; P.gold = 1000; const g0 = P.gold; const cr = combinePart('klinge:1');
      o.comb = cr && P.parts['klinge:1'] === 4 && (P.parts['klinge:2'] || P.parts['klinge:3']) && P.gold === g0 - combCost(1).gold;
      o.combSteep = combCost(9).gold > combCost(1).gold * 500 && Object.keys(combCost(8).mats).length > 0;
      P.parts = { 'klinge:10': 3 }; o.combMax = !combOk('klinge:10');
      P.parts = { 'kern:feuer:2': 1, 'kern:frost:2': 2, 'kern:gift:2': 3 }; const ck = combinePart('kern:feuer:2');
      o.combEl = ck && pparse(ck.k).el === 'feuer' && !P.parts['kern:feuer:2'] && pcount() === 4 && P.parts['kern:gift:2'] === 1;
      P.parts = { 'kern:feuer:1': 1, 'kern:licht:1': 8 }; let cn = 0; while (combOk('kern:feuer:1')) { combinePart('kern:feuer:1'); cn++; } o.combAll = cn === 3 && Object.keys(P.parts).every(k => k.startsWith('kern:feuer') || k === 'kern:licht:1');
      // die ersten Minuten: ein neuer Held findet in Akt 1 schnell ein ganzes Set
      { const gold = P.gold; SAVE.meta.smith.found = 0; P.parts = {}; G = { type: 'kampf', row: 1, lootMul: 1, kills: 0 }; P.act = 1; let kills = 0;
        while (pcount() < 6 && kills < 400) { const e = { t: 'goblin', def: EN.goblin, ai: 'melee', x: 0, y: 0, sc: 1, elite: kills % 25 === 24 }; hook('kill', e); kills++; }
        o.firstKills = kills; o.firstWeapon = PARTW.every(t => Object.keys(P.parts).some(k => pparse(k).t === t)); P.gold = gold; texts = []; }
      // Zerlegen
      P.parts = {}; P.bag = []; const sv = makeItem({ slot: 'weapon', base: 'sword', tier: 4, rar: 3 }); sv.gems = ['rubin:1']; P.bag.push(sv);
      const gemsBefore = P.gems['rubin:1'] || 0, mats0 = P.mats.erz || 0, xp0 = SAVE.meta.smith.xp + SAVE.meta.smith.lv * 1e6;
      const R = salvage(sv); o.salv = R && !P.bag.length && pcount() >= 2 && (P.mats.erz || 0) > mats0 && P.gems['rubin:1'] === gemsBefore + 1 && SAVE.meta.smith.xp + SAVE.meta.smith.lv * 1e6 > xp0;
      o.salvTypes = Object.keys(P.parts).every(k => PARTW.includes(pparse(k).t));
      for (let i = 0; i < 5; i++) P.bag.push(makeItem({ slot: 'armor', base: 'armor', tier: 0, rar: 0 }));
      P.bag.push(makeItem({ slot: 'armor', base: 'armor', tier: 0, rar: 3 })); o.bulk = salvBulkList(0).length === 5 && salvBulkList(1).length === 0;
      // Meisterwerk: Werte steigen mit den Stufen, Seltenheit aus der Summe
      P.parts = { 'klinge:5': 1, 'griff:5': 1, 'kern:frost:5': 1 }; P.mats = { erz: 50, zahn: 20, mithril: 20, leder: 50 }; P.gold = 99999; P.bag = [];
      MW.slot = 'weapon'; MW.tier = 1; MW.base = 'sword'; MW.form = 'lang'; MW.pick = {};
      const s0 = mwState(); o.mwState = s0.ok && s0.sum === 15 && s0.rar === 3 && s0.el === 'frost';
      const res = mwCraft(); const it = res && res.it;
      o.mwItem = !!it && it.mw.klinge === 5 && it.el === 'frost' && it.tier === 1 && it.form === 'lang' && P.bag.includes(it) && !pcount();
      const ref = JSON.parse(JSON.stringify(it)); delete ref.mw;
      o.mwDmg = Math.abs(weaponDmg(it) / weaponDmg(ref) - 1.3) < 1e-6;
      o.mwName = itemName(it).startsWith('⚒❅');
      o.mwLines = itemLines(it).some(l => l.startsWith('⚒')) && itemLines(it).some(l => l.includes('Frost'));
      o.rar = [mwRar(3), mwRar(6), mwRar(11), mwRar(17), mwRar(30)].join(',');
      // Griff gibt Tempo und Krit, wenn angelegt
      const cd0 = P.st.cd, cr0 = P.st.crit; equipFromBag(P.bag.indexOf(it)); computeStats(); o.grip = P.st.crit > cr0 - .2;
      // Umbau: bessere Klinge einsetzen, alte kommt eine Stufe tiefer zurück
      P.parts = { 'klinge:8': 1 }; MW.pick = {}; const d1 = weaponDmg(it); const sw = mwSwap(it, 'klinge');
      o.swap = sw && it.mw.klinge === 8 && P.parts['klinge:4'] === 1 && weaponDmg(it) > d1 && it.rar === 4 && !!it.name;
      // Rüstung: Platte, Polsterung, Rune
      P.parts = { 'platte:4': 1, 'polster:4': 1, 'rune:licht:4': 1 }; MW.slot = 'armor'; MW.tier = 0; MW.pick = {};
      const ra = mwCraft(); const ar = ra && ra.it; const arRef = JSON.parse(JSON.stringify(ar)); delete arRef.mw;
      o.armor = !!ar && armorDef(ar) > armorDef(arRef) && armorHp(ar) > armorHp(arRef) && ar.el === 'licht';
      const hp0 = (equipFromBag(P.bag.indexOf(ar)), computeStats(), P.st.hp); delete P.gear.armor.mw.rune; computeStats(); o.rune = hp0 > P.st.hp; P.gear.armor.mw.rune = 4; computeStats();
      // Schmiedemeisterschaft: schnell Stufe 2, Stufe 100 erst nach sehr langer Zeit
      const S = SAVE.meta.smith; S.lv = 1; S.xp = 0; smithXP(59); o.lv1 = S.lv === 1; smithXP(1); o.lv2 = S.lv === 2;
      let tot = 0; for (let l = 1; l < 100; l++) tot += smithNeed(l); o.total = tot;
      S.lv = 99; S.xp = 0; smithXP(1e9); o.lv100 = S.lv === 100 && S.xp === 0;
      o.titles = smithTitle(1) !== smithTitle(10) && smithTitle(90) !== smithTitle(100);
      S.lv = 1;
      // Bestiarium-Zeile
      SAVE.meta.bestiary.pyro = 3; o.best = bestiaryHTML().includes('anfällig für');
      // alter Held ohne Bauteile, altes Konto ohne Schmiedemeisterschaft
      const old = JSON.parse(JSON.stringify(SAVE.chars[0])); delete old.parts; delete old.mastery; old.parts = undefined; SAVE.chars.push(old); activateChar(1);
      o.oldHero = P.parts && typeof P.parts === 'object' && !Object.keys(P.parts).length;
      const m = defaultMeta(); delete m.smith; o.oldMeta = fixMeta(m).smith.lv === 1;
      // kaputte Schlüssel werden beim Laden entfernt
      SAVE.chars[1].parts = { 'klinge:3': 2, 'kern:3': 1, 'quatsch:1': 4, 'griff:11': 1, 'rune:licht:2': -1 }; activateChar(1);
      o.clean = JSON.stringify(P.parts) === '{"klinge:3":2}';
    } catch (e) { o.err = e.stack; } return o;
    });
    if (r.err) console.log('  FAIL Ausnahme: ' + r.err.split('\n').slice(0, 3).join(' | '));
    ok(r.meta, 'Schmiedemeisterschaft startet auf Stufe 1');
    ok(r.bossEl, 'alle Bosse haben ein Element');
    ok(r.neutral > .2 && r.neutral < .55, `neutrale Gegnerarten: ${Math.round(r.neutral * 100)} %`);
    ok(r.types.skeleton === 'schatten' && r.types.pyro === 'feuer' && r.types.icez === 'frost' && r.types.toxslime === 'gift' && r.types.golem === 'blitz' && r.types.engel === 'licht', 'Untote Schatten, Feuerwesen Feuer, Eis Frost, Sumpf Gift, Golem Blitz, Engel Licht');
    ok(r.weak === 150 && r.res === 50 && r.neu === 100 && r.none === 100, `Gegensatz ×1,5, gleiches Element ×0,5, neutral ×1 (${r.weak}/${r.res}/${r.neu})`);
    ok(r.bossOgre === 'blitz', 'Ogerhäuptling (Boss ohne Element) bekommt Blitz');
    ok(r.burn && r.chill && r.poison && r.arc && r.heal && r.shadow, 'Effekte: Brand, Kälte, Gift, Überschlag, Heilung, Schattenstoß');
    ok(r.skillFire && r.skillWeapon, 'Feuerball ist Feuer, andere Fähigkeiten haben das Element der Waffe');
    ok(r.guard, 'Rüstung und Helm mit Element schützen nur vor diesem Element');
    ok(r.fireBreath, 'Drachenatem ist Feuer, Geschosse haben das Element des Schützen');
    ok(r.dropEl > .2 && r.dropEl < .3 && r.lowEl === 0, `seltene Waffen: ${Math.round(r.dropEl * 100)} % mit Element, gewöhnliche/magische keine`);
    const share = (c, f) => Object.keys(c).filter(f).reduce((s, k) => s + c[k], 0) / 4000;
    ok(share(r.g1, g => +g === 1) > .85, `Akt 1: fast nur Stufe Roh (${JSON.stringify(r.g1)})`);
    ok(share(r.g45, g => +g <= 3) > .85 && share(r.g45, g => +g === 4) > .02, `Akt 7: meist Stufe 2–3, selten 4 (${JSON.stringify(r.g45)})`);
    ok(share(r.gq, g => +g >= 6) === 0, `Qual: höchstens Stufe 5 aus Beute (${JSON.stringify(r.gq)})`);
    ok(r.firstSet, 'die ersten 6 Funde ergeben ein ganzes Set (Waffe + Rüstung)');
    ok(r.comb, 'Kombinieren: 3 → 1 der nächsten Stufe, kostet Gold');
    ok(r.combSteep, 'Kombinieren wird steil teurer (Stufe 9 > 500× Stufe 1, dazu seltene Materialien)');
    ok(r.combMax, 'Stufe 10 (Göttlich) ist das Maximum');
    ok(r.combEl, 'Kerne verschiedener Elemente kombinieren, das angetippte Element bleibt');
    ok(r.combAll, 'alle kombinieren nimmt auch die anderen Elemente');
    ok(r.firstKills <= 120 && r.firstWeapon, `neuer Held: 6 Bauteile und eine ganze Waffe nach ${r.firstKills} Gegnern`);
    ok(r.salv && r.salvTypes, 'Zerlegen: Gegenstand weg, Waffen-Bauteile, Materialien, Edelsteine zurück, Schmiede-EP');
    ok(r.bulk, '„Alles Gewöhnliche“ nimmt nur einfache Gegenstände');
    ok(r.mwState, 'Meisterwerk-Vorschau: Summe 15 → Episch, Element aus dem Kern');
    ok(r.mwItem, 'Meisterwerk geschmiedet: Stufen, Element, Material und Form wie gewählt, Bauteile verbraucht');
    ok(r.mwDmg, 'Klinge Edel (5): +30 % Schaden');
    ok(r.mwName && r.mwLines, 'Name mit ⚒ und Element-Zeichen, Zeilen für Meisterwerk und Element');
    ok(r.rar === '1,2,3,4,4', 'Seltenheit aus der Summe: Magisch … Legendär (' + r.rar + ')');
    ok(r.swap, 'Umbau: bessere Klinge eingesetzt, alte eine Stufe tiefer zurück, Seltenheit steigt auf Legendär');
    ok(r.armor && r.rune, 'Rüstung: Platte (VER), Polsterung (LP), Rune (Lichtschutz + LP-Bonus)');
    ok(r.lv1 && r.lv2, 'Schmiedemeister Stufe 2 nach 60 EP');
    ok(r.total > 15e6, `Stufe 100 braucht ${(r.total / 1e6).toFixed(1)} Mio. EP (hunderte Stunden)`);
    ok(r.lv100 && r.titles, 'Stufe 100 ist das Ende, alle 10 Stufen ein neuer Titel');
    ok(r.best, 'Bestiarium zeigt Element und Schwäche');
    ok(r.oldHero && r.oldMeta, 'alte Helden ohne Bauteile und alte Konten laden');
    ok(r.clean, 'ungültige Bauteil-Schlüssel werden beim Laden entfernt');
    ok(!errs.length, 'keine Fehler (Regeln)' + (errs.length ? ': ' + errs.slice(0, 3).join(' | ') : ''));
    await page.close();
  }
  /* ---------- Antippen und Fotos: hoch und quer ---------- */
  for (const [W, H] of [[390, 844], [844, 390]]) {
    console.log(`Schmiede antippen ${W}x${H}`);
    const ctx = await b.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: 'de-DE' });
    const page = await ctx.newPage();
    const errs = []; page.on('pageerror', e => errs.push(e.message)); page.on('console', m => { if (m.type() === 'error' && !/favicon|net::ERR/.test(m.text())) errs.push('console: ' + m.text()); });
    await page.goto(BASE + 'index.html'); await page.evaluate(() => localStorage.clear()); await page.reload(); await page.waitForTimeout(1500);
    const dir = `${OUT}/${W}x${H}`; fs.mkdirSync(dir, { recursive: true });
    const shot = async name => { await page.waitForTimeout(250); await page.screenshot({ path: `${dir}/${name}.png` }); };
    const tap = async sel => { const el = page.locator(sel).first(); await el.scrollIntoViewIfNeeded().catch(() => { }); await el.tap({ timeout: 4000 }); await page.waitForTimeout(220); };
    const noSide = async () => page.evaluate(() => { const p = $('panel'); return p.scrollWidth <= p.clientWidth + 1 && document.documentElement.scrollWidth <= innerWidth + 1; });
    const clipped = async () => page.evaluate(() => { const p = $('panel').getBoundingClientRect(); return [...$('panel').querySelectorAll('.btn,.opt,.row,.slot')].filter(e => { const r = e.getBoundingClientRect(); return r.width && (r.left < p.left - 1 || r.right > p.right + 1); }).length; });
    const smallTargets = async () => page.evaluate(() => [...$('panel').querySelectorAll('[data-act^="mw_"],[data-act^="fg_"],[data-act^="zr_"]')].filter(e => { const r = e.getBoundingClientRect(); return r.width && (r.height < 37 || r.width < 37); }).map(e => e.dataset.act + ' ' + Math.round(e.getBoundingClientRect().width) + 'x' + Math.round(e.getBoundingClientRect().height)));
    await page.evaluate(() => {
      const c = newChar('mage', 'Ilva', 'normal', false); c.lv = 18; c.act = 3; c.maxAct = 3; SAVE.chars.push(c); activateChar(0);
      P.gold = 50000; for (const k of MATORDER) P.mats[k] = 30;
      P.parts = { 'klinge:1': 7, 'klinge:3': 1, 'griff:2': 2, 'kern:feuer:2': 1, 'kern:frost:4': 1, 'platte:1': 3, 'polster:2': 1, 'rune:schatten:3': 1, 'rune:licht:1': 4, 'griff:7': 1 };
      for (let i = 0; i < 8; i++) P.bag.push(randomItem(14, i % 4)); for (let i = 0; i < 4; i++) P.bag.push(makeItem({ slot: 'weapon', base: 'staff', tier: 1, rar: 0 }));
      const el = makeItem({ slot: 'weapon', base: 'staff', tier: 2, rar: 3 }); el.el = 'blitz'; P.bag.push(el);
      SAVE.meta.smith.lv = 7; SAVE.meta.smith.xp = 1200; SAVE.meta.smith.found = 40; saveChar(); persist();
      selItem = null; wbTab = 'mw'; openWorkbench('node');
    });
    await shot('01_meisterwerk');
    for (const k of [1, 2, 3]) { await page.evaluate(k => { const p = $('panel'); p.scrollTop = p.clientHeight * .8 * k; }, k); await shot('01_meisterwerk_' + k); }
    await page.evaluate(() => { $('panel').scrollTop = 0; });
    ok(await noSide(), 'Meisterwerk: nichts ragt zur Seite heraus');
    ok((await clipped()) === 0, 'Meisterwerk: keine Knöpfe abgeschnitten');
    const st = await smallTargets(); ok(!st.length, 'Meisterwerk: Tippziele groß genug' + (st.length ? ' – ' + st.slice(0, 4).join(', ') : ''));
    await tap('[data-act="mw_cyc"][data-id="kern"]');
    ok(await page.evaluate(() => MW.pick.kern === 'kern:feuer:2'), 'Kern wechseln per Antippen');
    await tap('[data-act="mw_form"][data-i="1"]'); await tap('[data-act="mw_tier"][data-i="-1"]');
    const before = await page.evaluate(() => P.bag.length);
    await tap('[data-act="mw_make"]');
    const made = await page.evaluate(() => ({ n: P.bag.length, mw: P.bag.filter(x => x.mw).length, last: !!$('panel').querySelector('.fglast') }));
    ok(made.n === before + 1 && made.mw === 1 && made.last, 'Meisterwerk geschmiedet und angezeigt');
    await shot('02_geschmiedet');
    await tap('[data-act="mw_equip"]');
    ok(await page.evaluate(() => !!P.gear.weapon.mw), 'neues Meisterwerk angelegt');
    await tap('[data-act="fg_comb"][data-id="klinge:1"]');
    ok(await page.evaluate(() => P.parts['klinge:1'] === 4), 'Klingen kombiniert');
    await tap('[data-act="mw_slot"][data-id="armor"]');
    await shot('03_ruestung');
    ok(await noSide(), 'Rüstung: nichts ragt zur Seite heraus');
    // Umbau vorhandener Meisterwerke
    await page.evaluate(() => { P.parts['klinge:6'] = 1; MW.pick = {}; MW.slot = 'weapon'; openWorkbench(); });
    const sw = page.locator('[data-act="mw_swap"]'); ok((await sw.count()) > 0, 'Umbau-Knopf für die bessere Klinge');
    if (await sw.count()) { await tap('[data-act="mw_swap"]'); ok(await page.evaluate(() => P.gear.weapon.mw.klinge === 6), 'Klinge umgebaut'); }
    await shot('04_umbau');
    // Zerlegen
    await tap('[data-act="wtab"][data-id="zer"]');
    await shot('05_zerlegen');
    await page.evaluate(() => { const p = $('panel'); p.scrollTop = p.scrollHeight; }); await shot('05_zerlegen_unten');
    ok(await noSide(), 'Zerlegen: nichts ragt zur Seite heraus');
    ok((await clipped()) === 0, 'Zerlegen: keine Knöpfe abgeschnitten');
    const n0 = await page.evaluate(() => P.bag.length);
    await tap('[data-act="zr_one"]');
    let n1 = await page.evaluate(() => P.bag.length); if (n1 === n0) { await tap('[data-act="zr_one"]'); n1 = await page.evaluate(() => P.bag.length); }
    ok(n1 === n0 - 1, 'einzeln zerlegt (wertvolles erst nach Rückfrage)');
    const c0 = await page.evaluate(() => salvBulkList(0).length);
    if (c0) { await tap('[data-act="zr_all"][data-id="0"]'); ok(await page.evaluate(() => salvBulkList(0).length) === c0, 'Alles Gewöhnliche fragt erst nach'); await tap('[data-act="zr_all"][data-id="0"]'); ok(await page.evaluate(() => salvBulkList(0).length) === 0, 'alles Gewöhnliche zerlegt'); }
    await shot('06_zerlegt');
    // bestehende Reiter der Werkbank funktionieren weiter
    for (const k of ['up', 'fuse', 'forge', 'craft', 'sock', 'gems', 'dye']) { await tap(`[data-act="wtab"][data-id="${k}"]`); }
    ok(await page.evaluate(() => wbTab === 'dye' && !!$('panel').querySelector('[data-act="dye"]')), 'alte Werkbank-Reiter öffnen sich weiter');
    // Schmiede im Versteck hat die neuen Reiter auch
    await page.evaluate(() => { SAVE.meta.hide.intro = true; SAVE.meta.hide.b.schmiede = 2; selItem = null; wbTab = 'mw'; openWorkbench('smith'); });
    ok(await page.evaluate(() => wbTab === 'mw' && (panel.querySelector('h2') || {}).textContent === 'SCHMIEDE'), 'Schmiede: Reiter MEISTERWERK');
    await shot('07_schmiede');
    // Charakter: Reiter BAUTEILE und Zerlegen im Beutel
    await page.evaluate(() => { selItem = null; openChar('parts', 'map'); });
    await shot('08_char_bauteile');
    ok(await noSide(), 'Charakter-Bauteile: nichts ragt zur Seite heraus');
    await page.evaluate(() => { const it = makeItem({ slot: 'armor', base: 'armor', tier: 1, rar: 1 }); P.bag.push(it); selItem = it.uid; openChar('gear'); });
    const bn = await page.evaluate(() => P.bag.length);
    await tap('[data-act="zr_char"]');
    ok(await page.evaluate(() => P.bag.length) === bn - 1, 'Zerlegen im Charakterbildschirm');
    await page.evaluate(() => { selItem = P.bag.find(x => x.el) ? P.bag.find(x => x.el).uid : P.bag[0].uid; openChar('gear'); });
    await shot('09_char_detail');
    // Kampf: Element-Punkte über Gegnern, Schwäche-Text
    await page.evaluate(() => { hideOverlay(); P.act = 5; P.map = genMap(5); P.map.pos = { r: 0, i: 0 }; startRoom('kampf', 1); P.inv = 999; });
    await page.waitForTimeout(2600);
    await page.evaluate(() => { P.gear.weapon.el = 'feuer'; computeStats(); for (const e of enemies.slice(0, 3)) { e.st = 'move'; weaponHit(e, Object.assign(playerW(), { el: 'feuer' }), .05, 1, 0, 0); } });
    await shot('10_kampf');
    ok(await page.evaluate(() => enemies.some(e => enemyEl(e))), 'Gegner im Frostgebiet haben Elemente');
    // Bestiarium
    await page.evaluate(() => { setState('title'); hideOverlay(); for (const k of ['icez', 'pyro', 'goblin', 'golem', 'engel', 'frostra']) SAVE.meta.bestiary[k] = 5; showBestiary(); });
    await shot('11_bestiarium');
    ok(await noSide(), 'Bestiarium: nichts ragt zur Seite heraus');
    ok(!errs.length, 'keine Fehler im Spiel' + (errs.length ? ': ' + errs.slice(0, 3).join(' | ') : ''));
    await ctx.close();
  }
  await b.close();
  console.log('  Fotos: ' + OUT);
  process.exit(fails.length ? 1 : 0);
})().catch(e => { console.log('  FAIL Abbruch: ' + e.message.split('\n')[0]); process.exit(1); });
