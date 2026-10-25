// Aufnahme-Werkzeug für TikTok-Clips: übernimmt das Spiel im Browser und nimmt bildgenau auf.
// Benutzung in einer Szenen-Datei:
//   const H = require('../harness');
//   const R = await H.open({ out: '/tmp/klingenhort-clip/raw' });
//   await R.ev(() => { __vp(3.5); __fight(1, 5, ['skeleton', 'zombie'], { keepN: 6 }); __step(20); });
//   await R.cap('kampf', 60, `i => { __keep(.8); if (i === 0) { P.rage = 100; doUlt(); } }`);
//   await R.close();
// Wichtig: Funktionen für jedes Bild (per) laufen im Browser. Sie dürfen keine Variablen aus Node
// benutzen – Werte daher als Text einsetzen (Template-String) oder als zweites Argument an ev() geben.
const { chromium } = require('playwright');
const fs = require('fs');

// Läuft im Browser: Spielstand mit vier Vorzeige-Helden, Zeit in festen Schritten, Hilfen für Szenen
function setup() {
  localStorage.clear(); loadAll();
  const W = (base, form, tier, rar, up, myth) => { const it = makeItem({ slot: 'weapon', base, form, tier, rar, myth }); it.up = up || 0; return it; };
  const A = (slot, tier, rar, up, myth) => { const it = makeItem({ slot, base: slot, tier, rar, myth }); it.up = up || 0; return it; };
  const hero = (cls, name, look, gear) => {
    const c = newChar(cls, name, 'normal', false, look); c.lv = 40; c.act = 5; c.maxAct = 9; c.story = {}; for (let a = 1; a <= 12; a++) c.story['a' + a] = 1;
    SAVE.chars.push(c); activateChar(SAVE.chars.length - 1); Object.assign(P.gear, gear());
    for (const tid of TALENTS[cls].flatMap(b => b[1].map(n => n.id))) P.talents[tid] = 2;
    P.gold = 25000; for (const k of MATORDER) P.mats[k] = 40; computeStats(); saveChar();
  };
  SAVE.meta.cos = Object.keys(COSM); SAVE.meta.hide.intro = true; SAVE.meta.seenVer = VERSION;
  SAVE.meta.hide.b = { schmiede: 4, alchemie: 2, juwelier: 3, lager: 4, training: 7, tempel: 3, bibliothek: 3, mine: 4, garten: 3 };
  // 0 Ritterin, 1 Magier, 2 Assassine, 3 Bogenschützin
  hero('knight', 'Brunhild', { body: 'knight_f', hair: -1, skin: -1, accent: 4, cape: -1, ccape: 'c_koenig' }, () => ({ weapon: W('sword', 'zwei', 4, 4, 10), armor: A('armor', 4, 4, 9), helm: A('helm', 4, 2, 8) }));
  hero('mage', 'Ilvaris', { body: 'wizard_m', hair: 5, skin: -1, accent: -1, cape: 4, wings: 'w_drache' }, () => ({ weapon: W('staff', 'mond', 7, 6, 9, 'zorn'), armor: A('armor', 6, 4, 8), helm: A('helm', 7, 2, 6) }));
  hero('rogue', 'Schatten', { body: 'doc', hair: -1, skin: 7, accent: -1, cape: 3, aura: 'a_schatten', wings: 'w_nacht' }, () => ({ weapon: W('dagger', 'kris', 5, 4, 9), armor: A('armor', 5, 3, 8), helm: A('helm', 2, 6, 5, 'krone') }));
  hero('ranger', 'Faelwen', { body: 'elf_f', hair: 6, skin: -1, accent: -1, cape: 1, wings: 'w_fee', aura: 'a_gold' }, () => ({ weapon: W('bow', 'reflex', 6, 4, 9), armor: A('armor', 3, 3, 8), helm: A('helm', 6, 4, 6) }));
  persist();
  // Banner, Hinweise und Touch-Knöpfe ausblenden: Texte kommen später im Schnitt dazu
  document.head.insertAdjacentHTML('beforeend', '<style>#banner,#toast,#skillbar,#objective,#touch{display:none!important}#combo{top:150px!important}</style>');
  window.requestAnimationFrame = () => 0;
  const RT = []; window.setTimeout = (fn, ms) => { RT.push({ fn, t: T + (ms || 0) / 1000 }); return RT.length; };
  // ein Schritt = ein Videobild (30 fps); Timer laufen in Spielzeit
  window.__step = n => { for (let i = 0; i < (n || 1); i++) { for (let k = RT.length - 1; k >= 0; k--) if (RT[k].t <= T) { const r = RT.splice(k, 1)[0]; try { r.fn(); } catch (e) { } } loop(last + 1000 / 30); } };
  // Zoom: s = Bildschirmpixel pro Spielpixel (3–3.5 nah, 2.4 Übersicht)
  window.__vp = s => { SCALE = s; VW = Math.ceil(innerWidth / SCALE) + 1; VH = Math.ceil(innerHeight / SCALE) + 1; cv.width = VW; cv.height = VH; cv.style.width = VW * SCALE + 'px'; cv.style.height = VH * SCALE + 'px'; ctx.imageSmoothingEnabled = false; makeVig(); };
  window.__snap = () => { cam.x = clamp(P.x - VW / 2, 0, Math.max(0, AW - VW)); cam.y = clamp(P.y - 10 - VH / 2, 0, Math.max(0, AH - VH)); };
  // Kampf aufbauen: Held ci, Akt act, Gegnerarten kinds im Kreis; o: { boss, bx, by, champ, champName, tanky, keepN, dist, elite, type }
  window.__fight = (ci, act, kinds, o) => {
    o = o || {}; activateChar(ci); P.act = act; P.map = genMap(act); startRoom(o.type || 'kampf', 3);
    G.waves = [{ list: [] }]; G.pending = []; G.t = 999; P.inv = 99; window.__kinds = kinds; window.__o = o;
    kinds.forEach((k, i) => { const a = i / kinds.length * 6.283 + .4, d = o.dist || 46; const e = spawnEnemy(k, { x: P.x + Math.cos(a) * d, y: P.y + Math.sin(a) * d * .7, instant: true, elite: o.elite ? i % 3 === 0 : false }); if (o.tanky) e.hp = e.maxHp = e.maxHp * o.tanky; });
    if (o.boss) { const B = BOSSES.find(b => b.type === o.boss); const e = spawnEnemy(B.type, { boss: true, sc: B.sc, hpMul: 60, name: B.name, tint: B.tint, x: P.x + (o.bx || 0), y: P.y + (o.by || -50), instant: true }); e.cd = .6; $('bossName').textContent = B.name.toUpperCase(); $('bossbar').hidden = false; }
    if (o.champ) { const e = spawnEnemy(o.champ, { elite: true, champ: true, name: o.champName, tint: 'rgba(255,110,40,.35)', x: P.x + 40, y: P.y - 30, instant: true }); e.hp = e.maxHp = e.maxHp * 20; $('bossName').textContent = o.champName.toUpperCase(); $('bossbar').hidden = false; }
    G.phase = 'fight'; G.wi = 0; __snap();
  };
  // pro Bild aufrufen: Held unverwundbar, greift an, Gegner werden nachgefüllt; move = Tempo einer Kreisbewegung (0 = stehen)
  window.__keep = move => {
    P.inv = 1; P.hp = P.st.hp; P.res = P.st.resMax; keys.KeyJ = true; for (let i = 0; i < 3; i++) P.cds[i] = Math.min(P.cds[i], .2);
    const o = window.__o || {}; if (enemies.filter(e => !e.boss && !e.champ).length < (o.keepN || 6) && window.__kinds) { const a = Math.random() * 6.283; spawnEnemy(pick(window.__kinds), { x: P.x + Math.cos(a) * 60, y: P.y + Math.sin(a) * 40, instant: Math.random() < .5 }); }
    if (move) { const t = T * move; keys.KeyD = Math.cos(t) > .4; keys.KeyA = Math.cos(t) < -.4; keys.KeyS = Math.sin(t) > .6; keys.KeyW = Math.sin(t) < -.6; } else keys.KeyA = keys.KeyD = keys.KeyW = keys.KeyS = false;
    for (const e of enemies) if (e.boss) e.hp = Math.max(e.hp, e.maxHp * .55);
  };
  // Bosse vor dem Helden halten (sonst laufen oder teleportieren sie aus dem Bild)
  window.__holdBoss = dy => { for (const e of enemies) if (e.boss) { e.tcd = 9; e.x += (P.x + 8 - e.x) * .45; e.y += (P.y - (dy || 40) - e.y) * .45; } };
  window.__off = () => { keys.KeyJ = keys.KeyA = keys.KeyD = keys.KeyW = keys.KeyS = false; };
  // nur Schadenszahlen und Ultimative-Rufe zeigen, keine EP- und Beute-Texte
  const _txt = window.txt; window.txt = function (x, y, s, c, big) { s = String(s); if (/EP|^\+\d+ \D/.test(s)) return; if (!big && !/^\d+$/.test(s)) return; return _txt.apply(this, arguments); };
}

async function open(o = {}) {
  const base = (o.base || process.env.BASE || 'http://localhost:8765/').replace(/\/?$/, '/');
  const out = (o.out || '/tmp/klingenhort-clip/raw').replace(/\/?$/, '/');
  const only = o.only || (process.argv[2] ? process.argv[2].split(',') : null);
  fs.mkdirSync(out, { recursive: true });
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 540, height: 960 }, deviceScaleFactor: 2, locale: 'de-DE' });
  const errs = []; page.on('pageerror', e => errs.push(e.message));
  await page.goto(base + 'index.html'); await page.waitForTimeout(1500);
  await page.evaluate(() => document.fonts.ready);
  await page.evaluate(setup);
  const ev = (fn, arg) => page.evaluate(fn, arg);
  const runPer = async (per, i) => { if (typeof per === 'string') await ev(([src, k]) => (0, eval)('(' + src + ')')(k), [per, i]); else if (per) await ev(per, i); };
  const want = name => !only || only.includes(name);
  const dir = name => { const d = out + name; fs.rmSync(d, { recursive: true, force: true }); fs.mkdirSync(d, { recursive: true }); return d; };
  return {
    page, ev, errs, out, want, dir,
    // n Bilder aufnehmen nach raw/<name>/0000.jpg …; per(i) läuft vor jedem Bild
    async cap(name, n, per) {
      if (!want(name)) return; const d = dir(name);
      for (let i = 0; i < n; i++) { await runPer(per, i); await ev(() => __step(1)); await page.screenshot({ path: `${d}/${String(i).padStart(4, '0')}.jpg`, type: 'jpeg', quality: 92 }); }
      console.log('Szene', name, n, 'Bilder');
    },
    // Standbild der Seite oder eines Elements (selector) nach raw/<datei>
    async shot(file, selector) {
      fs.mkdirSync(require('path').dirname(out + file), { recursive: true });
      if (selector) { const el = page.locator(selector).first(); if (await el.count()) await el.screenshot({ path: out + file }); return; }
      await page.screenshot({ path: out + file, type: file.endsWith('.png') ? 'png' : 'jpeg', ...(file.endsWith('.png') ? {} : { quality: 92 }) });
    },
    // Bild als data-URL speichern (z. B. itemIconURL(it))
    saveData(file, dataURL) { fs.mkdirSync(require('path').dirname(out + file), { recursive: true }); fs.writeFileSync(out + file, Buffer.from(dataURL.split(',')[1], 'base64')); },
    // Grafiken für Endkarte und Waffen-/Helden-Animationen nach raw/assets
    async assets() {
      const d = dir('assets');
      const A = await ev(() => {
        const out = { mats: MAT.map(m => [m.n, m.m[2], m.m[1]]), weap: [], heroes: [], main: [] };
        for (const base in WFORM) for (const F of WFORM[base]) { const row = []; for (let t = 0; t < 8; t++) row.push(weaponArt({ slot: 'weapon', base, form: F.id, tier: t, rar: t >= 6 ? 4 : 2, aff: {}, gems: [] }).c.toDataURL()); out.weap.push({ base, form: F.id, n: F.n, row }); }
        const ck = k => Object.keys(COSM).filter(x => COSM[x].k === k);
        for (let i = 0; i < 60; i++) {
          const look = { body: pick(BODYORDER), hair: ri(0, HAIRS.length - 1), skin: Math.random() < .5 ? -1 : ri(0, SKINS.length - 1), accent: ri(-1, ACCENTS.length - 1), cape: ri(-1, CAPES.length - 1), wings: Math.random() < .55 ? pick(ck('wings')) : null, aura: Math.random() < .4 ? pick(ck('aura')) : null, ccape: Math.random() < .25 ? pick(ck('cape')) : null };
          const hr = Math.random() < .2 ? 6 : Math.random() < .3 ? 4 : 2;
          const c = { cls: pick(Object.keys(CLASSES)), look, dye: Math.random() < .4 ? pick(DYES).id : null, gear: { armor: { slot: 'armor', tier: ri(0, 7), rar: 2 }, helm: { slot: 'helm', tier: ri(0, 7), rar: hr, myth: hr === 6 ? 'krone' : null } } };
          out.heroes.push({ u: heroPreviewURL(c).url, aura: look.aura ? COSM[look.aura].c : null });
        }
        for (const c of SAVE.chars) out.main.push({ n: c.name, cls: CLASSES[c.cls].name, u: heroPreviewURL(c).url, aura: lookOf(c).aura ? COSM[lookOf(c).aura].c : null });
        return out;
      });
      const save = (u, f) => fs.writeFileSync(d + '/' + f, Buffer.from(u.split(',')[1], 'base64'));
      A.weap.forEach((w, i) => w.row.forEach((u, t) => save(u, `w_${i}_${t}.png`)));
      A.heroes.forEach((h, i) => save(h.u, `h_${i}.png`));
      A.main.forEach((h, i) => save(h.u, `m_${i}.png`));
      fs.writeFileSync(d + '/assets.json', JSON.stringify({ mats: A.mats, weap: A.weap.map(w => ({ base: w.base, form: w.form, n: w.n })), heroes: A.heroes.map(h => ({ aura: h.aura })), main: A.main.map(h => ({ n: h.n, cls: h.cls, aura: h.aura })) }));
      console.log('Grafiken', A.weap.length, 'Waffen,', A.heroes.length, 'Helden');
    },
    // neuester Changelog-Eintrag nach raw/news.json (für die „Was ist neu“-Szene)
    async news() {
      const N = await ev(() => ({ version: VERSION, entry: CHANGELOG[0] }));
      fs.writeFileSync(out + 'news.json', JSON.stringify(N, null, 1)); console.log('Neuigkeiten', N.version, N.entry.t);
    },
    async close() { if (errs.length) console.log('FEHLER IM SPIEL:', errs.slice(0, 5).join(' | ')); await browser.close(); return errs; }
  };
}
module.exports = { open };
