// Meisterschaft (5.0): Stufen, Ränge, Werte, alte Spielstände, alle Fähigkeiten aller Klassen auf Rang I und VI,
// Talente-Tab auf einem Touch-Handy (hoch und quer) und Bildfolgen einzelner Fähigkeiten auf Rang I, III und VI.
// Aufruf: node mastery.js [bildordner]   (Bilder zum Ansehen: <ordner>/talente-*.png, <ordner>/folge-*.png)
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
const OUT = process.argv[2] || '/tmp/klingenhort-test/mastery';
const LVS = (process.env.MLV || '1,20,50').split(',').map(Number); // Stufen der Bildfolgen (MLV=1,10,20,30,40,50 zeigt alle Ränge)
const BASE = (process.env.BASE || 'http://localhost:8777/').replace(/\/?$/, '/');
const fails = [], ok = (c, msg) => { if (!c) fails.push(msg); console.log((c ? '  ok   ' : '  FAIL ') + msg); };
fs.mkdirSync(OUT, { recursive: true });

// Raum mit festgehaltenen, unsterblichen Gegnern rechts vom Helden (im Browser ausgeführt)
const ARENA = `
window.mtArena = (n, opt) => {
  opt = opt || {};
  hideOverlay(); startRoom('kampf', 0); G.waves = []; G.pending = []; G.phase = 'fight'; G.wi = 0;
  P.x = AW / 2 - 70; P.y = (BD.y0 + BD.y1) / 2; P.inv = 1e9; P.res = 999; P.rage = 0; P.cds = [0, 0, 0]; P.aim = 0; P.face = 1;
  const pos = opt.near ? [[28, 0], [40, -14], [40, 14], [60, 0], [22, 22], [22, -22]] : [[95, 0], [130, -22], [128, 24], [165, 4], [60, 30], [70, -30]];
  for (let i = 0; i < n; i++) { const e = spawnEnemy(opt.type || 'skeleton', { x: P.x + pos[i % 6][0], y: P.y + pos[i % 6][1], instant: true }); e.hp = e.maxHp = 1e9; e.stun = 1e9; }
  setState('play'); showHud(true);
};
window.mtStep = (n, dt) => { for (let i = 0; i < n; i++) { flash.a = Math.max(0, flash.a - (dt || 1 / 60) * 1.6); if (state === 'play' || state === 'dead') update(dt || 1 / 60); render(); } };
`;

(async () => {
  const b = await chromium.launch();
  const page = await b.newPage({ viewport: { width: 844, height: 390 }, locale: 'de-DE' });
  const errs = []; page.on('pageerror', e => errs.push(e.message));
  await page.goto(BASE + 'index.html'); await page.evaluate(() => localStorage.clear()); await page.reload(); await page.waitForTimeout(1500);
  await page.addScriptTag({ content: ARENA });
  console.log('Meisterschaft: Regeln');

  const r = await page.evaluate(() => {
    const o = {};
    o.lv10 = MCUM[10]; o.lv20 = MCUM[20]; o.lv50 = MCUM[50];
    o.pts = ['m1', 'k3', 'a3', 'r1', 'ku'].map(mastPts).join(',');
    // alter Spielstand ohne Meisterschaft, kaputte Werte
    const c = newChar('mage', 'Alt', 'normal', false); delete c.mastery; SAVE.chars.push(c);
    const d = newChar('rogue', 'Kaputt', 'normal', false); d.mastery = { r1: 'abc', r2: -5, r3: null, ru: 1e99 }; SAVE.chars.push(d);
    activateChar(1); o.broken = P.mastery.r1 === 0 && P.mastery.r2 === 0 && P.mastery.r3 === 0 && P.mastery.ru === MCUM[50] && mastLv('ru') === 50;
    activateChar(0); o.old = !!P.mastery && typeof P.mastery === 'object' && !Object.keys(P.mastery).length && mastLv('m1') === 1;
    const cd0 = skillCd(1), cost0 = skillCost(1); o.lv1Same = Math.abs(cd0 - SKILLS.m2.cd * (1 - P.st.cdr)) < 1e-9 && cost0 === SKILLS.m2.cost;
    saveChar(); o.saved = JSON.parse(localStorage.getItem(SAVE_KEY)).chars[0].mastery !== undefined;
    // Stufe 50: −20 % Abklingzeit, −24,5 % Kosten
    P.mastery.m2 = MCUM[50]; computeStats(); o.cd50 = skillCd(1) / cd0; o.cost50 = skillCost(1);
    o.rankMods = [mod('m2Freeze'), mod('m2Rad'), mod('m2Dmg'), mod('m2Armor')].map(v => +v.toFixed(3)).join(',');
    // Kampf: Punkte, Schaden je Stufe, Aufstieg
    P.mastery = { m1: MCUM[21] }; computeStats(); mtArena(3);
    const base = playerW().dmg; useSkill(0); const pr = projs[projs.length - 1];
    o.dmg21 = pr && pr.w ? pr.w.dmg / base : 0; o.sk21 = pr && pr.w && pr.w.sk ? pr.w.sk.r : -1; o.gain = P.mastery.m1 - MCUM[21];
    P.mastery.m1 = MCUM[10] - 1; computeStats(); P.cds = [0, 0, 0]; P.res = 999; useSkill(0);
    o.rankUp = mastLv('m1') === 10 && $('banTitle').textContent; o.rad = mod('m1Rad');
    P.mastery.m3 = 0; P.cds = [0, 0, 0]; useSkill(2); o.gainM3 = P.mastery.m3;
    P.rage = 100; P.mastery.mu = 0; doUlt(); o.gainUlt = P.mastery.mu;
    // im Versteck keine Punkte
    SAVE.meta.hide.intro = true; enterHideout(); P.mastery.m2 = 5; P.cds = [0, 0, 0]; P.res = 999; useSkill(1); o.hide = P.mastery.m2;
    // Aussehen: Rang I unverändert, VI golden, Bild umgefärbt (ohne ctx.filter)
    o.vis0 = mastVis('m1', 0) === null; o.vis5 = mastVis('m1', 5).gold && mastVis('m1', 5).sc > 1.3;
    const sk = mastVis('m1', 3), cimg = skFx('fireball', sk), px = cimg.getContext('2d').getImageData(0, 0, cimg.width, cimg.height).data; let blue = 0, warm = 0;
    for (let i = 0; i < px.length; i += 4) if (px[i + 3] > 200) { if (px[i + 2] > px[i] + 40) blue++; else if (px[i] > px[i + 2] + 40) warm++; }
    o.blueFire = blue > warm * 2;
    o.allTables = Object.keys(SKILLS).every(id => MASTERY[id] && MASTERY[id].h.length === 4 && MASTERY[id].up.length === 5 && MASTERY[id].up.every(u => typeof u[1] === 'string' && u[1].length > 3));
    return o;
  });
  ok(r.lv10 >= 800 && r.lv10 <= 1400, `Rang II nach ${r.lv10} Punkten (≈ ${(r.lv10 / .38 / 3600).toFixed(1)} h Kampf mit der Fähigkeit)`);
  ok(r.lv50 > 150000, `Stufe 50 nach ${r.lv50} Punkten (≈ ${Math.round(r.lv50 / .38 / 3600)} h) – Stufe 20 nach ${r.lv20}`);
  ok(r.pts === '1,5,7,2,5', 'Punkte je Einsatz nach Abklingzeit (Feuerball 1, Schildwall 5, Waldgeist 7, Ultimative 5): ' + r.pts);
  ok(r.old, 'alter Spielstand ohne Meisterschaft lädt (Stufe 1)');
  ok(r.broken, 'kaputte Meisterschafts-Werte werden repariert');
  ok(r.lv1Same, 'Stufe 1: Abklingzeit und Kosten wie bisher');
  ok(r.saved, 'Meisterschaft wird mit dem Helden gespeichert');
  ok(Math.abs(r.cd50 - .804) < .002 && r.cost50 === 26, `Stufe 50: Abklingzeit ×${r.cd50.toFixed(3)}, Kosten ${r.cost50} statt 35`);
  ok(r.rankMods === '0.6,0.3,0.25,1', 'Frostnova Rang VI: alle Rang-Verbesserungen aktiv (' + r.rankMods + ')');
  ok(Math.abs(r.dmg21 - 1.4) < .001 && r.sk21 === 2, `Stufe 21: +40 % Schaden (×${r.dmg21.toFixed(3)}), Aussehen Rang III`);
  ok(r.gain === 1 && r.gainM3 === 2 && r.gainUlt === 5, `Punkte im Kampf: Feuerball +${r.gain}, Kettenblitz +${r.gainM3}, Ultimative +${r.gainUlt}`);
  ok(/FEUERBALL – GESELLE/.test(r.rankUp || '') && Math.abs(r.rad - .15) < 1e-9, 'Aufstieg: Banner „' + r.rankUp + '“ und Rang-Verbesserung (+15 % Radius)');
  ok(r.hide === 5, 'im Versteck (Trainingspuppe) gibt es keine Punkte');
  ok(r.vis0 && r.vis5, 'Rang I sieht aus wie bisher, Rang VI golden und größer');
  ok(r.blueFire, 'Feuerball Rang IV: Bild pixelweise blau umgefärbt (läuft ohne ctx.filter)');
  ok(r.allTables, 'alle 16 Fähigkeiten haben Farben und fünf Rang-Verbesserungen');
  const srcs = ['js/mastery.js', 'js/render.js'].map(f => fs.readFileSync(path.join(__dirname, '../..', f), 'utf8')).join('\n');
  ok(!/\.filter\s*=/.test(srcs), 'kein ctx.filter nötig (ältere iPhones)');

  console.log('Meisterschaft: alle Fähigkeiten aller Klassen (Rang I und VI)');
  for (const cls of ['knight', 'mage', 'rogue', 'ranger']) for (const lv of [1, 50]) {
    const res = await page.evaluate(([cls, lv]) => {
      const c = newChar(cls, 'Test', 'normal', false); SAVE.chars.push(c); activateChar(SAVE.chars.length - 1); P.lv = 30; P.inv = 1e9;
      for (const id of classSkills()) P.mastery[id] = MCUM[lv]; computeStats();
      mtArena(6, { near: 1 }); const seen = { sk: 0, boom: 0, trail: 0 }; let hits = 0; const hp = () => enemies.reduce((s, e) => s + (e.maxHp - e.hp), 0);
      for (let i = 0; i < 3; i++) { P.cds = [0, 0, 0]; P.res = 999; P.dash = P.leap = null; P.spin = 0; P.volley = 0; const h0 = hp(); useSkill(i); for (let k = 0; k < 90; k++) { mtStep(1); if (fx.some(f => f.sk) || projs.some(p => p.w && p.w.sk) || allies.some(a => a.sk) || traps.some(t => t.sk) || (P.dash && P.dash.sk) || P.spinSk || P.wallSk) seen.sk++; } if (hp() > h0 || ['k3', 'r3', 'a2', 'a3'].includes(classSkills()[i])) hits++; }
      P.rage = 100; P.dash = P.leap = null; P.spin = 0; const h0 = hp(); doUlt(); mtStep(200); if (hp() > h0) hits++;
      for (const e of enemies) e.x = P.x + 4; mtStep(120); // Fallen auslösen, Klone/Geister arbeiten lassen
      seen.trail = parts.filter(p => p.glow).length;
      return { seen, hits, inv: P.st.hp > 0, lv: mastLv(classSkills()[0]) };
    }, [cls, lv]);
    ok(res.hits === 4 && (lv === 1 ? res.seen.sk === 0 : res.seen.sk > 0), `${cls} Stufe ${lv}: 3 Fähigkeiten + Ultimative ohne Fehler, ${lv === 1 ? 'Originalaussehen' : 'Rang-Aussehen sichtbar'}`);
  }
  ok(!errs.length, 'keine Fehler beim Wirken' + (errs.length ? ': ' + errs.slice(0, 3).join(' | ') : ''));

  // Bildfolgen: Fähigkeit auf Rang I, III, VI (Stufe 1, 20, 50) – je Zeile 6 Bilder
  console.log('Meisterschaft: Bildfolgen Stufe ' + LVS.join(' / ') + ' → ' + OUT);
  const SEQ = [['mage', 'm1', 0, 7], ['mage', 'm3', 2, 3], ['mage', 'mu', 3, 14], ['knight', 'k2', 1, 7], ['knight', 'ku', 3, 9], ['knight', 'k3', 2, 9], ['rogue', 'r2', 1, 4], ['rogue', 'ru', 3, 14], ['ranger', 'a1', 0, 4], ['ranger', 'a3', 2, 20]];
  for (const [cls, id, slot, step] of SEQ) {
    const png = await page.evaluate(async ([cls, id, slot, step, LVS]) => {
      const c = newChar(cls, 'Bild', 'normal', false); SAVE.chars.push(c); activateChar(SAVE.chars.length - 1); P.lv = 30;
      const rows = [], CW = 250, CH = 120, S = 2;
      for (const lv of LVS) {
        P.mastery = {}; P.mastery[id] = MCUM[lv]; computeStats(); mtArena(4); mtStep(30); parts = []; texts = []; flash.a = 0;
        const frames = [];
        if (slot === 3) { P.rage = 100; doUlt(); } else useSkill(slot);
        for (let f = 0; f < 6; f++) {
          mtStep(step);
          const px0 = Math.round(P.x - CX) - 50, py0 = Math.round(P.y - CY) - 78; if (f === 0) frames.ox = px0, frames.oy = py0;
          const k = document.createElement('canvas'); k.width = CW; k.height = CH; k.getContext('2d').drawImage(cv, frames.ox, frames.oy, CW, CH, 0, 0, CW, CH); frames.push(k);
        }
        rows.push({ lv, frames });
      }
      const L = 110, m = document.createElement('canvas'); m.width = L + 6 * CW * S + 5 * 4; m.height = rows.length * (CH * S + 4);
      const g = m.getContext('2d'); g.imageSmoothingEnabled = false; g.fillStyle = '#110e17'; g.fillRect(0, 0, m.width, m.height);
      rows.forEach((r, i) => {
        const y = i * (CH * S + 4), rk = mrank(r.lv), sk = mastVis(id, rk);
        g.fillStyle = sk ? sk.col : '#efe2bf'; g.font = '14px monospace'; g.fillText(SKILLS[id].n, 6, y + 24); g.fillText(_t('Rang') + ' ' + MROMAN[rk], 6, y + 46); g.fillText(_t('Stufe') + ' ' + r.lv, 6, y + 68);
        r.frames.forEach((k, j) => g.drawImage(k, L + j * (CW * S + 4), y, CW * S, CH * S));
      });
      return m.toDataURL('image/png').split(',')[1];
    }, [cls, id, slot, step, LVS]);
    const file = path.join(OUT, 'folge-' + id + '.png'); fs.writeFileSync(file, Buffer.from(png, 'base64'));
    ok(fs.statSync(file).size > 5000, 'Bildfolge ' + id + ' gespeichert');
  }
  ok(!errs.length, 'keine Fehler bei den Bildfolgen' + (errs.length ? ': ' + errs.slice(0, 3).join(' | ') : ''));
  await page.close();

  // Talente-Tab auf dem Touch-Handy, hoch und quer
  for (const [W, H] of [[390, 844], [844, 390]]) {
    console.log(`Meisterschaft: Talente-Tab ${W}x${H}`);
    const ctx = await b.newContext({ viewport: { width: W, height: H }, isMobile: true, hasTouch: true, locale: 'de-DE' });
    const pg = await ctx.newPage(); const perr = []; pg.on('pageerror', e => perr.push(e.message));
    await pg.goto(BASE + 'index.html'); await pg.evaluate(() => localStorage.clear()); await pg.reload(); await pg.waitForTimeout(1500);
    await pg.addScriptTag({ content: ARENA });
    await pg.evaluate(() => {
      const c = newChar('mage', 'Meisterin', 'normal', false); c.story = { prolog: 1 }; SAVE.chars.push(c); activateChar(0); P.lv = 24;
      P.mastery = { m1: MCUM[23] + 300, m2: MCUM[9] + 40, m3: MCUM[50], mu: 12 }; computeStats(); saveChar();
      mtArena(2); mtStep(40);
    });
    await pg.waitForTimeout(700);
    const pips = await pg.evaluate(() => ['bS1', 'bS2', 'bS3', 'bUlt'].map(id => { const p = $(id).querySelector('.mpip'); return p ? p.textContent : ''; }).join(','));
    ok(pips === 'III,,VI,', 'Rang-Zeichen auf den Fähigkeits-Knöpfen: ' + pips);
    await pg.screenshot({ path: path.join(OUT, `hud-${W}x${H}.png`) });
    await pg.evaluate(() => { if (SAVE.meta.pets) SAVE.meta.pets.starter = true; hideOverlay(); openMap(); if (typeof DLG !== 'undefined' && DLG) DLG.skip(); }); // Begleiter-Wahl schon erledigt
    await pg.waitForTimeout(400);
    const tap = async sel => { const el = pg.locator(sel).first(); await el.scrollIntoViewIfNeeded().catch(() => { }); await el.tap({ timeout: 4000 }); await pg.waitForTimeout(300); };
    await tap('[data-act="char"]'); await tap('[data-act="ctab"][data-id="tal"]');
    const ui = await pg.evaluate(() => ({ n: document.querySelectorAll('.mst').length, rk: [...document.querySelectorAll('.mst .mrk')].map(e => e.textContent).join(','), txt: document.querySelector('.mst') ? document.querySelector('.mst').innerText : '', wide: panel.scrollWidth > panel.clientWidth + 1 }));
    ok(ui.n === 4 && ui.rk === 'III,I,VI,I', `4 Fähigkeiten mit Rang (${ui.rk})`);
    ok(/Experte · Stufe 23\/50/.test(ui.txt) && /\+44 % Schaden/.test(ui.txt) && /Ab Stufe 30: Rang IV Meister/.test(ui.txt), 'Zeile zeigt Rang, Stufe, Bonus und nächsten Rang');
    ok(!ui.wide, 'nichts ragt seitlich heraus');
    const sum = pg.locator('details.mall summary').first(); await sum.scrollIntoViewIfNeeded(); const bb = await sum.boundingBox();
    ok(bb && bb.height >= 44, `„Alle Ränge“ groß genug zum Antippen (${bb && Math.round(bb.height)} px)`);
    await pg.locator('.mst').first().evaluate(e => e.closest('.row').scrollIntoView({ block: 'start' })); await pg.waitForTimeout(200);
    await pg.screenshot({ path: path.join(OUT, `talente-${W}x${H}.png`) });
    await sum.tap(); await pg.waitForTimeout(250);
    ok(await pg.evaluate(() => document.querySelector('details.mall').open && document.querySelectorAll('details.mall')[0].querySelectorAll('div').length === 6), 'Antippen öffnet alle sechs Ränge');
    await pg.locator('.mst').nth(2).evaluate(e => e.closest('.row').scrollIntoView({ block: 'start' })); await pg.locator('details.mall summary').nth(2).tap(); await pg.waitForTimeout(250);
    await pg.screenshot({ path: path.join(OUT, `talente-offen-${W}x${H}.png`) });
    ok(!perr.length, 'keine Fehler im Spiel' + (perr.length ? ': ' + perr.slice(0, 3).join(' | ') : ''));
    await ctx.close();
  }
  await b.close();
  process.exit(fails.length ? 1 : 0);
})().catch(e => { console.log('  FAIL Abbruch: ' + e.message.split('\n')[0]); process.exit(1); });
