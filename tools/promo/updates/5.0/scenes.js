// Aufnahmen für das ausführliche Video zu 5.0 „Meisterwerk“ (~67 s, Kapitel):
// Aufhänger → Begleiter → Elemente → Schmiede der Meister → Meisterschaft → Tauschen → Aussehen → Endkarte.
// Alles echt aus dem Spiel: Kämpfe Bild für Bild, Menüs als Standbilder, Grafiken (Begleiter, Eier, Bauteile) als PNG.
// Aufruf (Spiel muss lokal laufen, siehe tools/promo/README.md):
//   PROMO_OUT=/tmp/klingenhort-clip-5.0 node scenes.js                alle Szenen
//   PROMO_OUT=/tmp/klingenhort-clip-5.0 node scenes.js hook,p_fight1  nur diese neu aufnehmen
const path = require('path'), fs = require('fs');
const H = require(path.join(__dirname, '..', '..', 'harness'));
const OUT = process.env.PROMO_OUT || '/tmp/klingenhort-clip-5.0';

(async () => {
  const R = await H.open({ out: OUT + '/raw', seed: 50 });
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
    const r = await ev(([sel, i]) => { const e = document.querySelectorAll(sel)[i || 0]; if (!e) return null; const b = e.getBoundingClientRect(); return { x: b.left * 2, y: b.top * 2, w: b.width * 2, h: b.height * 2 }; }, [sel, i]);
    (boxes[scene] = boxes[scene] || {})[key] = r; fs.writeFileSync(`${R.out}${scene}/boxes.json`, JSON.stringify(boxes[scene], null, 1)); return r;
  };
  const fresh = scene => { const d = R.out + scene; fs.rmSync(d, { recursive: true, force: true }); fs.mkdirSync(d, { recursive: true }); boxes[scene] = {}; };
  // Hilfen im Browser: Begleiter setzen, Ränge zurücksetzen, Overlay schließen
  await ev(() => {
    window.__pet = (sp, lv, o) => { const M = SAVE.meta.pets; M.starter = true; M.list = []; M.eggs = []; M.act = null; const p = petGive(sp, Object.assign({ lv }, o || {})); M.act = p.id; petView = p.id; return p; };
    window.__calm = () => { P.inv = 1; P.hp = P.st.hp; P.res = P.st.resMax; __off(); };
    // Menüs vor ruhigem Hintergrund (Titel-Szene), Kamera und Texte wieder normal
    window.__ui = () => { DLG = null; hideOverlay(); showHud(false); $('bossbar').hidden = true; window.__camDX = 0; window.__txtNo = null; window.__txtOK = null; titleScene(); texts = []; parts = []; setState('title'); };
    // Kampf-Szene vorbereiten: alles zurück, dann Zufall festlegen
    window.__scene = seed => { __ui(); __seed(seed); };
  });

  await R.news();
  if (R.want('assets')) await R.assets();

  // Grafiken für die eigenen Animationen: Begleiter aller Stufen, Eier, Element-Zeichen, Bauteile
  if (R.want('art')) {
    fresh('art');
    const A = await ev(() => {
      const o = { pets: {}, stn: PET_STN, el: {}, parts: {}, grade: [] };
      for (const sp of PET_ORDER) {
        const S = PET_SP[sp]; o.pets[sp] = { n: S.n, el: S.el, elN: PET_EL[S.el].n, elC: PET_EL[S.el].c, an: S.an, sn: S.sn, fly: S.fly, st: [], egg: [] };
        for (let s = 0; s < 6; s++) { const U = petImgURL(sp, s, 0, false, true); o.pets[sp].st.push({ u: U.url, W: U.W, H: U.H }); }
        const Sh = petImgURL(sp, 0, 6, true, true); o.pets[sp].shiny = { u: Sh.url, W: Sh.W, H: Sh.H };
        for (let c = 0; c < 3; c++) o.pets[sp].egg.push(eggURL(sp, c));
      }
      for (const el of ELORDER) o.el[el] = { n: ELEM[el].n, c: ELEM[el].c, opp: ELEM[el].opp, u: elIconURL(el) };
      for (let g = 1; g <= 10; g++) { o.grade.push({ n: GRADE[g].n, c: gradeCol(g), r: ROMAN[g] }); o.parts['klinge' + g] = partIconURL('klinge', g); o.parts['kern' + g] = partIconURL('kern', g, 'feuer'); o.parts['rune' + g] = partIconURL('rune', g, 'licht'); }
      return o;
    });
    const save = (u, f) => R.saveData('art/' + f, u);
    for (const sp in A.pets) { const p = A.pets[sp]; p.st.forEach((s, i) => { save(s.u, `pet_${sp}_${i}.png`); delete s.u; }); save(p.shiny.u, `pet_${sp}_shiny.png`); delete p.shiny.u; p.egg.forEach((u, i) => save(u, `egg_${sp}_${i}.png`)); delete p.egg; }
    for (const el in A.el) { save(A.el[el].u, `el_${el}.png`); delete A.el[el].u; }
    for (const k in A.parts) save(A.parts[k], `part_${k}.png`); delete A.parts;
    fs.writeFileSync(R.out + 'art/art.json', JSON.stringify(A, null, 1));
    console.log('Grafiken: Begleiter, Eier, Elemente, Bauteile');
  }

  /* ---------- 1. Aufhänger: Magier mit goldenem Feuerball (Rang VI) und mythischem Glutdrachen ---------- */
  if (R.want('hook')) {
    await ev(() => {
      __scene(11); __pet('drache', 100);
      __vp(3); __fight(1, 8, [], { keepN: 0 }); window.__kinds = null; enemies = [];
      P.mastery = { m1: MCUM[50], m2: MCUM[50], m3: MCUM[50], mu: MCUM[50] }; delete P.gear.weapon.el; computeStats(); mastWarm('m1');
      P.x = clamp(P.x, BD.x0 + 50, BD.x1 - 120); P.face = 1; window.__camDX = 16; window.__txtNo = /^\d+$/;
      // Gegner kommen von rechts; wer fällt, wird rechts ersetzt
      window.__hookFoe = () => { const n = enemies.filter(e => !e.dead).length; for (let k = n; k < 5; k++) { const e = spawnEnemy(pick(['todesritter', 'skelmage', 'skeleton', 'berserker']), { x: P.x + rnd(62, 92), y: P.y + rnd(-34, 34), instant: k < 3 }); e.hp = e.maxHp = e.maxHp * 3; e.spd *= .35; } };
      __hookFoe(); __calm(); __step(14); __snap(); PET_RT.spc = 0; PET_RT.cd = 0; P.cds[0] = 0; useSkill(0); __step(6);
    });
    await R.cap('hook', 96, `i => { __calm(); P.face = 1; __hookFoe(); if (i % 24 === 16) { P.cds[0] = 0; useSkill(0); } if (i % 10 === 5) PET_RT.cd = 0; if (i === 52) PET_RT.spc = 0; }`);
  }

  /* ---------- 2. Begleiter ---------- */
  // Auswahl des ersten Begleiters (echter Dialog), jede Karte einmal angetippt
  if (R.want('p_start')) {
    fresh('p_start');
    await ev(() => { activateChar(1); __ui(); SAVE.meta.pets = { list: [], eggs: [], act: null, starter: false, hatched: 0 }; PET_UI.sel = 'drache'; petStarter('title'); });
    for (const sp of ['drache', 'katze', 'kaefer']) await still('p_start', sp, sp => { ON.petpick(sp); }, sp);
    await rect('p_start', 'panel', '#panel'); await rect('p_start', 'cards', '.pcards');
    await ev(() => { petStartOk(); });
  }
  // Begleiter kämpfen mit: Geisterkatze (Schattensprung) und Sturmfunke (Gewitter), beide mythisch
  if (R.want('p_fight1')) {
    await ev(() => { __scene(21); window.__txtNo = /^\d+$/; __pet('katze', 100); __vp(3.2); __fight(2, 6, ['toxslime', 'seuche', 'hexe', 'toxslime', 'slime'], { keepN: 6, dist: 46, tanky: 6 }); delete P.gear.weapon.el; computeStats(); __keep(0); __step(16); __snap(); PET_RT.spc = 99; });
    await R.cap('p_fight1', 54, `i => { __keep(.35); if (i === 3 || i === 33) PET_RT.spc = 0; }`);
  }
  if (R.want('p_fight2')) {
    await ev(() => { __scene(22); window.__txtNo = /^\d+$/; __pet('funke', 100); __vp(3.2); __fight(0, 2, ['slime', 'goblin', 'toxslime', 'goblin', 'slime'], { keepN: 6, dist: 48, tanky: 6 }); delete P.gear.weapon.el; computeStats(); __keep(0); __step(16); __snap(); PET_RT.spc = 99; });
    await R.cap('p_fight2', 54, `i => { __keep(.35); if (i === 3 || i === 33) PET_RT.spc = 0; }`);
  }
  // Reiter BEGLEITER: mythischer Glutdrache, Ei schlüpft (schillernd)
  if (R.want('p_tab')) {
    fresh('p_tab');
    await ev(() => {
      activateChar(1); __ui(); __seed(31);
      const M = SAVE.meta.pets; M.starter = true; M.list = []; M.eggs = []; M.act = null;
      const d = petGive('drache', { lv: 100 }); petGive('katze', { lv: 63, col: 2, nm: 'Mimi' }); petGive('eule', { lv: 80 }); petGive('funke', { lv: 27 }); petGive('kaefer', { lv: 52, col: 1 });
      M.eggs = [{ sp: 'eule', need: 150, got: 150 }, { sp: 'natter', need: 150, got: 96 }, { sp: 'drache', need: 150, got: 31 }];
      for (const p of M.list) p.k = 400 + Math.floor(Math.random() * 3000); M.act = d.id; petView = d.id; for (const k of MATORDER) P.mats[k] = 40; computeStats(); openChar('pet');
    });
    await still('p_tab', 'top', () => { panel.scrollTop = 0; });
    // Eier und Liste
    await still('p_tab', 'eggs', () => { const h = [...panel.querySelectorAll('h3')].find(e => /EIER/.test(e.textContent)); panel.scrollTop = 0; panel.scrollTop = h.getBoundingClientRect().top - panel.getBoundingClientRect().top - 40; });
    await rect('p_tab', 'eggrow', '[data-act="pethatch"]');
    // Schlüpfen: 1 % schillernd – hier erzwungen wie im Test (tools/test/pets.js)
    await still('p_tab', 'hatched', () => { const r0 = Math.random; Math.random = () => .005; ON.pethatch(null, null, 0); Math.random = r0; panel.scrollTop = 0; });
    console.log('Geschlüpft:', await ev(() => { const p = petViewed(); return p.sp + ' shiny=' + p.shiny + ' lv=' + p.lv; }));
  }

  /* ---------- 3. Elemente ---------- */
  // Ritterin mit Feuerschwert gegen Frostwesen: SCHWÄCHE! (×1,5), ein Feuerwichtel ist RESISTENT
  if (R.want('e_fight1')) {
    await ev(() => {
      __scene(41); SAVE.meta.pets.act = null; __vp(3.4);
      __fight(0, 5, ['icez', 'eisgeist', 'frostoger', 'icez', 'eisgeist'], { keepN: 6, dist: 40, tanky: 8 }); window.__kinds = ['icez', 'eisgeist', 'frostoger', 'icez'];
      P.gear.weapon.el = 'feuer'; computeStats(); window.__txtOK = /SCHWÄCHE|RESISTENT/; __keep(0); __step(14); __snap();
    });
    await R.cap('e_fight1', 84, `i => { __keep(.4); if (i === 20 || i === 56) { P.cds[1] = 0; useSkill(1); } }`);
  }
  // Assassine mit Lichtdolch gegen Untote (Schatten)
  if (R.want('e_fight2')) {
    await ev(() => {
      __scene(42); SAVE.meta.pets.act = null; __vp(3.4);
      __fight(2, 7, ['skeleton', 'zombie', 'todesritter', 'skeleton', 'skelmage'], { keepN: 6, dist: 40, tanky: 8 });
      P.gear.weapon.el = 'licht'; computeStats(); window.__txtOK = /SCHWÄCHE|RESISTENT/; __keep(0); __step(14); __snap();
    });
    await R.cap('e_fight2', 60, `i => { __keep(.4); if (i === 10) { P.cds[1] = 0; useSkill(1); } }`);
  }
  await ev(() => { window.__txtOK = null; });
  // Bestiarium: Element und Schwäche jeder Gegnerart
  if (R.want('e_best')) {
    fresh('e_best');
    await still('e_best', 'best', () => { __ui(); SAVE.meta.bestiary = {}; for (const k of Object.keys(EN)) if (!EN[k].hidden) SAVE.meta.bestiary[k] = 10 + (k.length * 37) % 400; showBestiary(); });
  }

  /* ---------- 4. Schmiede der Meister ---------- */
  // Bauteile im Charakter, dann 3 Klingen (Fein) → 1 Klinge (Edel)
  if (R.want('f_parts')) {
    fresh('f_parts');
    await ev(() => {
      activateChar(1); __ui(); __seed(51); P.gold = 250000; for (const k of MATORDER) P.mats[k] = 60;
      P.parts = { 'klinge:4': 3, 'klinge:2': 7, 'griff:3': 4, 'griff:6': 1, 'kern:feuer:5': 2, 'kern:frost:3': 4, 'platte:3': 3, 'polster:2': 5, 'rune:licht:4': 1, 'rune:schatten:7': 1, 'klinge:8': 1 };
      SAVE.meta.smith.lv = 23; SAVE.meta.smith.xp = 14000; SAVE.meta.smith.found = 80; selItem = null; openChar('parts');
    });
    await still('f_parts', 'list', () => { panel.scrollTop = 0; });
    await rect('f_parts', 'comb', '[data-act="fg_comb"][data-id="klinge:4"]');
    await still('f_parts', 'combined', () => { ON.fg_comb('klinge:4'); panel.scrollTop = 0; });
    console.log('Kombiniert:', await ev(() => JSON.stringify(P.parts)));
  }
  // Meisterwerk schmieden: Klinge IX + Griff VI + Feuerkern V → Legendär
  if (R.want('f_mw')) {
    fresh('f_mw');
    await ev(() => {
      activateChar(1); __ui(); __seed(52); P.gold = 250000; for (const k of MATORDER) P.mats[k] = 60;
      P.gear.weapon = makeItem({ slot: 'weapon', base: 'staff', form: 'stab', tier: 5, rar: 2 }); delete P.gear.weapon.el; P.gear.weapon.up = 4;
      P.parts = { 'klinge:9': 1, 'griff:6': 1, 'kern:feuer:5': 1, 'klinge:4': 2, 'griff:3': 3, 'kern:frost:3': 2 };
      P.bag = []; SAVE.meta.smith.lv = 23; SAVE.meta.smith.xp = 14000; computeStats();
      MW.slot = 'weapon'; MW.base = 'staff'; MW.form = 'mond'; MW.tier = 6; MW.pick = {}; FG.last = null; selItem = null; wbTab = 'mw'; openWorkbench('smith');
    });
    await still('f_mw', 'top', () => { panel.scrollTop = 0; });
    await still('f_mw', 'picks', () => { const e = panel.querySelector('.fgpick'); panel.scrollTop = 0; panel.scrollTop = e.getBoundingClientRect().top - panel.getBoundingClientRect().top - 150; });
    await rect('f_mw', 'make', '[data-act="mw_make"]');
    const it = await ev(() => { ON.mw_make(); const it = findItem(FG.last.uid).it; return { n: itemName(it), c: itemColor(it), rar: RAR[it.rar].n, ic: itemIconURL(it), mat: MAT[it.tier].n, el: it.el }; });
    await still('f_mw', 'done', () => { panel.scrollTop = 0; });
    R.saveData('f_mw/item.png', it.ic); delete it.ic; fs.writeFileSync(R.out + 'f_mw/item.json', JSON.stringify(it));
    console.log('Meisterwerk:', it.n, it.rar);
  }
  // Zerlegen: ein Gegenstand wird zu Bauteilen
  if (R.want('f_salv')) {
    fresh('f_salv');
    await ev(() => {
      activateChar(1); __ui(); __seed(53);
      P.bag = [makeItem({ slot: 'weapon', base: 'staff', form: 'knochen', tier: 6, rar: 3 }), makeItem({ slot: 'armor', base: 'armor', tier: 5, rar: 2 }), makeItem({ slot: 'helm', base: 'helm', tier: 4, rar: 1 }), makeItem({ slot: 'weapon', base: 'staff', tier: 3, rar: 0 }), makeItem({ slot: 'armor', base: 'armor', tier: 2, rar: 0 }), makeItem({ slot: 'weapon', base: 'staff', form: 'zepter', tier: 6, rar: 2 })];
      P.bag[0].up = 6; P.bag[0].el = 'frost'; P.parts = {}; FG.last = null; selItem = P.bag[0].uid; wbTab = 'zer'; openWorkbench('smith');
    });
    await still('f_salv', 'sel', () => { panel.scrollTop = 0; });
    await still('f_salv', 'ask', () => { ON.zr_one(P.bag[0].uid); });
    await still('f_salv', 'done', () => { ON.zr_one(P.bag[0].uid); panel.scrollTop = 0; });
    await rect('f_salv', 'last', '.fglast');
  }

  /* ---------- 5. Meisterschaft: Feuerball auf Rang I, III, VI und Meteorhagel in Gold ---------- */
  const ranks = [['m_r1', 1], ['m_r3', 20], ['m_r6', 50]];
  for (const [name, lv] of ranks) {
    if (!R.want(name)) continue;
    await ev(lv => {
      __scene(60 + lv); window.__txtNo = /^\d+$/; SAVE.meta.pets.act = null; __vp(3.2); window.__camDX = 26;
      __fight(1, 1, [], { keepN: 0 }); window.__kinds = null; enemies = [];
      P.mastery = { m1: MCUM[lv] }; delete P.gear.weapon.el; computeStats(); mastWarm('m1');
      P.x = clamp(P.x, BD.x0 + 40, BD.x1 - 110); P.face = 1;
      for (const [dx, dy] of [[62, 0], [74, -16], [74, 16], [88, 0]]) { const e = spawnEnemy('orc', { x: P.x + dx, y: P.y + dy, instant: true }); e.hp = e.maxHp = 1e9; e.spd = 0; e.atk = 0; }
      __calm(); __step(12); __snap();
    }, lv);
    await R.cap(name, 60, `i => { __calm(); P.face = 1; if (i === 3 || i === 33) { P.cds[0] = 0; useSkill(0); } }`);
  }
  if (R.want('m_ult')) {
    await ev(() => {
      __scene(66); window.__txtNo = /^\d+$/; SAVE.meta.pets.act = null; __vp(2.9);
      __fight(1, 3, [], { keepN: 0 }); window.__kinds = null; enemies = [];
      P.mastery = { mu: MCUM[50], m1: MCUM[50] }; delete P.gear.weapon.el; computeStats(); mastWarm('mu');
      for (const [dx, dy] of [[40, -10], [56, 12], [70, -22], [-40, 8], [-52, -14], [24, 26], [-24, -28]]) { const e = spawnEnemy(dx > 0 ? 'skeleton' : 'zombie', { x: P.x + dx, y: P.y + dy, instant: true }); e.hp = e.maxHp = 1e9; e.spd = 0; e.atk = 0; }
      __calm(); __step(12); __snap();
    });
    await R.cap('m_ult', 84, `i => { __calm(); if (i === 2) { P.rage = 100; doUlt(); } }`);
  }
  // Charakter → Talente: Feuerball Rang VI mit allen Rängen
  if (R.want('m_tal')) {
    fresh('m_tal');
    await still('m_tal', 'tal', () => {
      activateChar(1); __ui(); P.mastery = { m1: MCUM[50], m2: MCUM[14] + 300, m3: MCUM[27] + 900, mu: MCUM[41] + 4000 }; computeStats(); openChar('tal');
      const d = panel.querySelector('details.mall'); d.open = true; const m = panel.querySelector('.mst').closest('.row'); panel.scrollTop = 0; panel.scrollTop = m.getBoundingClientRect().top - panel.getBoundingClientRect().top - 140;
    });
  }

  /* ---------- 6. Tauschen: Faelwen verschenkt einen Bogen, Mira (zweites Profil) nimmt ihn an ---------- */
  let link = null;
  if (R.want('t_send')) {
    fresh('t_send');
    await ev(() => {
      activateChar(3); __ui(); __seed(71); SAVE.meta.trades.own = []; SAVE.meta.trades.log = [];
      const g = makeItem({ slot: 'weapon', base: 'bow', form: 'reflex', tier: 6, rar: 4 }); g.up = 7; g.el = 'blitz';
      P.bag = [g, makeItem({ slot: 'armor', base: 'armor', tier: 4, rar: 2 }), makeItem({ slot: 'helm', base: 'helm', tier: 5, rar: 1 }), makeItem({ slot: 'weapon', base: 'bow', tier: 3, rar: 1 })];
      selItem = g.uid; saveChar(); openChar('gear');
    });
    await still('t_send', 'bag', () => { const s = panel.querySelector('.side.sheet'); panel.scrollTop = 0; });
    await rect('t_send', 'btn', '[data-act="tr_ask"]');
    await rect('t_send', 'side', '.side.sheet');
    await still('t_send', 'ask', () => { ON.tr_ask('i:' + selItem, null, 1); });
    await still('t_send', 'code', () => { ON.tr_send(); });
    await rect('t_send', 'out', '#trOut');
    link = await ev(() => ($('trOut') || {}).value || '');
    fs.writeFileSync(R.out + 't_send/link.txt', link);
    console.log('Tauschlink', link.length, 'Zeichen');
  }
  if (R.want('t_recv')) {
    fresh('t_recv');
    if (!link) link = fs.readFileSync(R.out + 't_send/link.txt', 'utf8');
    const ctx2 = await page.context().browser().newContext({ viewport: { width: 540, height: 960 }, deviceScaleFactor: 2, locale: 'de-DE' });
    const B = await ctx2.newPage(); const errB = []; B.on('pageerror', e => errB.push(e.message));
    await B.goto(link.split('#')[0]); await B.waitForTimeout(1200);
    await B.evaluate(() => { localStorage.clear(); loadAll(); const c = newChar('ranger', 'Mira', 'normal', false, { body: 'elf_f', hair: 2, skin: -1, accent: 3, cape: 5 }); c.lv = 31; c.act = 4; c.maxAct = 4; c.story = { a1: 1 }; SAVE.chars.push(c); SAVE.active = 0; SAVE.meta.pets.starter = true; SAVE.meta.seenVer = VERSION; SAVE.meta.hide.intro = true; persist(); });
    await B.goto('about:blank'); await B.goto(link); await B.waitForTimeout(1800); await B.evaluate(() => document.fonts.ready);
    const shotB = async f => { await B.waitForTimeout(400); await B.screenshot({ path: `${R.out}t_recv/${f}.jpg`, type: 'jpeg', quality: 93 }); };
    console.log('Empfang:', await B.evaluate(() => panel.textContent.includes('GESCHENK VON') ? 'Vorschau' : panel.textContent.slice(0, 80)));
    await shotB('preview');
    await B.evaluate(() => ON.tr_take()); await shotB('done');
    if (errB.length) console.log('FEHLER IM ZWEITEN PROFIL:', errB.slice(0, 3).join(' | '));
    await ctx2.close();
  }
  if (R.want('t_deal')) {
    fresh('t_deal');
    await still('t_deal', 'deal', () => { activateChar(3); __ui(); P.maxAct = 6; P.gold = 90000; P.fate = 30; for (const k of MATORDER) P.mats[k] = 80; for (const g of GEMORDER) for (let gr = 0; gr < 5; gr++) P.gems[g + ':' + gr] = 6; TRD.made = null; TRD.ask = null; trOpen('deal', 'map'); });
  }

  /* ---------- 7. Aussehen: Spiegel, Sammlung, die Ritterin wechselt den Look ihrer Waffe ---------- */
  if (R.want('look')) {
    fresh('look');
    await ev(() => {
      activateChar(0); __ui(); __seed(81); SAVE.meta.looks = {};
      for (const F of WFORM.sword) for (let t = 0; t < TIERS; t++) if ((t + F.id.length) % 3 !== 0 || t >= 5) SAVE.meta.looks['w.sword.' + F.id + '.' + t] = 1;
      for (let t = 0; t < TIERS; t++) { SAVE.meta.looks['a.' + t] = 1; if (t % 2) SAVE.meta.looks['h.' + t] = 1; }
      tmAdd(P.gear.weapon); SAVE.meta.hide.intro = true; enterHideout(); openStation('spiegel'); tmSlot = 'weapon'; tmShow();
    });
    const looks = ['orig', 'w.sword.flamm.5', 'w.sword.saebel.6', 'w.sword.breit.7', 'w.sword.zwei.7'];
    const info = [];
    for (let i = 0; i < looks.length; i++) {
      const r = await ev(k => { if (k === 'orig') { ON.tm_set('orig'); } else { SAVE.meta.looks[k] = 1; ON.tm_set(k); } panel.scrollTop = 0; return { k, hero: heroPreviewURL(P).url, name: tmCur(P.gear.weapon) ? tmName(tmCur(P.gear.weapon)) : itemName(P.gear.weapon) }; }, looks[i]);
      await still('look', 'l' + i); R.saveData(`look/hero${i}.png`, r.hero); info.push({ k: r.k, name: r.name });
    }
    await rect('look', 'prev', '.tm-prev'); await rect('look', 'grid', '.tm-g');
    fs.writeFileSync(R.out + 'look/info.json', JSON.stringify(info));
    console.log('Looks:', info.map(x => x.name).join(' | '));
  }

  const errs = await R.close();
  process.exit(errs.length ? 1 : 0);
})();
