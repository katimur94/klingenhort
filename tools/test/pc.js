// PC: Steuerung, Bildschirm-Erkennung und HD-Grafik. Aufruf: node pc.js [bildordner]   (BASE = Adresse des Spiels)
// Prüft: ganzzahlige Gerätepixel je Spielpixel bei 1080p/1440p und Windows-Skalierung 100/125/150/200 %, Leinwand-Maße im HD-Modus,
// HD am PC von selbst an, Held so groß wie auf dem Handy, Ultrabreit mit Rändern, Handy unverändert (Pixel-Modus, Maßstab wie bisher);
// linke Maustaste = Angriff (halten = weiter), auch auf einem Touch-Laptop; rechte Maustaste = Rolle (Laufrichtung, im Stand zum Zeiger);
// 1 2 3 Fähigkeiten, 4 Ultimative, 5 Trank; WASD laufen; Angriffe und Fähigkeiten zielen auf den Mauszeiger; Finger ↔ Maus wechselt
// die Oberfläche; Einstellung „Grafik: HD/Pixel“ bleibt gespeichert; Vollbild-Knopf; kein Browser-Menü; keine Fehler.
// Mit Bildordner: Fotos (Titel, Versteck, Kampf mit Schadenszahlen, Endlose Lande, Menü) bei 1920×1080 mit dpr 1 und 1,5 und
// Zeiten je Bild (HD und Pixel, 1080p und 1440p).
const { chromium } = require('playwright');
const fs = require('fs');
const OUT = process.argv[2] || '';
const BASE = (process.env.BASE || 'http://localhost:8777/').replace(/\/?$/, '/');
const fails = [], ok = (c, msg) => { if (!c) fails.push(msg); console.log((c ? '  ok   ' : '  FAIL ') + msg); };
const HERO = () => {
  localStorage.clear(); loadAll();
  const c = newChar('knight', 'Brunhild', 'normal', false, { body: 'knight_f', hair: 2, skin: -1, accent: 4, cape: 0 }); c.lv = 24; c.act = 3; c.maxAct = 4; c.story = { a1: 1, a2: 1, a3: 1 };
  SAVE.chars.push(c); activateChar(0);
  P.gear.weapon = makeItem({ slot: 'weapon', base: 'sword', tier: 3, rar: 4 }); P.gear.weapon.up = 7; P.gear.armor = makeItem({ slot: 'armor', base: 'armor', tier: 3, rar: 3 });
  for (let i = 0; i < 14; i++) P.bag.push(randomItem(12, ri(0, 4)));
  P.gold = 12345; P.fate = 7; SAVE.meta.hide.intro = true; SAVE.meta.hide.b = { schmiede: 2, alchemie: 3, juwelier: 1, lager: 2, training: 2, tempel: 3, bibliothek: 2, mine: 1, garten: 1 }; SAVE.meta.hide.rooms = 9;
  if (SAVE.meta.lande) SAVE.meta.lande.tips = 0xffff; for (const a of ACH) SAVE.meta.ach[a.id] = 1;
  SAVE.meta.settings.gfx = 'hd';   // HD fest gewählt: die automatische Probe (eigener Test unten) stellt hier nichts um
  computeStats(); P.hp = P.st.hp; saveChar(); persist();
};
// ruhiger Kampfraum: keine Wellen, der Held kann nicht sterben
const ROOM = () => { hideOverlay(); startRoom('kampf', 0); G.phase = 'gap'; G.t = 1e9; enemies = []; P.inv = 1e9; P.res = P.st.resMax; };
// Bildschirm-Punkt (CSS-Pixel) einer Welt-Stelle – Umkehrung von mouseWorld()
const SCR = ([x, y]) => ({ x: VIEW.ox + ((x - CX) * PXS - VIEW.sx) / DPR, y: ((y - CY) * PXS - VIEW.sy) / DPR });

(async () => {
  if (OUT) { fs.rmSync(OUT, { recursive: true, force: true }); fs.mkdirSync(OUT, { recursive: true }); }
  const b = await chromium.launch();
  const errs = [];
  const open = async (opt) => {
    const c = await b.newContext(Object.assign({ locale: 'de-DE' }, opt)); const p = await c.newPage();
    p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error' && !/favicon|net::ERR/.test(m.text())) errs.push('console: ' + m.text()); });
    await p.goto(BASE + 'index.html'); await p.evaluate(() => localStorage.clear()); await p.reload(); await p.waitForTimeout(1300);
    return { c, p };
  };

  console.log('PC: Bildschirm-Erkennung und Maßstab');
  for (const [PW, PH] of [[1920, 1080], [2560, 1440]]) {
    const vhs = [];
    for (const d of [1, 1.25, 1.5, 2]) {
      const { c, p } = await open({ viewport: { width: Math.round(PW / d), height: Math.round(PH / d) }, deviceScaleFactor: d });
      const s = await p.evaluate(() => ({ PXS, DPR, SCALE, VW, VH, HD, UI, cw: cv.width, ch: cv.height, css: parseFloat(cv.style.width), cssH: parseFloat(cv.style.height), iw: innerWidth, ih: innerHeight, touch: document.body.classList.contains('touch') }));
      const tag = `${PW}×${PH} bei ${d * 100} %`;
      ok(Number.isInteger(s.PXS) && s.PXS >= 2 && s.DPR === d, `${tag}: ganzzahlig ${s.PXS} Gerätepixel je Spielpixel`);
      ok(Math.abs(s.css * d - s.VW * s.PXS) < .01 && Math.abs(s.cssH * d - s.VH * s.PXS) < .01 && s.VW * s.SCALE >= s.iw && s.VH * s.SCALE >= s.ih, `${tag}: Leinwand deckt den Bildschirm in ganzen Gerätepixeln (${s.VW}×${s.VH} Spielpixel)`);
      ok(s.HD && s.cw === s.VW * s.PXS && s.ch === s.VH * s.PXS, `${tag}: HD von selbst an, Leinwand ${s.cw}×${s.ch} Gerätepixel`);
      ok(s.VH >= 160 && s.VH <= 240 && !s.touch, `${tag}: Held so groß wie auf dem Handy (${s.VH} Spielpixel hoch), PC-Oberfläche`);
      const ui = Math.min(3, Math.max(1, Math.floor(Math.min(s.ih / 720, s.iw / 1100) * 8) / 8));
      ok(s.UI === ui && (s.UI > 1 || s.ih <= 760) && (d > 1 || s.UI >= (PW > 2000 ? 2 : 1.5)), `${tag}: Oberfläche wächst mit (--ui ${s.UI})`);
      vhs.push(s.VH); await c.close();
    }
    ok(Math.max(...vhs) - Math.min(...vhs) <= 2, `${PW}×${PH}: gleiches Bild bei jeder Windows-Skalierung (${vhs.join(', ')} Spielpixel hoch)`);
  }
  {
    const { c, p } = await open({ viewport: { width: 5120, height: 1440 } });
    const s = await p.evaluate(() => ({ VW, VH, w: VIEW.w, ox: VIEW.ox, iw: innerWidth, left: parseFloat($('view').style.left) }));
    ok(s.w < s.iw && s.ox > 0 && s.left === s.ox && (s.VW - 1) / (s.VH - 1) <= 2.45, `Super-Ultrabreit 5120×1440: Spielfeld höchstens 2,4 : 1 mit Rändern (${s.VW}×${s.VH})`);
    await c.close();
    const u = await open({ viewport: { width: 3440, height: 1440 } });
    const s2 = await u.p.evaluate(() => ({ w: VIEW.w, iw: innerWidth, VW, VH }));
    ok(s2.w === s2.iw, `Ultrabreit 3440×1440 (21:9): ganzer Bildschirm (${s2.VW}×${s2.VH})`);
    await u.c.close();
  }
  {
    // Fenster auf einen anderen Bildschirm (nur devicePixelRatio ändert sich, die CSS-Größe bleibt): neu vermessen
    const { c, p } = await open({ viewport: { width: 1920, height: 1080 } });
    const cdp = await c.newCDPSession(p);
    await cdp.send('Emulation.setDeviceMetricsOverride', { width: 1920, height: 1080, deviceScaleFactor: 1.5, mobile: false }); await p.waitForTimeout(500);
    const s = await p.evaluate(() => ({ DPR, PXS, VW, VH, cw: cv.width, css: parseFloat(cv.style.width), mn: Math.min(innerWidth, innerHeight) }));
    ok(s.DPR === 1.5 && s.PXS === Math.round(s.mn * 1.5 / 190) && s.cw === s.VW * s.PXS && Math.abs(s.css * 1.5 - s.VW * s.PXS) < .01, `devicePixelRatio 1 → 1,5 (anderer Bildschirm, Zoom): neu vermessen, ${s.PXS} Gerätepixel je Spielpixel`);
    await c.close();
  }
  for (const [w, h] of [[390, 844], [844, 390]]) {
    const { c, p } = await open({ viewport: { width: w, height: h }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
    const s = await p.evaluate(() => ({ PXS, SCALE, HD, touch: isTouch && document.body.classList.contains('touch'), UI, cw: cv.width, VW }));
    ok(s.PXS === 6 && s.SCALE === 2 && !s.HD && s.cw === s.VW && s.touch && s.UI === 1, `Handy ${w}×${h}: wie bisher (Maßstab 2, Pixel-Modus, Touch-Knöpfe, Oberfläche 1×)`);
    await c.close();
  }

  console.log('PC: Steuerung mit Maus und Tastatur (1920×1080)');
  {
    const { c, p } = await open({ viewport: { width: 1920, height: 1080 } });
    await p.evaluate(HERO); await p.evaluate(() => { titleScene(); showTitle(); }); await p.waitForTimeout(300);
    ok(await p.locator('[data-act="fullscreen"]').count() === 1, 'Titel: Vollbild-Knopf');
    ok(/Linke Maustaste/.test(await p.evaluate(() => panel.querySelector('[data-help]').textContent)), 'Titel: Steuerungs-Hilfe für Maus und Tastatur');
    // Vollbild an und aus: danach stimmt der Maßstab
    await p.locator('[data-act="fullscreen"]').click(); await p.waitForTimeout(600);
    const fs1 = await p.evaluate(() => ({ on: !!document.fullscreenElement, lbl: panel.querySelector('[data-act="fullscreen"]').textContent, cover: VW * SCALE >= innerWidth && VH * SCALE >= innerHeight }));
    if (fs1.on) { ok(fs1.lbl === 'Vollbild beenden' && fs1.cover, 'Vollbild an: Knopf heißt „Vollbild beenden“, Spielfeld neu vermessen'); await p.locator('[data-act="fullscreen"]').click(); await p.waitForTimeout(600); ok(await p.evaluate(() => !document.fullscreenElement && panel.querySelector('[data-act="fullscreen"]').textContent === 'Vollbild' && VW * SCALE >= innerWidth), 'Vollbild aus: Knopf wieder „Vollbild“'); }
    else console.log('  (Vollbild im kopflosen Browser nicht erlaubt – nur der Knopf geprüft)');

    await p.evaluate(ROOM); await p.waitForTimeout(400);
    await p.evaluate(() => { window.__n = { atk: 0 }; const sa = startAttack; window.startAttack = inp => { __n.atk++; return sa(inp); }; });
    const hero = await p.evaluate(() => [P.x, P.y]);
    let pt = await p.evaluate(SCR, [hero[0] + 50, hero[1] - 6]);
    await p.mouse.move(pt.x - 30, pt.y); await p.mouse.move(pt.x, pt.y, { steps: 4 }); await p.waitForTimeout(100);
    const mw = await p.evaluate(([x, y]) => { const m = mouseWorld(); return Math.hypot(m.x - x, m.y - y); }, [hero[0] + 50, hero[1] - 6]);
    ok(mw < 1, `Mauszeiger → Welt stimmt (Abweichung ${mw.toFixed(2)} Spielpixel)`);
    ok(await p.evaluate(() => document.body.classList.contains('aimcur') && getComputedStyle(document.body).cursor.includes('url(')), 'Fadenkreuz über dem Spielfeld');
    await p.mouse.down(); await p.waitForTimeout(1300);
    const held = await p.evaluate(() => ({ n: __n.atk, aim: P.aim }));
    await p.mouse.up(); await p.waitForTimeout(500);
    const after = await p.evaluate(() => __n.atk);
    ok(held.n >= 3 && Math.cos(held.aim) > .9, `linke Maustaste halten: ${held.n} Angriffe zum Mauszeiger`);
    ok(after - held.n <= 1, 'Maustaste los: kein weiterer Angriff');
    // rechte Maustaste: im Stand zum Zeiger, beim Laufen in Laufrichtung
    pt = await p.evaluate(SCR, await p.evaluate(() => [P.x - 60, P.y]));
    await p.evaluate(() => { P.rollCd = 0; P.roll = 0; P.atkT = 0; });
    await p.mouse.click(pt.x, pt.y, { button: 'right' }); await p.waitForTimeout(50);
    const r1 = await p.evaluate(() => ({ roll: P.roll > 0, dx: P.rdx }));
    ok(r1.roll && r1.dx < -.9, 'rechte Maustaste im Stand: Rolle zum Mauszeiger');
    await p.waitForTimeout(900); await p.keyboard.down('KeyD'); await p.waitForTimeout(200);
    pt = await p.evaluate(SCR, await p.evaluate(() => [P.x - 60, P.y]));
    await p.mouse.click(pt.x, pt.y, { button: 'right' }); await p.waitForTimeout(50);
    const r2 = await p.evaluate(() => ({ roll: P.roll > 0, dx: P.rdx }));
    await p.keyboard.up('KeyD');
    ok(r2.roll && r2.dx > .9, 'rechte Maustaste beim Laufen: Rolle in Laufrichtung');
    // linke Taste halten, rechte dazu drücken (Pointer-Events melden das nur über e.buttons)
    await p.waitForTimeout(900); await p.evaluate(() => { P.rollCd = 0; P.roll = 0; });
    await p.mouse.down(); await p.waitForTimeout(150); await p.mouse.down({ button: 'right' }); await p.waitForTimeout(50);
    const r3 = await p.evaluate(() => P.roll > 0);
    await p.mouse.up({ button: 'right' }); await p.mouse.up(); await p.waitForTimeout(100);
    ok(r3, 'Angriff halten und rechts dazu: Rolle');
    ok(await p.evaluate(() => { const e = new MouseEvent('contextmenu', { bubbles: true, cancelable: true }); cv.dispatchEvent(e); return e.defaultPrevented; }), 'kein Browser-Menü auf dem Spielfeld');
    // WASD
    for (const [k, ax, sg] of [['KeyD', 0, 1], ['KeyA', 0, -1], ['KeyS', 1, 1], ['KeyW', 1, -1]]) {
      await p.waitForTimeout(450); const a = await p.evaluate(() => [P.x, P.y]);
      await p.keyboard.down(k); await p.waitForTimeout(350); await p.keyboard.up(k);
      const z = await p.evaluate(() => [P.x, P.y]);
      ok((z[ax] - a[ax]) * sg > 8, `${k.slice(3)} läuft (${(z[ax] - a[ax]).toFixed(0)} Spielpixel)`);
    }
    // 1–5: Fähigkeiten, Ultimative, Trank
    await p.evaluate(() => { window.__c = []; const us = useSkill, du = doUlt, dp = drinkPotion; window.useSkill = i => { __c.push('s' + (i + 1)); return us(i); }; window.doUlt = () => { __c.push('ult'); return du(); }; window.drinkPotion = a => { __c.push('pot'); return dp(a); }; });
    const cast = [];
    for (const [i, k] of ['Digit1', 'Digit2', 'Digit3'].entries()) { await p.waitForTimeout(1300); await p.evaluate(() => { P.res = P.st.resMax; P.dash = null; P.spin = 0; P.roll = 0; P.cds = [0, 0, 0]; }); await p.keyboard.press(k); cast.push(await p.evaluate(i => P.cds[i] > 0, i)); }
    await p.waitForTimeout(1300); await p.evaluate(() => { P.rage = 100; P.spin = 0; P.dash = null; P.leap = null; }); await p.keyboard.press('Digit4');
    const rage = await p.evaluate(() => P.rage);
    await p.waitForTimeout(1300); const pot0 = await p.evaluate(() => { P.leap = null; P.hp = P.st.hp * .4; P.potCd = 0; P.potions = 3; P.rollT = 0; return P.potions; }); await p.keyboard.press('Digit5');
    const keys = await p.evaluate(() => ({ c: __c.join(','), pot: P.potions }));
    ok(keys.c === 's1,s2,s3,ult,pot', `Tasten 1 2 3 4 5 → Fähigkeit 1/2/3, Ultimative, Trank (${keys.c})`);
    ok(cast.every(Boolean) && rage < 100 && keys.pot === pot0 - 1, `Fähigkeiten gewirkt (${cast.join('/')}), Wut verbraucht, Trank getrunken`);
    // Zielen: Gegner rechts, Mauszeiger links → Sturmangriff (1) nach links; Angriff mit J zielt wieder automatisch auf den Gegner
    await p.waitForTimeout(1500);
    await p.evaluate(() => { P.cds = [0, 0, 0]; P.res = P.st.resMax; P.dash = null; P.spin = 0; P.leap = null; P.roll = 0; P.atkT = 0; const e = spawnEnemy('goblin', { x: P.x + 40, y: P.y, instant: true }); e.spd = 0; e.stun = 99; e.hp = e.maxHp = 1e9; });
    pt = await p.evaluate(SCR, await p.evaluate(() => [P.x - 70, P.y + 20]));
    await p.mouse.move(pt.x + 20, pt.y); await p.mouse.move(pt.x, pt.y, { steps: 3 }); await p.waitForTimeout(100);
    ok(await p.evaluate(() => P.face < 0), 'im Stand schaut der Held zum Mauszeiger');
    await p.keyboard.press('Digit1'); await p.waitForTimeout(30);
    const sk = await p.evaluate(() => P.dash ? P.dash.dx : null);
    ok(sk != null && sk < -.8, `Fähigkeit 1 zielt auf den Mauszeiger, nicht auf den nächsten Gegner (dx ${sk == null ? '–' : sk.toFixed(2)})`);
    await p.waitForTimeout(800); await p.evaluate(() => { P.dash = null; P.atkCd = 0; P.atkT = 0; P.comboT = 0; });
    await p.keyboard.down('KeyJ'); await p.waitForTimeout(120); await p.keyboard.up('KeyJ');
    ok(await p.evaluate(() => !mouse.aim && Math.cos(P.aim) > .8), 'Angriff mit J: zielt wieder automatisch auf den Gegner');
    ok(await p.evaluate(() => SAVE.meta.settings.pcTip === 1), 'Hinweis „Maus & Tastatur“ beim ersten Kampf gezeigt');
    // Pause und Steuerung zeigen die PC-Knöpfe
    await p.keyboard.press('Escape'); await p.waitForTimeout(200);
    ok(await p.evaluate(() => state === 'pause' && !!panel.querySelector('[data-act="gfx"]') && !!panel.querySelector('[data-act="fullscreen"]') && !panel.querySelector('[data-act="ctledit"]')), 'Pause: Grafik und Vollbild, keine Touch-Knöpfe');
    await p.evaluate(() => showControls()); await p.waitForTimeout(100);
    ok(await p.evaluate(() => /MAUS & TASTATUR/.test(panel.textContent) && /Rechte Maustaste/.test(panel.textContent)), 'Steuerung: Tastenbelegung für Maus & Tastatur');
    // Einstellung Grafik HD ↔ Pixel, gespeichert
    await p.evaluate(() => showSettings()); await p.waitForTimeout(100);
    ok(/HD \(scharf\)/.test(await p.locator('[data-act="gfx"]').textContent()), 'Einstellungen: „Grafik: HD (scharf)“');
    await p.locator('[data-act="gfx"]').click(); await p.waitForTimeout(200);
    const px = await p.evaluate(() => ({ HD, g: SAVE.meta.settings.gfx, cw: cv.width, VW, lbl: panel.querySelector('[data-act="gfx"]').textContent }));
    ok(!px.HD && px.g === 'px' && px.cw === px.VW && /Pixel \(schnell\)/.test(px.lbl), 'Grafik auf Pixel (schnell): Leinwand in Spielpixeln');
    await p.reload(); await p.waitForTimeout(1300);
    ok(await p.evaluate(() => !HD && SAVE.meta.settings.gfx === 'px' && cv.width === VW), 'Pixel-Modus bleibt nach Neuladen');
    await p.evaluate(ROOM); await p.evaluate(() => { cam.x += .37; cam.y += .61; }); await p.waitForTimeout(100);
    ok(await p.evaluate(() => { const m = /translate3d\((-?[\d.]+)px, ?(-?[\d.]+)px/.exec(cv.style.transform); return !!m && Number.isInteger(Math.round(-m[1] * DPR * 1000) / 1000) && Number.isInteger(Math.round(-m[2] * DPR * 1000) / 1000); }), 'Pixel-Modus: weiche Kamera in ganzen Gerätepixeln (scharf)');
    await p.evaluate(() => { hideOverlay(); showSettings(); }); await p.locator('[data-act="gfx"]').click(); await p.waitForTimeout(200);
    ok(await p.evaluate(() => HD && SAVE.meta.settings.gfx === 'hd' && cv.width === VW * PXS), 'zurück auf HD');
    await c.close();
  }

  console.log('PC: Touch-Laptop (Maus und Finger)');
  {
    const { c, p } = await open({ viewport: { width: 1920, height: 1080 }, hasTouch: true });
    await p.evaluate(HERO); await p.evaluate(ROOM); await p.waitForTimeout(400);
    await p.evaluate(() => { window.__n = 0; const sa = startAttack; window.startAttack = inp => { __n++; return sa(inp); }; });
    const t0 = await p.evaluate(() => ({ touch: isTouch }));
    // Klick links ins Bild – dort liegt noch das Joystick-Feld der Touch-Knöpfe
    await p.mouse.move(300, 600); await p.mouse.down(); await p.waitForTimeout(400); await p.mouse.up();
    const m = await p.evaluate(() => ({ touch: isTouch, cls: document.body.classList.contains('touch'), n: __n, stick: stick.id, bar: getComputedStyle($('skillbar')).display, tb: getComputedStyle($('touch')).display }));
    ok(!m.touch && !m.cls && m.n >= 1 && m.stick === null, `Mausklick auf dem Touch-Laptop greift an (${m.n}×), kein Joystick${t0.touch ? ' – vorher Touch-Oberfläche' : ''}`);
    ok(m.bar !== 'none' && m.tb === 'none', 'danach PC-Leiste statt Touch-Knöpfen');
    const cdp = await c.newCDPSession(p);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: 1500, y: 300, id: 1 }] }); await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await p.waitForTimeout(200);
    const t = await p.evaluate(() => ({ touch: isTouch && document.body.classList.contains('touch'), atk: getComputedStyle($('bAtk')).display, bar: getComputedStyle($('skillbar')).display, help: true }));
    ok(t.touch && t.atk !== 'none' && t.bar === 'none', 'Fingertipp: Touch-Knöpfe erscheinen, PC-Leiste verschwindet');
    await p.mouse.move(900, 500); await p.mouse.move(980, 540, { steps: 4 }); await p.waitForTimeout(100);
    ok(await p.evaluate(() => !isTouch && !document.body.classList.contains('touch') && getComputedStyle($('skillbar')).display !== 'none'), 'Maus bewegt: zurück zur PC-Oberfläche');
    await c.close();
  }

  console.log('PC: Zeit je Bild (Kampf, kopfloser Browser ohne Grafikkarte)');
  const perf = {};
  for (const [W, H] of [[1920, 1080], [2560, 1440]]) {
    const { c, p } = await open({ viewport: { width: W, height: H } });
    await p.evaluate(HERO); await p.evaluate(ROOM);
    await p.evaluate(() => { for (let i = 0; i < 12; i++) { const e = spawnEnemy(pick(['goblin', 'skeleton', 'orc', 'imp']), { x: P.x + rnd(-120, 120), y: P.y + rnd(-60, 60), instant: true }); e.hp = e.maxHp = 1e9; } G.dark = .5; });
    await p.waitForTimeout(500);
    for (const g of ['hd', 'px']) {
      perf[W + g] = await p.evaluate(g => {
        SAVE.meta.settings.gfx = g; resize();
        const step = () => { update(1 / 60); camera(1 / 60); if (Math.random() < .3) for (const e of enemies.slice(0, 3)) hurtEnemy(e, 37, 1, 0, 0, Math.random() < .3, true); if (Math.random() < .1) useSkill(1); P.res = P.st.resMax; P.cds = [0, 0, 0]; };
        for (let i = 0; i < 30; i++) { step(); render(); }
        let t = 0; for (let i = 0; i < 90; i++) { step(); const t0 = performance.now(); render(); ctx.getImageData(0, 0, 1, 1); t += performance.now() - t0; }
        return +(t / 90).toFixed(2);
      }, g);
    }
    console.log(`  ${W}×${H}: HD ${perf[W + 'hd']} ms, Pixel ${perf[W + 'px']} ms je Bild (render + Abgleich, Software-Zeichnen)`);
    await c.close();
  }
  // Grobe Schranke gegen Rückschritte: selbst ohne Grafikkarte bleibt 1080p HD spielbar (mit Grafikkarte: wenige ms)
  ok(perf['1920hd'] < 40 && perf['1920px'] < 8, `Zeit je Bild ohne Grafikkarte: 1080p HD ${perf['1920hd']} ms, Pixel ${perf['1920px']} ms`);

  console.log('PC: zu langsam für HD → einmal auf Pixel (schnell)');
  {
    const { c, p } = await open({ viewport: { width: 1920, height: 1080 } });
    await p.evaluate(HERO); await p.evaluate(() => { delete SAVE.meta.settings.gfx; SAVE.meta.settings.pcTip = 1; resize(); });
    await p.evaluate(ROOM);
    // HD künstlich langsam (35 ms je Bild), Pixel schnell
    await p.evaluate(() => { const r = window.__r0 = render; window.render = () => { r(); if (HD) { const t = performance.now(); while (performance.now() - t < 35); } }; });
    let s = null; for (let i = 0; i < 30 && !(s && s.g); i++) { await p.waitForTimeout(500); s = await p.evaluate(() => ({ g: SAVE.meta.settings.gfx, HD, t: $('toast').textContent })); }
    ok(s.g === 'px' && !s.HD && /Pixel/.test(s.t), 'HD zu langsam: Probe mit Pixel, umgestellt, gespeichert und gemeldet');
    // Gebremst von außen, gleich langsam in beiden Modi (z. B. Energiesparen): zurück zu HD, keine weitere Probe
    await p.evaluate(() => { delete SAVE.meta.settings.gfx; GFXW.done = false; GFXW.try = false; GFXW.a.length = 0; resize(); window.render = () => { const t = performance.now(); __r0(); while (performance.now() - t < 60); }; });   // feste 60 ms je Bild, egal welcher Modus
    for (let i = 0; i < 30 && !(s && s.done); i++) { await p.waitForTimeout(500); s = await p.evaluate(() => ({ done: GFXW.done, HD, g: SAVE.meta.settings.gfx })); }
    ok(s.done && s.HD && !s.g, 'langsam auch mit Pixel: bleibt HD, nichts gespeichert');
    await c.close();
  }

  if (OUT) {
    console.log('PC: Fotos → ' + OUT);
    for (const d of [1, 1.5]) {
      const { c, p } = await open({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: d });
      await p.evaluate(HERO); await p.evaluate(() => { SAVE.meta.settings.pcTip = 1; });
      const tag = 'dpr' + String(d).replace('.', '');
      const shot = async (name, fn, wait) => { if (fn) await p.evaluate(fn); await p.waitForTimeout(wait || 400); await p.screenshot({ path: `${OUT}/${tag}_${name}.png` }); };
      await p.mouse.move(1300, 500);
      await shot('1_title', () => { titleScene(); showTitle(); }, 600);
      await shot('2_hideout', () => { enterHideout(); }, 1500);
      await p.evaluate(() => { backToHide(); P.map = genMap(3); P.map.pos = { r: 0, i: 0 }; startRoom('kampf', 1); P.inv = 999; });
      await p.waitForTimeout(2500);
      await p.evaluate(() => { const e = enemies.filter(e => e.st !== 'spawn'); for (const x of e.slice(0, 4)) { x.x = P.x + 26 + Math.random() * 20; x.y = P.y + Math.random() * 16 - 8; } });
      await p.mouse.move(1250, 560); await p.mouse.down(); await p.waitForTimeout(700);
      await shot('3_fight', () => { for (const e of enemies.slice(0, 3)) { hurtEnemy(e, 23, 1, 0, 0, false, true); hurtEnemy(e, 57, 1, 0, 0, true, true); } useSkill(0); }, 120);
      await p.mouse.up(); await p.evaluate(() => { for (const e of enemies) e.dead = true; P.inv = 0; });
      await shot('4_lande', () => { landeStart('tor'); }, 1800);
      await p.evaluate(() => { LW.huntT = 1e9; LW.rivT = 1e9; });
      await shot('5_menu', () => { showPause(); returnTo = 'pause'; selItem = P.bag[1].uid; openChar('gear', 'pause'); }, 500);
      await c.close();
    }
  }
  ok(!errs.length, 'keine Fehler im Spiel' + (errs.length ? ': ' + [...new Set(errs)].slice(0, 3).join(' | ') : ''));
  await b.close();
  if (fails.length) { console.log(`\n${fails.length} FEHLER`); process.exit(1); }
})().catch(e => { console.log('  FAIL Abbruch: ' + e.message.split('\n')[0]); process.exit(1); });
