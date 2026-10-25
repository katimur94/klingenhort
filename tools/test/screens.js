// Fotografiert alle Bildschirme zum Ansehen: node screens.js <breite> <höhe> <ausgabeordner> [pc]
// Ohne „pc“ als Touch-Handy. metrics.txt zeigt, wie weit jede Tafel gescrollt werden muss.
// Mit KH_LANG=en (tr, es, it, fr) in dieser Sprache: prüft zusätzlich, dass kein Text fehlt
// (fehlt.txt) und nirgends Deutsch stehen bleibt – im Menü, im HUD und auf dem Spielfeld (deutsch.txt).
const { chromium } = require('playwright');
const fs = require('fs');
const [W, H, OUT] = [+process.argv[2] || 844, +process.argv[3] || 390, process.argv[4] || '/tmp/klingenhort-test/screens'];
const LG = process.env.KH_LANG || 'de', LOC = { de: 'de-DE', en: 'en-US', tr: 'tr-TR', es: 'es-ES', it: 'it-IT', fr: 'fr-FR' }[LG];
// typisch deutsche Wörter (keine, die es auch in einer der anderen Sprachen gibt)
const DE_WORDS = new Set('und nicht eine einen einem einer für ist mit sich noch wird werden oder auch kein keine keinen mehr zurück schaden gegner stufe gegenstand gegenstände fähigkeit fähigkeiten kosten kaufen verkaufen wählen neue neuer neues spielen dein deine deinen deiner ihr wenn jetzt beim zum zur vom über gegen durch ohne sehr schon immer hier dann weil sind habe kann diese dieser dieses leben abklingzeit wut trank heiltrank weiter schließen anlegen ablegen verschmelzen aufwerten versteck helden karte weltkarte'.split(' '));
const DE_CHARS = LG === 'tr' ? /[äÄß]/ : /[äöüÄÖÜß]/;
const NATIVE = new Set(['Deutsch', 'English', 'Türkçe', 'Español', 'Italiano', 'Français']); // Sprachwahl: jede Sprache in ihrer Schreibweise
const PC = process.argv[5] === 'pc', BASE = (process.env.BASE || 'http://localhost:8777/').replace(/\/?$/, '/');
(async () => {
  fs.rmSync(OUT, { recursive: true, force: true }); fs.mkdirSync(OUT, { recursive: true });
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: PC ? 1 : 2, isMobile: !PC, hasTouch: !PC, locale: LOC });
  if (LG !== 'de') await ctx.addInitScript(() => {
    window.__I18N_MISS = 1; window.__CTXT = new Set();
    for (const f of ['fillText', 'strokeText']) { const o = CanvasRenderingContext2D.prototype[f]; CanvasRenderingContext2D.prototype[f] = function (t, ...a) { if (window.__CTXT.size < 5000) window.__CTXT.add(String(t)); return o.call(this, t, ...a); }; }
  });
  const page = await ctx.newPage();
  const german = [], errs = []; page.on('pageerror', e => errs.push(e.message)); page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  await page.goto(BASE + 'index.html'); await page.waitForTimeout(1500);
  await page.evaluate(() => {
    localStorage.clear(); loadAll();
    const W_ = (base, form, tier, rar, up, myth) => { const it = makeItem({ slot: 'weapon', base, form, tier, rar, myth }); it.up = up || 0; return it; }, A = (slot, tier, rar, up) => { const it = makeItem({ slot, base: slot, tier, rar }); it.up = up || 0; return it; };
    const c = newChar('knight', 'Brunhild', 'normal', false, { body: 'knight_f', hair: 2, skin: -1, accent: 4, cape: 0 }); c.lv = 24; c.act = 3; c.maxAct = 4; c.story = { a1: 1, a2: 1, a3: 1 };
    SAVE.chars.push(c); activateChar(0);
    Object.assign(P.gear, { weapon: W_('sword', 'zwei', 3, 4, 7), armor: A('armor', 3, 3, 5), helm: A('helm', 2, 2, 3) });
    for (let i = 0; i < 14; i++) P.bag.push(randomItem(12, ri(0, 4)));
    P.gold = 12345; P.fate = 7; P.sp = 3; for (const k of MATORDER) P.mats[k] = ri(2, 30); P.gems['rubin:1'] = 4; P.gems['saphir:0'] = 3; P.gems['smaragd:2'] = 1;
    SAVE.meta.cos = Object.keys(COSM).slice(0, 6); SAVE.meta.hide.intro = true; SAVE.meta.hide.b = { schmiede: 2, alchemie: 3, juwelier: 1, lager: 2, training: 2, tempel: 3, bibliothek: 2, mine: 1, garten: 1 }; SAVE.meta.hide.rooms = 9;
    SAVE.meta.lore = [0, 1, 2, 5]; for (const k of ['goblin', 'skeleton', 'orc', 'ogre', 'imp']) SAVE.meta.bestiary[k] = 12;
    computeStats(); P.hp = P.st.hp; saveChar(); persist();
  });
  const shot = async (name, fn, wait) => {
    try { if (fn) await page.evaluate(fn); } catch (e) { errs.push(name + ': ' + e.message); }
    await page.waitForTimeout(wait || 350);
    await page.screenshot({ path: `${OUT}/${name}.png` });
    if (LG !== 'de') {
      const texts = await page.evaluate(() => {
        const r = [], vis = el => el && !el.hidden && el.offsetParent !== null;
        for (const id of ['ov', 'hud', 'objective', 'banner', 'toast', 'bossbar', 'ctlbar', 'skillbar', 'combo']) { const el = document.getElementById(id); if (vis(el) || (el && id === 'ov' && !el.hidden)) r.push(el.innerText); }
        for (const el of document.querySelectorAll('[aria-label]')) if (vis(el)) r.push(el.getAttribute('aria-label'));
        r.push(...window.__CTXT); window.__CTXT.clear();
        return r;
      });
      for (const t of texts) for (const line of String(t).split('\n')) {
        if (NATIVE.has(line.trim())) continue;
        const w = line.toLowerCase().split(/[^\p{L}]+/u).find(x => DE_WORDS.has(x));
        if (w || DE_CHARS.test(line)) german.push(`${name}: ${w ? '„' + w + '“' : 'Umlaut'} in: ${line.trim().slice(0, 140)}`);
      }
    }
    // Höhe des Inhalts im Panel: zeigt, wie viel gescrollt werden muss
    const m = await page.evaluate(() => { const p = document.getElementById('panel'); const ov = document.getElementById('ov'); return ov.hidden ? null : { sh: p.scrollHeight, ch: p.clientHeight, w: p.clientWidth }; });
    fs.appendFileSync(`${OUT}/metrics.txt`, `${name} ${m ? `scroll ${m.sh}/${m.ch} (${(m.sh / m.ch).toFixed(1)}x) w ${m.w}` : '-'}\n`);
  };
  await shot('00_news', () => { SAVE.meta.seenVer = '4.0.1'; newsAuto = false; titleScene(); showTitle(); });
  await shot('01_title', () => { titleScene(); showTitle(); });
  await shot('02_create', () => { CS = { cls: 'knight', diff: 'normal', hc: false, name: '', look: null }; showCreate(); });
  await shot('03_dialog', () => { dialog(PROLOG, () => { }, 'Klingenhort'); });
  await shot('04_map', () => { activateChar(0); P.map = genMap(3); openMap(); }, 600);
  await shot('04b_map_sel', () => { const av = availableNodes(); mapSel = av[av.length - 1]; openMap(); }, 400);
  await shot('05_char_gear', () => { selItem = null; openChar('gear', 'map'); });
  await shot('06_char_gear_sel', () => { selItem = P.bag[2].uid; openChar('gear'); });
  await shot('07_char_tal', () => { openChar('tal'); });
  await shot('08_char_vorrat', () => { openChar('vorrat'); });
  await shot('09_char_look', () => { openChar('look'); });
  await shot('10_char_para', () => { openChar('para'); });
  await shot('11_wb_up', () => { wbTab = 'up'; openWorkbench('node'); });
  await shot('11b_wb_up_scroll', () => { panel.scrollTop = 9999; });
  await shot('12_wb_fuse', () => { wbTab = 'fuse'; openWorkbench(); fuseA = P.gear.weapon.uid; const b2 = P.bag.find(x => x.slot === 'weapon'); fuseB = b2 && b2.uid; openWorkbench(); });
  await shot('13_wb_forge', () => { wbTab = 'forge'; openWorkbench(); });
  await shot('14_merchant', () => { P.map.pos = { r: 0, i: 0 }; mTab = 'buy'; openMerchant(); });
  await shot('15_shrine', () => { openShrine(); });
  await shot('16_event', () => { openEvent(); });
  await shot('17_rest', () => { openRest(); });
  await shot('18_riddle', () => { openRiddle(); });
  await shot('19_settings', () => { showSettings(); });
  await shot('19b_lang', () => { showLang('settings'); });
  await shot('20_controls', () => { showControls(); });
  await shot('21_hideout', () => { enterHideout(); }, 1200);
  await shot('22_hide_station', () => { openStation('schmiede'); });
  await shot('23_temple', () => { openStation('tempel'); });
  await shot('24_library', () => { openStation('bibliothek'); });
  await shot('25_campfire', () => { openStation('feuer'); });
  await shot('26_stash', () => { openStation('lager'); });
  await shot('27_mirror', () => { openStation('spiegel'); });
  await shot('28_fight', () => { backToHide(); P.map = genMap(3); P.map.pos = { r: 0, i: 0 }; startRoom('kampf', 1); }, 2500);
  await shot('29_pause', () => { showPause(); });
  await shot('30_ctleditor', () => { openCtlEditor('pause'); }, 500);
  await shot('31_boss', () => { closeCtlEditor(); startRoom('boss', 6); for (const e of enemies) e.hp = 0; }, 4000);
  await shot('32_death', () => { showDeath(); });
  await shot('33_act', () => { P.act = 4; openActScreen(); });
  await shot('34_ach', () => { showAch(); });
  await shot('35_best', () => { showBestiary(); });
  await shot('36_hall', () => { showHall(); });
  await shot('37_code', () => { showCode(); });
  // 5.0: Begleiter, Bauteile, Meisterschmiede, Tauschen, Aussehen
  await shot('38_pet_starter', () => { SAVE.meta.pets.starter = false; titleScene(); showTitle(); petStarter('title'); });
  await shot('39_pet', () => { SAVE.meta.pets.starter = true; petGive('drache', { nm: 'Funki', lv: 52 }); eggGive('eule', true); activateChar(0); openChar('pet', 'map'); }, 500);
  await shot('40_parts', () => { Object.assign(P.parts, { 'klinge:3': 2, 'griff:2': 4, 'kern:feuer:2': 1, 'platte:1': 5, 'futter:4': 1, 'rune:licht:3': 2 }); openChar('parts'); });
  await shot('41_wb_mw', () => { wbTab = 'mw'; openWorkbench('node'); });
  await shot('42_wb_zer', () => { wbTab = 'zer'; openWorkbench(); });
  await shot('43_trade', () => { trShow(); });
  await shot('44_trade_deal', () => { TRD.tab = 'deal'; trShow(); });
  await shot('45_mirror_looks', () => { enterHideout(); openStation('spiegel'); panel.scrollTop = 9999; }, 1200);
  console.log(errs.length ? '  FAIL Fehler: ' + errs.slice(0, 3).join(' | ') : '  ok   ' + W + 'x' + H + (LG !== 'de' ? ' ' + LG : '') + ' alle Bildschirme ohne Fehler → ' + OUT);
  let bad = errs.length;
  if (LG !== 'de') {
    const miss = await page.evaluate(() => [...I18N_MISS]), uniq = [...new Set(german)];
    fs.writeFileSync(`${OUT}/fehlt.txt`, miss.join('\n')); fs.writeFileSync(`${OUT}/deutsch.txt`, uniq.join('\n'));
    console.log(miss.length ? `  FAIL ${miss.length} Texte ohne Übersetzung (${LG}): ${miss.slice(0, 3).map(x => JSON.stringify(x.slice(0, 50))).join(', ')} → fehlt.txt` : `  ok   alle Texte übersetzt (${LG})`);
    console.log(uniq.length ? `  FAIL ${uniq.length}× Deutsch auf dem Bildschirm (${LG}): ${uniq.slice(0, 3).join(' | ')} → deutsch.txt` : `  ok   kein Deutsch auf dem Bildschirm (${LG})`);
    bad += miss.length + uniq.length;
  }
  await b.close();
  process.exit(bad ? 1 : 0);
})();
