// Das Werbevideo zu Version 4 (22 s) – Beispiel für viele Szenenarten:
// Kampf mit Ultimativer, Klassenwechsel, Versteck mit Ausbau, Verschmelzen (Standbilder + Symbole),
// Waffen- und Heldengrafiken für eigene Animationen, echter Glücksrad-Dreh, Bosse, Horde, Weltkarte.
// Aufruf: PROMO_OUT=/tmp/klingenhort-v4 node scenes.js [szene,szene]   danach storyboard.py
const path = require('path'), fs = require('fs');
const H = require(path.join(__dirname, '..', 'harness'));
const OUT = process.env.PROMO_OUT || '/tmp/klingenhort-v4';

(async () => {
  const R = await H.open({ out: OUT + '/raw' });
  const ev = R.ev;
  // S1: Aufhänger – Magier gegen den Uralten Drachen
  if (R.want('s1')) {
    await R.ev(() => { __vp(3); __fight(1, 8, ['imp', 'chort', 'imp', 'lavadaemon'], { boss: 'pyraxis', by: -58, bx: 8, tanky: 3, keepN: 4 }); __step(20); __snap(); });
    await R.cap('s1', 84, i => { __keep(1.2); if (i === 0 || i === 46) { P.rage = 100; doUlt(); } if (i % 9 === 4) { P.cds[0] = 0; useSkill(0); } if (i === 30) { P.cds[2] = 0; useSkill(2); } });
  }
  // S2: vier Klassen mit ihren stärksten Fähigkeiten
  const cls = [[0, 5, ['frostoger', 'eisgeist', 'icez', 'skelarcher', 'golem'], 's2a', `i => { __keep(.8); if (i === 0) { P.rage = 100; doUlt(); } if (i === 12) { P.cds[1] = 0; useSkill(1); } }`],
    [1, 3, ['skeleton', 'mage', 'geist', 'skelmage', 'zombie'], 's2b', `i => { __keep(.8); if (i === 0) { P.cds[1] = 0; useSkill(1); } if (i === 7) { P.cds[2] = 0; useSkill(2); } if (i === 13) { P.cds[0] = 0; useSkill(0); } }`],
    [2, 7, ['todesritter', 'engel', 'schattenimp', 'geist', 'skelmage'], 's2c', `i => { __keep(.8); if (i === 0) { P.rage = 100; doUlt(); } if (i === 6) { P.cds[0] = 0; useSkill(0); } if (i === 14) { P.cds[1] = 0; useSkill(1); } }`],
    [3, 6, ['toxslime', 'seuche', 'hexe', 'wurm', 'kuerbis'], 's2d', `i => { __keep(.8); if (i === 0) { P.rage = 100; doUlt(); } if (i === 10) { P.cds[0] = 0; useSkill(0); } }`]];
  for (const [ci, act, kinds, name, per] of cls) {
    if (!R.want(name)) continue;
    await R.ev(([ci, act, kinds]) => { __vp(3.5); __fight(ci, act, kinds, { tanky: 2, keepN: 6, dist: 40 }); __keep(0); __step(24); __snap(); }, [ci, act, kinds]);
    await R.cap(name, 22, per);
  }
  // S3: Versteck – durchlaufen, mittendrin wird gebaut
  if (R.want('s3')) {
    await R.ev(() => { activateChar(0); SAVE.meta.hide.b.alchemie = 1; for (const k of MATORDER) P.mats[k] = 99; P.gold = 99999; P.map = genMap(5); enterHideout(); __vp(2.4); P.x = hidePos('schmiede').x + 10; P.y = hidePos('schmiede').y + 34; __snap(); __step(6); });
    await R.cap('s3', 78, `i => { P.inv = 1; keys.KeyJ = false; keys.KeyD = i < 66; keys.KeyW = false; keys.KeyS = false; if (i === 40) doBuild('alchemie'); }`);
    await R.ev(() => __off());
  }
  // S4: Verschmelzen – zwei legendäre Klingen werden mythisch
  if (R.want('s4')) {
    const dir = R.out + 's4'; fs.rmSync(dir, { recursive: true, force: true }); fs.mkdirSync(dir, { recursive: true });
    const info = await R.ev(() => {
      activateChar(0); for (const k of MATORDER) P.mats[k] = 99; P.gold = 99999;
      const A = P.gear.weapon; A.rar = 4; A.fz = 0; if (!A.name) A.name = 'Weltenspalter';
      const B = makeItem({ slot: 'weapon', base: 'sword', form: 'breit', tier: 6, rar: 4 }); B.up = 8; B.name = B.name || 'Sturmbrecher'; P.bag = [B];
      enterHideout(); openStation('schmiede'); wbTab = 'fuse'; fuseA = A.uid; fuseB = B.uid; openWorkbench();
      return { a: itemIconURL(A), b: itemIconURL(B), an: itemName(A), bn: itemName(B), ac: itemColor(A), bc: itemColor(B) };
    });
    await R.page.screenshot({ path: dir + '/ui_before.jpg', type: 'jpeg', quality: 92 });
    const res = await R.ev(() => {
      const r0 = Math.random; Math.random = () => .01; const A = findItem(fuseA).it, B = findItem(fuseB).it; const r = fuseItems(A, B); Math.random = r0; fuseB = null; openWorkbench();
      return { r: r.r, up: r.up, ic: itemIconURL(r.it), n: itemName(r.it), c: itemColor(r.it), rar: r.it.rar, d: r.it.myth ? MYTHIC[r.it.myth].d : '' };
    });
    await R.page.screenshot({ path: dir + '/ui_after.jpg', type: 'jpeg', quality: 92 });
    const det = R.page.locator('.panel .detail').first(); if (await det.count()) await det.screenshot({ path: dir + '/detail_after.png' });
    fs.writeFileSync(dir + '/info.json', JSON.stringify({ info, res }));
    console.log('scene s4', res.r, res.n, res.rar);
  }
  // S5/S6/S10: Bilder für die eigenen Animationen (Waffen, Helden)
  if (R.want('assets')) {
    const dir = R.out + 'assets'; fs.rmSync(dir, { recursive: true, force: true }); fs.mkdirSync(dir, { recursive: true });
    const A = await R.ev(() => {
      activateChar(0);
      const out = { mats: MAT.map(m => [m.n, m.m[2], m.m[1]]), weap: [], heroes: [], main: [], armor: [] };
      for (const base in WFORM) for (const F of WFORM[base]) { const row = []; for (let t = 0; t < 8; t++) row.push(weaponArt({ slot: 'weapon', base, form: F.id, tier: t, rar: t >= 6 ? 4 : 2, aff: {}, gems: [] }).c.toDataURL()); out.weap.push({ base, form: F.id, n: F.n, row }); }
      for (const cl of Object.keys(CLASSES)) for (let t = 0; t < 8; t++) for (const s of ['armor', 'helm']) out.armor.push({ cl, t, s, u: armorArt({ slot: s, base: s, tier: t, rar: 2, aff: {}, gems: [] }, cl).toDataURL() });
      const ck = k => Object.keys(COSM).filter(x => COSM[x].k === k);
      for (let i = 0; i < 60; i++) {
        const look = { body: pick(BODYORDER), hair: ri(0, HAIRS.length - 1), skin: Math.random() < .5 ? -1 : ri(0, SKINS.length - 1), accent: ri(-1, ACCENTS.length - 1), cape: ri(-1, CAPES.length - 1), wings: Math.random() < .55 ? pick(ck('wings')) : null, aura: Math.random() < .4 ? pick(ck('aura')) : null, ccape: Math.random() < .25 ? pick(ck('cape')) : null };
        const t = ri(0, 7), hr = Math.random() < .2 ? 6 : Math.random() < .3 ? 4 : 2;
        const c = { cls: pick(Object.keys(CLASSES)), look, dye: Math.random() < .4 ? pick(DYES).id : null, gear: { armor: { slot: 'armor', tier: ri(0, 7), rar: 2 }, helm: { slot: 'helm', tier: t, rar: hr, myth: hr === 6 ? 'krone' : null } } };
        try { out.heroes.push({ u: heroPreviewURL(c).url, aura: look.aura ? COSM[look.aura].c : null }); } catch (e) { out.err = String(e); }
      }
      for (const c of SAVE.chars) out.main.push({ n: c.name, cls: CLASSES[c.cls].n, u: heroPreviewURL(c).url, aura: lookOf(c).aura ? COSM[lookOf(c).aura].c : null });
      return out;
    });
    const save = (u, f) => fs.writeFileSync(dir + '/' + f, Buffer.from(u.split(',')[1], 'base64'));
    A.weap.forEach((w, i) => w.row.forEach((u, t) => save(u, `w_${i}_${t}.png`)));
    A.armor.forEach((a, i) => save(a.u, `a_${i}.png`));
    A.heroes.forEach((h, i) => save(h.u, `h_${i}.png`));
    A.main.forEach((h, i) => save(h.u, `m_${i}.png`));
    fs.writeFileSync(dir + '/assets.json', JSON.stringify({ mats: A.mats, weap: A.weap.map(w => ({ base: w.base, form: w.form, n: w.n })), armor: A.armor.map(a => ({ cl: a.cl, t: a.t, s: a.s })), heroes: A.heroes.map(h => ({ aura: h.aura })), main: A.main.map(h => ({ n: h.n, cls: h.cls, aura: h.aura })), err: A.err }));
    console.log('assets', A.weap.length, A.heroes.length, A.err || '');
  }
  // S7: Glücksrad – echter Dreh im Tempel, Mythisch erzwungen über den Pech-Zähler
  if (R.want('s7')) {
    const dir = R.out + 's7'; fs.rmSync(dir, { recursive: true, force: true }); fs.mkdirSync(dir, { recursive: true });
    await R.ev(() => { activateChar(1); P.fate = 12; SAVE.meta.luck.pityM = 79; enterHideout(); openStation('tempel'); });
    await R.page.screenshot({ path: dir + '/ui.jpg', type: 'jpeg', quality: 92 });
    const W = R.page.locator('#wheel');
    await W.screenshot({ path: dir + '/wheel_off.png' });
    const nW = await R.ev(() => WHEEL.length);
    for (let k = 0; k < nW; k++) { await R.ev(k => { const s = $('wheel').children; for (const x of s) x.classList.remove('on'); s[k].classList.add('on'); }, k); await W.screenshot({ path: `${dir}/wheel_${k}.png` }); }
    await R.ev(() => { doSpin(); for (let i = 0; i < 400 && spinning; i++) __step(1); });
    await R.page.screenshot({ path: dir + '/result.jpg', type: 'jpeg', quality: 92 });
    const det = R.page.locator('.panel .detail.center').first(); if (await det.count()) await det.screenshot({ path: dir + '/result_box.png' });
    const r = await R.ev(() => { const it = P.bag[P.bag.length - 1]; return it ? { n: itemName(it), ic: itemIconURL(it), c: itemColor(it), rar: it.rar } : null; });
    if (r) fs.writeFileSync(dir + '/item.png', Buffer.from(r.ic.split(',')[1], 'base64'));
    fs.writeFileSync(dir + '/info.json', JSON.stringify({ n: nW, r }));
    console.log('scene s7', JSON.stringify(r && { n: r.n, rar: r.rar }));
  }
  // S8: vier Bosse
  const bosses = [['s8a', 1, 5, 'frostra', ['eisgeist', 'icez'], 1], ['s8b', 3, 6, 'morbus', ['toxslime', 'seuche'], 0], ['s8c', 0, 7, 'varkas', ['todesritter', 'skelmage'], 1], ['s8d', 2, 8, 'pyraxis', ['imp', 'lavadaemon'], 1]];
  for (const [name, ci, act, boss, kinds, sk] of bosses) {
    if (!R.want(name)) continue;
    await R.ev(([ci, act, boss, kinds]) => { __vp(boss === 'pyraxis' ? 2.8 : 3.5); __fight(ci, act, kinds, { boss, by: boss === 'pyraxis' ? -62 : -48, bx: 6, keepN: 3, dist: 54 }); __keep(0); __step(26); __snap(); }, [ci, act, boss, kinds]);
    await R.cap(name, 28, `i => { __keep(0); for (const e of enemies) if (e.boss) { e.tcd = 9; e.x += (P.x + 8 - e.x) * .45; e.y += (P.y - (e.t === 'pyraxis' ? 52 : e.t === 'frostra' ? 50 : 38) - e.y) * .45; } if (i === 8 || i === 20) { P.cds[${sk}] = 0; useSkill(${sk}); } }`);
  }
  // S9: Horde mit Champion
  if (R.want('s9')) {
    await R.ev(() => { __vp(2.4); __fight(3, 4, ['skeleton', 'zombie', 'berserker', 'chort', 'goblin', 'orc', 'skelarcher'], { keepN: 16, dist: 70, elite: true, champ: 'orc', champName: 'Kerax Blutdurst' }); for (let i = 0; i < 10; i++) { const a = i / 10 * 6.283; spawnEnemy(pick(__kinds), { x: P.x + Math.cos(a) * 90, y: P.y + Math.sin(a) * 55, instant: true }); } __keep(0); __step(20); __snap(); });
    await R.cap('s9', 72, `i => { __keep(1); if (i === 0 || i === 40) { P.rage = 100; doUlt(); } if (i % 10 === 3) { P.cds[0] = 0; useSkill(0); } if (i === 20) { P.cds[2] = 0; useSkill(2); } }`);
  }
  // Weltkarte als Standbild
  if (R.want('map')) {
    const dir = R.out + 'map'; fs.rmSync(dir, { recursive: true, force: true }); fs.mkdirSync(dir, { recursive: true });
    await R.ev(() => { activateChar(2); P.act = 7; P.map = genMap(7); G = null; enemies = []; openMap(); });
    await R.ev(() => __step(10));
    await R.page.screenshot({ path: dir + '/map.jpg', type: 'jpeg', quality: 92 });
    console.log('map');
  }
  await R.close();
})();
