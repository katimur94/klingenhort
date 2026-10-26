// Tausend Bosse (js/bosses.js). Aufruf: node bosses.js [bildordner]
// Prüft: Generator (fest für alle, auch in anderer Sprache), 1200 eindeutige Namen, Texte ohne Platzhalter, Bibliothek der Mechaniken,
// jede Mechanik feuert ohne Fehler und warnt vor dem Schaden, Höhlen (bossForLair), Sieg → Trophäe, Beute, Rückkehr nach 3 Tagen (Uhr vorgestellt),
// Übungskampf ohne Beute, Kontobonus mit Deckel, Spielstand (Größe, alte und kaputte Daten), Kämpfe Rang 1/301/601/901/1200 mit einem einfachen Spieler-Bot
// (Rang 1 schafft ein frischer Held auf Level 5, Rang 1200 ist für einen maximalen Helden fast unmöglich), Boss-Kodex auf dem Handy hoch und quer.
const { chromium } = require('playwright');
const fs = require('fs');
const OUT = process.argv[2] || '';
const BASE = (process.env.BASE || 'http://localhost:8777/').replace(/\/?$/, '/');
const fails = [], ok = (c, msg) => { if (!c) fails.push(msg); console.log((c ? '  ok   ' : '  FAIL ') + msg); };

// Im Spiel: Schrittweise rechnen (wie die Hauptschleife, ohne Zeichnen) und ein einfacher Bot, der Warnflächen ausweicht
const SIM = () => {
  window.__step = (n, dt) => { dt = dt || 1 / 60; for (let i = 0; i < n; i++) { let d = dt; T += d; if (slowmo > 0) { slowmo -= d; d *= .35; } flash.a = Math.max(0, flash.a - d * 1.6); if (window.__bot) window.__bot(d); if (state === 'play' || state === 'dead') { if (hitStop > 0) hitStop -= d; else update(d); } camera(d); } };
  window.__hero = (cls, lv, max) => {
    SAVE.meta.hide.b = {}; SAVE.meta.bosses.b = {}; BTROPH = -1;   // nichts vom Konto vorheriger Tests
    const c = newChar(cls, 'Testheld', 'normal', false); SAVE.chars.push(c); activateChar(SAVE.chars.length - 1); P.lv = lv; P.sp = 0;
    if (max) {
      const C = CLASSES[cls], gem = g => [g + ':4', g + ':4', g + ':4'];
      P.gear.weapon = Object.assign(makeMythic('weapon'), { tier: 7, up: 10, fz: 5, sockets: 3 }); P.gear.weapon.gems = gem('rubin');
      for (const s of ['armor', 'helm']) P.gear[s] = Object.assign(makeItem({ slot: s, base: s, tier: 7, rar: 4 }), { up: 10, fz: 5, sockets: 3, gems: gem('amethyst') });
      P.paragon = 300; P.pp = { dmg: 120, hp: 100, def: 60, crit: 20 }; P.rebirths = 3; P.potions = 14;
      for (const k of ['training', 'alchemie', 'schmiede']) SAVE.meta.hide.b[k] = k === 'training' ? 10 : 4;
      for (const [bi, nodes] of TALENTS[cls].entries()) for (const n of nodes[1]) P.talents[n.id] = n.max;
    }
    computeStats(); P.hp = P.st.hp; P.res = P.st.resMax; saveChar();
  };
  // Gefahr am Punkt x, y innerhalb der nächsten H Sekunden (gleiche Regeln wie im Spiel)
  window.__danger = (x, y, H) => {
    const inC = (cx, cy, r) => { const dx = x - cx, dy = (y - cy) * 2; return dx * dx + dy * dy < (r + 9) * (r + 9); };
    const onL = z => { const [d, u] = bSegD(x, y, z.x, z.y, z.a, z.l0, z.len); return d < z.w / 2 + 9 && u >= z.l0 - 9 && u <= z.len + 9; };
    for (const z of BZ.fx) {
      const o = z.o;
      switch (z.k) {
        case 'c': if (z.dmg > 0 && (z.fol > 0 ? z.fol < .3 : z.t < H) && inC(z.x, z.y, z.r)) return true; break;
        case 'l': if (z.dmg > 0 && z.t < H + (z.travel ? 1 : 0) && onL(z)) return true; break;
        case 'v': if (z.t < H) { const dx = x - z.x, dy = y - z.y; if (Math.hypot(dx, dy) < z.r + 12 && Math.abs(angDiff(Math.atan2(dy, dx), z.a)) < z.arc / 2 + .2) return true; } break;
        case 'q': if ((z.t < H || z.burn > 0) && x > z.x0 - 10 && x < z.x1 + 10 && y > z.y0 - 10 && y < z.y1 + 10) return true; break;
        case 'w': { const de = Math.hypot(x - z.x, (y - z.y) * 2); if (de > z.r - 6 && de - z.r < z.sp * H + 14) return true; break; }
        case 'b': if (z.warm < H) for (const a of [z.a, z.a + z.va * .5, z.a + z.va * 1]) { const [d, u] = bSegD(x, y, o.x, o.y, a, 0, z.len); if (d < z.w / 2 + 12 && u > 0) return true; } break;
        case 's': if (z.warm < H) { const d = Math.hypot(x - o.x, (y - o.y) * 1.8); if (Math.abs(d - z.rad) < 16) return true; } break;
        case 'd': if (z.warm < H && inC(o.x, o.y, z.R + 6)) return true; break;
        case 'p': if (inC(o.x, o.y, z.R + 20)) return true; break;
        case 'm': if (z.fly <= 0 && (z.fuse >= 0 || z.arm < H) && inC(z.x, z.y, z.fuse >= 0 ? z.r + 4 : 28)) return true; break;
      }
    }
    for (const h of hazards) if (Math.hypot(x - h.x, (y - h.y) * 1.6) < h.r + 12) return true;
    return false;
  };
  window.__botOn = show => {
    stick.id = 77; let skT = 0;
    window.__bot = dt => {
      if (state !== 'play') { stick.x = stick.y = 0; touchAtk = false; return; }
      const b = enemies.find(e => e.bz && !e.dead), ranged = WT[P.gear.weapon.base].ranged;
      const tgt = b || nearestEnemy(999); touchAtk = !!tgt && !show;
      if (show) { P.hp = P.st.hp; P.potCd = 9; }
      let gx = P.x, gy = P.y;
      if (tgt) { const want = ranged ? 95 : tgt.r * tgt.sc + 14, d = Math.hypot(tgt.x - P.x, tgt.y - P.y) || 1; gx = tgt.x - (tgt.x - P.x) / d * want; gy = tgt.y - (tgt.y - P.y) / d * want; }
      let mx = gx - P.x, my = gy - P.y;
      if (__danger(P.x, P.y, 1.1)) {
        let best = null, bs = 1e9;
        for (let i = 0; i < 24; i++) for (const r of [28, 55, 90]) { const a = i / 24 * 6.283, x = clamp(P.x + Math.cos(a) * r, BD.x0 + 12, BD.x1 - 12), y = clamp(P.y + Math.sin(a) * r, BD.y0 + 6, BD.y1 - 6); if (__danger(x, y, 1.4)) continue; const s = r * 2 + Math.hypot(x - gx, y - gy) * .5; if (s < bs) { bs = s; best = [x, y]; } }
        if (best) { mx = best[0] - P.x; my = best[1] - P.y; }
        for (const z of BZ.fx) if (z.k === 'w') { const de = Math.hypot(P.x - z.x, (P.y - z.y) * 2); if (de > z.r && de - z.r < 22 && P.rollCd <= 0) doRoll(); }
      } else if (__danger(P.x + mx * .3, P.y + my * .3, 1.1)) { mx = 0; my = 0; }
      const l = Math.hypot(mx, my); stick.x = l > 3 ? mx / l : 0; stick.y = l > 3 ? my / l : 0;
      if (P.hp < P.st.hp * .45) drinkPotion();
      skT -= dt; if (!show && skT <= 0 && tgt && Math.hypot(tgt.x - P.x, tgt.y - P.y) < 70) { skT = 1; const C = CLASSES[P.cls]; for (let i = 1; i < 3; i++) if (P.cds[i] <= 0 && P.res >= skillCost(i) && !__danger(P.x, P.y, 1)) { useSkill(i); break; } if (P.rage >= 100) doUlt(); }
    };
  };
  window.__botOff = () => { window.__bot = null; stick.id = null; stick.x = stick.y = 0; touchAtk = false; };
};

(async () => {
  if (OUT) fs.mkdirSync(OUT, { recursive: true });
  const b = await chromium.launch();
  const errs = []; const watch = page => { page.on('pageerror', e => errs.push(e.message)); page.on('console', m => { if (m.type() === 'error' && !/favicon|net::ERR/.test(m.text())) errs.push('console: ' + m.text()); }); };
  const page = await b.newPage({ viewport: { width: 844, height: 390 }, locale: 'de-DE' }); watch(page);
  await page.goto(BASE + 'index.html'); await page.evaluate(() => localStorage.clear()); await page.reload(); await page.waitForTimeout(1500);
  await page.evaluate(SIM);
  console.log('Tausend Bosse');

  /* ---------- Generator ---------- */
  const g = await page.evaluate(() => {
    const o = {}, t0 = performance.now(); for (let i = 0; i < BOSS_N; i++) bossDef(i); o.ms = performance.now() - t0;
    const D = Array.from({ length: BOSS_N }, (_, i) => bossDef(i)), key = B => JSON.stringify([B.t, B.el, B.tint, B.sc, B.name, B.mech, B.res, B.aff, B.sig, B.hpK, B.atkK, B.spdK]);
    o.n = BOSS_N; o.hash = D.map(key).join('|').length + ':' + D.map(key).reduce((h, s) => (h * 31 + s.length) % 1e9, 7);
    o.names = new Set(D.map(B => B.name.toLowerCase())).size; o.full = new Set(D.map(B => B.full)).size;
    o.place = D.filter(B => /\{\w+\}/.test(B.full + B.title + B.lore)).length;
    o.mechN = BM_KEYS.length; o.unused = BM_KEYS.filter(k => !D.some(B => B.mech.includes(k) || B.res.includes(k)));
    o.r0 = D[0].mech.length; o.rMax = D[BOSS_N - 1].mech.length;
    o.avg = [0, 3, 6, 9, 11].map(bd => { const L = D.filter(B => B.band === bd); return +(L.reduce((s, B) => s + B.mech.length, 0) / L.length).toFixed(2); });
    o.affLow = D.slice(0, 30).filter(B => B.aff.some(a => BAFF.includes(a) && !(EN[B.t].aff || []).includes(a))).length;
    o.sig = D.filter(B => B.sig).length; o.bodies = new Set(D.map(B => B.t)).size; o.els = new Set(D.map(B => B.el)).size;
    o.camp = ['ogre', 'shaman', 'zombie', 'demon', 'frostra', 'morbus', 'varkas', 'pyraxis'].every(t => D.some(B => B.t === t));
    o.tw = [bTw(D[0]), bTw(D[BOSS_N - 1])];
    o.lair = [bossForLair('a:1', { depth: 0 }), bossForLair('a:1', { depth: 0 }), bossForLair('x:7', { depth: .5 }), bossForLair('z:9', { depth: 1 })];
    o.lairSpread = new Set(Array.from({ length: 200 }, (_, i) => bossForLair('k' + i, { depth: 0 }))).size;
    o.lairMax = Math.max(...Array.from({ length: 300 }, (_, i) => bossForLair('k' + i, { depth: 0 })));
    o.ex = [0, 300, 600, 900, 1199].map(i => D[i].full + ' · ' + D[i].t + ' · ' + D[i].el + ' · ' + D[i].mech.join('+') + (D[i].aff.length ? ' · ' + D[i].aff.join('+') : ''));
    o.lore = D[600].lore;
    return o;
  });
  for (const x of g.ex) console.log('       ' + x);
  console.log('       „' + g.lore + '“');
  ok(g.names === 1200 && g.full === 1200, `1200 Bosse mit eindeutigen Namen (${g.names}) und Titeln (${g.full})`);
  ok(g.place === 0, 'Namen, Titel und Legenden ohne übrige Platzhalter');
  ok(g.mechN >= 25 && !g.unused.length, `Bibliothek: ${g.mechN} Mechaniken, jede kommt vor` + (g.unused.length ? ' – fehlt: ' + g.unused : ''));
  ok(g.r0 === 1 && g.rMax === 5 && g.avg.every((v, i) => !i || v >= g.avg[i - 1]), `Mechaniken je Rang steigen: Rang 1 → ${g.r0}, Rang 1200 → ${g.rMax}, Mittel je Band ${g.avg.join(' / ')}`);
  ok(g.tw[0] > 1.1 && g.tw[1] >= .6 && g.tw[1] < .7, `Warnzeit: ${g.tw[0].toFixed(2)} s bei Rang 1, ${g.tw[1].toFixed(2)} s bei Rang 1200`);
  ok(g.affLow === 0 && g.sig > 400 && g.bodies >= 35 && g.els === 6 && g.camp, `Vielfalt: ${g.bodies} Körper (alle 8 Kampagnen-Bosse), 6 Elemente, ${g.sig} mit Signatur-Beute, keine Zusatz-Affixe ganz unten`);
  ok(g.lair[0] === g.lair[1] && g.lair[0] < 40 && Math.abs(g.lair[2] - 600) <= 40 && g.lair[3] >= 1150 && g.lairSpread > 15 && g.lairMax <= 30, `Höhlen: fest je Schlüssel, Rang passt zur Tiefe (Tor ≤ ${g.lairMax + 1}, Mitte ${g.lair[2] + 1}, Rand ${g.lair[3] + 1})`);
  ok(g.ms < 400, `Alle 1200 Bosse erzeugt in ${g.ms.toFixed(0)} ms`);
  // gleiche Bosse nach Neuladen und in einer anderen Sprache
  for (const lang of ['de', 'en']) {
    const p2 = await b.newPage({ viewport: { width: 400, height: 300 }, locale: lang === 'de' ? 'de-DE' : 'en-US' }); watch(p2);
    await p2.goto(BASE + 'index.html'); await p2.evaluate(l => { localStorage.setItem('klingenhort.lang', l); }, lang); await p2.reload(); await p2.waitForTimeout(1200);
    const h = await p2.evaluate(() => { const D = Array.from({ length: BOSS_N }, (_, i) => bossDef(i)), key = B => JSON.stringify([B.t, B.el, B.tint, B.sc, B.name, B.mech, B.res, B.aff, B.sig, B.hpK, B.atkK, B.spdK]); return D.map(key).join('|').length + ':' + D.map(key).reduce((h, s) => (h * 31 + s.length) % 1e9, 7) + '|' + LANG + '|' + bossDef(600).title; });
    ok(h.split('|')[0] === g.hash, `Gleiche Bosse für alle: neu geladen (${lang}): ${h.split('|').slice(1).join(' · ')}`);
    await p2.close();
  }

  /* ---------- Stärke ---------- */
  const pw = await page.evaluate(() => {
    __hero('knight', 5, false);
    const rows = [0, 100, 300, 600, 900, 1199].map(i => { const B = bossDef(i), st = bossStage(B.r), W = bossPower(B, st); return [i + 1, st, W.hp, Math.round(W.atk)]; });
    return { rows, mono: rows.every((r, i) => !i || (r[2] > rows[i - 1][2] && r[3] > rows[i - 1][3])) };
  });
  console.log('       Rang · Stufe · LP · Angriff: ' + pw.rows.map(r => r.join(' · ')).join('  |  '));
  ok(pw.mono && pw.rows[0][2] < 2500 && pw.rows[5][2] > 5e6, 'Stärke steigt mit dem Rang, endliche Zahlen (Rang 1 schwach, Rang 1200 riesig)');

  /* ---------- Jede Mechanik: feuert, warnt vor dem Schaden, hinterlässt nichts ---------- */
  const mech = await page.evaluate(() => {
    __hero('knight', 40, true); P.st.hp = P.hp = 1e9; SAVE.meta.bosses.h = 2147483647;
    const res = {}, real = hurtPlayer; let hits = [];
    hurtPlayer = function (d, src) { if (state === 'play') hits.push(T); return real.apply(this, arguments); };   // die KI des Bosses ruht: jeder Treffer kommt aus der Mechanik
    for (const k of BM_KEYS.filter(k => !BMECH[k].p)) {
      for (const rank of [0, 1199]) {
        BA = null; slowmo = 0; hitStop = 0; bossArena(rank, { practice: false }); __step(70);
        const e = enemies.find(x => x.bz); if (!e) { res[k + rank] = 'kein Boss'; continue; }
        e.stun = 1e9; e.bz.gcd = 999; e.bz.m.forEach(m => m.cd = 999); P.x = e.x + 18; P.y = e.y + 26; P.inv = 0; P.hp = 1e9;
        hits = []; const t0 = T, hp0 = e.hp, en0 = enemies.length, dark0 = G.dark || 0;
        e.hp = e.maxHp * .5;   // für Heilung
        P.inv = 0; bossCast(e, k); e.bz.gcd = 999; e.bz.m.forEach(m => m.cd = 999); __step(1); let mx = { dark: 0, armor: 0, own: 0, min: 0 };
        // Held auf die erste Gefahr stellen (so wird die Warnzeit genau gemessen)
        let spot = null; const z = BZ.fx.find(z => z.o === e && (z.dmg > 0 || z.k === 'r' || z.k === 'm' || z.k === 's'));
        if (z) switch (z.k) {
          case 'c': spot = [z.x, z.y]; break; case 'l': { const u = (z.l0 + z.len) / 2 * (z.l0 < 0 ? 0 : 1) + (z.l0 < 0 ? 40 : 0); spot = [z.x + Math.cos(z.a) * u, z.y + Math.sin(z.a) * u]; break; }
          case 'v': spot = [z.x + Math.cos(z.a) * z.r * .5, z.y + Math.sin(z.a) * z.r * .5]; break; case 'q': spot = [z.x, z.y]; break;
          case 'r': spot = [e.x + Math.cos(z.a0) * 50, e.y + Math.sin(z.a0) * 50]; break; case 'm': spot = [z.x, z.y]; break; case 's': spot = [e.x + z.rad, e.y]; break;
        }
        if (k === 'pull' || k === 'homing' || k === 'mark' || k === 'spiral') spot = null;
        for (let i = 0; i < 60 * 11.5; i++) {
          if (spot) { P.x = spot[0]; P.y = spot[1]; }
          __step(1);
          mx.dark = Math.max(mx.dark, G.dark || 0); mx.armor = Math.max(mx.armor, e.armor); mx.own = Math.max(mx.own, enemies.filter(x => x.bOwn === e).length);
        }
        res[k + ':' + rank] = { lk: BZ.fx.map(z => z.k + ':' + (z.o === e) + ':' + (z.life || z.t)).join(), first: hits.length ? +(hits[0] - t0).toFixed(2) : null, n: hits.length, left: BZ.fx.length, heal: e.hp > e.maxHp * .5, dark: mx.dark > dark0 + .3 && (G.dark || 0) <= dark0 + .01, armor: mx.armor > 0, own: mx.own };
        for (const x of enemies) x.dead = true; enemies = []; projs = []; hazards = []; BZ.fx = [];
      }
    }
    hurtPlayer = real;
    return res;
  });
  const NOHIT = { summon: 'own', shield: 'armor', heal: 'heal', totem: 'own', mirror: 'own', dark: 'dark' };
  const keys = [...new Set(Object.keys(mech).map(k => k.split(':')[0]))];
  let worstWarn = 9, worstK = '';
  for (const k of keys) {
    const a = mech[k + ':0'], z = mech[k + ':1199'];
    if (NOHIT[k]) { ok(a[NOHIT[k]] && z[NOHIT[k]] && !a.left && !z.left, `Mechanik ${k}: wirkt (Rang 1 und 1200), räumt auf`); continue; }
    const w = Math.min(a.first == null ? 9 : a.first, z.first == null ? 9 : z.first); if (w < worstWarn) { worstWarn = w; worstK = k; }
    ok(a.n > 0 && z.n > 0 && !a.left && !z.left && a.first >= .5 && z.first >= .5, `Mechanik ${k}: trifft erst nach der Warnung (Rang 1 nach ${a.first} s, Rang 1200 nach ${z.first} s), räumt auf` + (a.n > 0 && z.n > 0 && !a.left && !z.left ? '' : ' ' + JSON.stringify([a, z])));
  }
  console.log(`       kürzeste Warnzeit: ${worstWarn} s (${worstK})`);
  ok(!errs.length, 'keine Fehler (Mechaniken)' + (errs.length ? ': ' + errs.slice(0, 3).join(' | ') : ''));

  /* ---------- Phasen, Raserei, Ursprung verschieben, Rechenzeit ---------- */
  const pas = await page.evaluate(() => {
    __hero('knight', 50, true); P.st.hp = P.hp = 1e9; slowmo = 0; hitStop = 0;
    const o = {}, id = Array.from({ length: BOSS_N }, (_, i) => i).find(i => bossDef(i).mech.includes('phase') && bossDef(i).mech.includes('enrage') && bossDef(i).res.length);
    BA = null; bossArena(id, { practice: false }); __step(120);   // nach dem Erscheinen
    const e = enemies.find(x => x.bz), B = e.bDef; e.stun = 1e9; e.bz.gcd = 999; e.bz.m.forEach(m => m.cd = 999);
    e.hp = e.maxHp * .2; __step(2); o.one = e.bz.ph === 1 && e.bz.inv > 0;   // tief getroffen: erst eine Phase …
    __step(60 * 2.3); o.two = e.bz.ph === 2 && e.bz.m.some(m => m.k === B.res[0]);   // … die nächste erst danach, mit neuer Kraft
    o.enr = e.bz.enr && e.cdMul < bLerp(1.3, .72, B.r);
    // Ursprung der Welt verschoben: Warnflächen wandern mit
    e.bz.inv = 0; e.bz.hold = 0; bossCast(e, 'meteor'); const z = BZ.fx.find(z => z.k === 'c'), x0 = z.x, y0 = z.y; bossShift(-500, 300); o.shift = z.x === x0 - 500 && z.y === y0 + 300; bossShift(500, -300);
    for (const x of enemies) x.dead = true; enemies = []; BZ.fx = []; projs = [];
    // Rechenzeit: Rang 1200 mit allen Mechaniken im Wechsel und dem Bot
    BA = null; bossArena(BOSS_N - 1, { practice: false }); __botOn(); __step(70);
    const b = enemies.find(x => x.bz); b.bz.m = BM_KEYS.filter(k => !BMECH[k].p).map(k => ({ k, cd: 0 }));
    let n = 0, ms = 0, mx = 0;
    for (let i = 0; i < 1200; i++) { P.hp = P.st.hp; const t0 = performance.now(); __step(1); const d = performance.now() - t0; ms += d; mx = Math.max(mx, BZ.fx.length); n++; }
    __botOff(); o.ms = ms / n; o.zones = mx;
    for (const x of enemies) x.dead = true; enemies = []; BZ.fx = []; projs = [];
    return o;
  });
  ok(pas.one && pas.two, 'Phasen bei 66 % und 33 %: nie zwei auf einmal, danach eine neue Mechanik');
  ok(pas.enr, 'Raserei unter 30 %: schneller und stärker');
  ok(pas.shift, 'Welt verschiebt ihren Ursprung: Warnflächen wandern mit (bossShift / HOOK.shift)');
  ok(pas.ms < 4, `Rechenzeit Rang 1200 mit allen Mechaniken: ${pas.ms.toFixed(2)} ms pro Bild (bis zu ${pas.zones} Warnflächen gleichzeitig)`);

  /* ---------- Sieg, Trophäe, Beute, Rückkehr der Höhle ---------- */
  const kill = await page.evaluate(() => {
    const o = {}, real = Date.now.bind(Date); let NOW = real(); Date.now = () => NOW;
    __hero('ranger', 20, false); SAVE.meta.pets.starter = true;
    const M = SAVE.meta.bosses; M.b = {}; M.l = {}; BTROPH = -1;
    const id = Array.from({ length: 60 }, (_, i) => i).find(i => bossDef(i).sig), B = bossDef(id);
    BA = null; bossArena(0, { practice: false }); __step(80); for (const x of enemies) x.dead = true; enemies = []; pickups = [];
    const ctx = { cx: 12, cy: -3, depth: .004, stage: 6, biome: 'wiese' };
    const fate0 = P.fate || 0, eggs0 = SAVE.meta.pets.eggs.length, parts0 = pcount();
    let e = bossSpawn(id, AW / 2, BD.y0 + 60, { ctx, lair: 'L1', instant: true });
    o.seen = !!M.b[id] && M.b[id][2] === 12 && M.b[id][3] === -3 && M.b[id][0] === 0;
    o.st = e.bStage === 6;
    killEnemy(e, 0, 0);
    o.trophy = bossTrophies() === 1 && M.b[id][0] > 0 && M.b[id][1] === 1;
    o.lair = !bossLairReady('L1') && bossLairLeft('L1') > 2.9 * 864e5;
    o.fate = (P.fate || 0) > fate0; o.parts = pcount() > parts0; o.eggs = SAVE.meta.pets.eggs.length > eggs0;
    const its = pickups.filter(p => p.k === 'loot').map(p => p.it);
    o.items = its.length >= 4 && its.filter(it => it.rar >= 3).length >= 2;
    const sig = its.find(it => it.bsig === id); o.sig = !!sig && sig.rar === 4 && sig.el === B.el && Object.keys(sig.aff).length === 3 && sig.name.includes(B.name) && itemLines(sig).some(l => l.includes('Signatur'));
    o.sigName = sig ? sig.name : '';
    // Uhr vor: 2,9 Tage noch leer, nach 3 Tagen wieder da
    NOW += 2.9 * 864e5; o.early = !bossLairReady('L1');
    NOW += .1 * 864e5 + 60000; o.back = bossLairReady('L1');
    SAVE.meta = fixMeta(JSON.parse(JSON.stringify(SAVE.meta))); o.pruned = !('L1' in SAVE.meta.bosses.l);
    pickups = []; const f1 = P.fate;
    e = bossSpawn(id, AW / 2, BD.y0 + 60, { ctx, lair: 'L1', instant: true }); killEnemy(e, 0, 0);
    const M2 = SAVE.meta.bosses; o.again = bossTrophies() === 1 && M2.b[id][1] === 2 && !bossLairReady('L1') && P.fate - f1 <= 1 && pickups.filter(p => p.k === 'loot').length <= 4;
    // Kontobonus: alle 25 Trophäen, gedeckelt
    const fill = n => { M2.b = {}; for (let i = 0; i < n; i++) M2.b[i] = [29000000, 1]; BTROPH = -1; computeStats(); return Object.assign({}, P.st.m); };
    const base = fill(0), m125 = fill(125), mAll = fill(1200);
    o.bonus = Math.abs((m125.dmg || 0) - (base.dmg || 0) - .02) < 1e-9 && Math.abs((m125.hp || 0) - (base.hp || 0) - .01) < 1e-9 && Math.abs((m125.gold || 0) - (base.gold || 0) - .02) < 1e-9;
    o.cap = Math.abs((mAll.dmg || 0) - (base.dmg || 0) - .12) < 1e-9 && Math.abs((mAll.loot || 0) - (base.loot || 0) - .12) < 1e-9;
    // Spielstand: alle 1200 besiegt und gesehen, 400 Höhlen
    for (let i = 0; i < BOSS_N; i++) M2.b[i] = [29400000 + i, 1 + (i % 9), -4000 + i * 7, 3000 - i * 5];
    for (let i = 0; i < 450; i++) M2.l['lair:' + (i * 7919) + ':' + (i * 104729)] = NOW - i * 1000;
    SAVE.meta = fixMeta(JSON.parse(JSON.stringify(SAVE.meta)));
    o.size = JSON.stringify(SAVE.meta.bosses).length; o.lairs = Object.keys(SAVE.meta.bosses.l).length; o.full = bossTrophies() === 1200;
    // kaputte und alte Daten
    const fx = d => bMetaFix(d);
    const bad = [null, 'x', 5, [], { b: [1, 2] }, { b: { '-5': [1], 99999: [], abc: 5, 7: 'zz', 8: [5, 'x', 'q', null], '1e3': [1, 1], '08': [2, 2] }, l: { __proto__: 5, k: 'NaN', old: NOW - 4 * 864e5, fut: NOW + 9 * 864e5, ok: NOW - 1000 }, tt: 99, h: -4 }];
    o.bad = bad.map(fx).every(m => typeof m.b === 'object' && typeof m.l === 'object' && m.tt === -1 && m.h >= 0);
    const r = fx(bad[5]); o.badDetail = JSON.stringify(r.b) === '{"7":[0,0],"8":[5,1]}' && JSON.stringify(Object.keys(r.l)) === '["ok"]';
    const old = JSON.parse(JSON.stringify(SAVE.meta)); delete old.bosses; o.old = !!fixMeta(old).bosses && fixMeta(old).bosses.v === 1;
    Date.now = real;
    return o;
  });
  ok(kill.seen && kill.st, 'Boss gesehen: Kodex-Eintrag mit Fundort, Stufe aus der Welt');
  ok(kill.trophy && kill.lair, 'Erster Sieg: Trophäe, Höhle 3 Tage leer');
  ok(kill.fate && kill.parts && kill.eggs && kill.items, 'Große Belohnung: Glücksmünzen, Bauteile, Begleiter-Ei, mindestens zwei epische Gegenstände' + (kill.fate && kill.parts && kill.eggs && kill.items ? '' : ' ' + JSON.stringify([kill.fate, kill.parts, kill.eggs, kill.items])));
  ok(kill.sig, `Signatur-Beute: „${kill.sigName}“ (Legendär, Element und Affixe des Bosses)`);
  ok(kill.early && kill.back && kill.pruned, 'Höhle: nach 2,9 Tagen noch leer, nach 3 Tagen ist der Boss zurück (alte Einträge werden gelöscht)');
  ok(kill.again, 'Wieder besiegt: keine zweite Trophäe, normale Beute, Höhle wieder 3 Tage leer');
  ok(kill.bonus && kill.cap, 'Kontobonus: alle 25 Trophäen etwas Schaden/LP/Gold/Beute, höchstens +12 % Schaden');
  ok(kill.size < 60000 && kill.lairs <= 400 && kill.full, `Spielstand mit allen 1200 Bossen und 450 Höhlen: ${(kill.size / 1024).toFixed(1)} KB (Höhlen begrenzt auf ${kill.lairs})`);
  ok(kill.bad && kill.badDetail && kill.old, 'Alte und kaputte Spielstände werden repariert');

  /* ---------- Übungskampf: keine Beute, keine Kosten ---------- */
  const pr = await page.evaluate(() => {
    slowmo = 0; hitStop = 0; __hero('mage', 25, false); SAVE.meta.pets.starter = true; const M = SAVE.meta.bosses; M.b = { 3: [0, 0] }; BTROPH = -1;
    P.potions = 5; P.buffs = [{ n: 'Wut', buff: { dmg: .35 }, rooms: 3 }]; computeStats(); P.hp = P.st.hp * .6; checkAch();   // offene Erfolge vorher auszahlen
    const s0 = { gold: P.gold, fate: P.fate || 0, parts: pcount(), eggs: SAVE.meta.pets.eggs.length, lore: SAVE.meta.lore.length, kills: P.stats.kills, xp: P.xp, hp: P.hp };
    KX.from = 'map'; ON.bk_fight(null, null, 3); const o = { started: G.type === 'bossarena' && P.hp === P.st.hp }; __step(80);
    const e = enemies.find(x => x.bz); o.started = o.started && !!e && e.bPractice;
    for (let i = 0; i < 4; i++) { const m = spawnEnemy('goblin', { x: P.x + 30, y: P.y, instant: true }); killEnemy(m, 0, 0); }
    P.potions = 2; killEnemy(e, 0, 0); __step(240);
    o.dbg = JSON.stringify([P.fate || 0, s0.fate, pcount(), s0.parts, SAVE.meta.pets.eggs.length, s0.eggs, SAVE.meta.lore.length, s0.lore, P.stats.kills, s0.kills, P.xp, s0.xp, P.gold, s0.gold, bossTrophies(), M.b[3]]);
    o.none = (P.fate || 0) === s0.fate && pcount() === s0.parts && SAVE.meta.pets.eggs.length === s0.eggs && SAVE.meta.lore.length === s0.lore && P.stats.kills === s0.kills && P.xp === s0.xp && P.gold === s0.gold && bossTrophies() === 0 && M.b[3][1] === 0;
    o.back = !BA && /BOSS-KODEX/.test(panel.textContent) && P.potions === 5 && Math.abs(P.hp - s0.hp) < 1 && P.buffs[0].rooms === 3;
    return o;
  });
  ok(pr.started, 'Übungskampf aus dem Kodex: startet mit vollen LP');
  ok(pr.none, 'Übungskampf: keine Trophäe, kein Gold, keine Erfahrung, keine Münzen, Eier, Bauteile oder Chronikseiten' + (pr.none ? '' : ' ' + pr.dbg));
  ok(pr.back, 'Übungskampf beendet: zurück im Kodex, Leben, Tränke und Segen wie vorher');

  /* ---------- Kämpfe mit dem Bot ---------- */
  const fight = async (rank, cls, lv, max, secs, shots, tag) => {
    const r = await page.evaluate(([rank, cls, lv, max]) => { __botOff(); hideOverlay(); slowmo = 0; hitStop = 0; __hero(cls, lv, max); BA = null; bossArena(rank, { practice: false }); __botOn(); return { hp: P.st.hp, dmg: Math.round(P.st.wbase * P.st.dmgMul) }; }, [rank, cls, lv, max]);
    let t = 0, shot = 0, res = null;
    while (t < secs) {
      res = await page.evaluate(() => { __step(60); const e = BA && BA.e; return { dead: state === 'dead' || state === 'over', won: !!(e && e.dead && !(state === 'dead' || state === 'over')), f: e ? e.hp / e.maxHp : 1, hp: P.hp / P.st.hp, zones: BZ.fx.length, pot: P.potions }; });
      t++;
      if (OUT && shot < shots && res.zones >= 2 && t > 3 && t % 2 === 0) { await page.evaluate(() => render()); await page.screenshot({ path: `${OUT}/${tag}_${shot}.png` }); shot++; }
      if (res.dead || res.won) break;
    }
    await page.evaluate(() => __botOff());
    return Object.assign(res, { mhp: r.hp, dmg: r.dmg, left: res.hp, t });
  };
  const f0 = await fight(0, 'knight', 5, false, 120, 2, 'quer_rang1');
  ok(f0.won && !f0.dead, `Rang 1 gegen frischen Ritter Level 5 (${f0.mhp} LP, ${Math.round(f0.left * 100)} % übrig, ${f0.pot} von 3 Tränken übrig, ${f0.t} s): gewonnen`);
  const f0m = await fight(0, 'mage', 5, false, 120, 0, 'x');
  ok(f0m.won && !f0m.dead, `Rang 1 gegen frischen Magier Level 5 (${f0m.t} s): gewonnen`);
  for (const [rank, cls] of [[300, 'rogue'], [600, 'knight'], [900, 'ranger']]) {
    const f = await fight(rank, cls, 50, true, 25, 2, 'quer_rang' + (rank + 1));
    console.log(`       Rang ${rank + 1} gegen maximalen Helden (${cls}): ${f.won ? 'gewonnen' : f.dead ? 'gefallen' : 'läuft noch'} nach ${f.t} s, Boss bei ${Math.max(0, Math.round(f.f * 100))} %`);
  }
  const fx = await fight(1199, 'knight', 50, true, 90, 2, 'quer_rang1200');
  ok(fx.dead || fx.f > .9, `Rang 1200 gegen maximalen Helden (LP ${fx.mhp}, Schaden ${fx.dmg}): ${fx.dead ? 'gefallen' : 'nicht geschafft'} nach ${fx.t} s, Boss bei ${Math.round(fx.f * 100)} %`);
  ok(!errs.length, 'keine Fehler (Kämpfe)' + (errs.length ? ': ' + errs.slice(0, 3).join(' | ') : ''));
  await page.close();

  /* ---------- Bilder mitten im Kampf: Rang 1, 301, 601, 901, 1200 – hoch und quer ---------- */
  if (OUT) for (const [W, H] of [[390, 844], [844, 390]]) {
    const ctx = await b.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: 'de-DE' });
    const p = await ctx.newPage(); watch(p);
    await p.goto(BASE + 'index.html'); await p.evaluate(() => localStorage.clear()); await p.reload(); await p.waitForTimeout(1500);
    await p.evaluate(SIM);
    for (const [rank, cls, lv, max] of [[0, 'knight', 5, false], [300, 'rogue', 40, false], [600, 'mage', 50, true], [900, 'ranger', 50, true], [1199, 'knight', 50, true]]) {
      await p.evaluate(([rank, cls, lv, max]) => { __botOff(); hideOverlay(); slowmo = 0; hitStop = 0; __hero(cls, lv, max); SAVE.meta.bosses.h = 2147483647; BA = null; bossArena(rank, { practice: false }); __botOn(true); }, [rank, cls, lv, max]);
      let n = 0, last = -99;
      for (let i = 0; i < 200 && n < 2; i++) {
        const z = await p.evaluate(() => { __step(12); return BZ.fx.filter(z => z.k !== 'z').length; });
        if (z >= 1 && i > 12 && i - last > 15) { last = i; await p.evaluate(() => render()); await p.screenshot({ path: `${OUT}/kampf_${W}x${H}_rang${rank + 1}_${n}.png` }); n++; }
      }
      ok(n === 2, `${W}x${H}: Rang ${rank + 1}: Bilder mitten im Kampf mit Warnflächen`);
    }
    await p.evaluate(() => __botOff());
    await ctx.close();
  }

  /* ---------- Boss-Kodex und Kampf auf dem Handy ---------- */
  for (const [W, H] of [[390, 844], [844, 390]]) {
    console.log(`Boss-Kodex ${W}x${H}`);
    const ctx = await b.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: OUT ? 2 : 1, isMobile: true, hasTouch: true, locale: 'de-DE' });
    const p = await ctx.newPage(); watch(p);
    await p.goto(BASE + 'index.html'); await p.evaluate(() => localStorage.clear()); await p.reload(); await p.waitForTimeout(1500);
    await p.evaluate(SIM);
    await p.evaluate(() => { __hero('knight', 30, false); const M = SAVE.meta.bosses; for (let i = 0; i < 137; i++) M.b[i * 3] = [29400000, 1 + i % 3, i, -i]; for (let i = 0; i < 40; i++) M.b[i * 3 + 1] = [0, 0, 5, 5]; BTROPH = -1; persist(); P.story.a1 = 1; P.map = genMap(1); openMap(); });
    const tap = async sel => { const el = p.locator(sel).first(); await el.scrollIntoViewIfNeeded().catch(() => { }); await el.tap({ timeout: 4000 }); await p.waitForTimeout(280); };
    const inView = async sel => { const el = p.locator(sel).first(); if (!(await el.count())) return false; const r = await el.boundingBox(); return !!r && r.y >= 0 && r.y + r.height <= H + 1 && r.x >= 0 && r.x + r.width <= W + 1; };
    const noOverflow = () => p.evaluate(() => panel.scrollWidth <= panel.clientWidth + 1);
    const small = () => p.evaluate(() => [...panel.querySelectorAll('button')].filter(x => x.offsetParent && !x.closest('.sheetx') && (x.getBoundingClientRect().height < 43.5 || x.getBoundingClientRect().width < 43.5)).map(x => (x.dataset.act || '') + ':' + Math.round(x.getBoundingClientRect().width) + 'x' + Math.round(x.getBoundingClientRect().height)));
    const shot = async n => { if (OUT) await p.screenshot({ path: `${OUT}/${W}x${H}_${n}.png` }); };
    const pre = `${W}x${H}: `;
    await tap('[data-act="mapmore"]'); await tap('[data-act="bk_open"]');
    const top = await p.evaluate(() => ({ h: (panel.querySelector('h2') || {}).textContent, n: (panel.querySelector('.bk-n') || {}).textContent, tiles: panel.querySelectorAll('.bk-t').length, k: panel.querySelectorAll('.bk-t.k').length, u: panel.querySelectorAll('.bk-t.u').length }));
    ok(top.h === 'BOSS-KODEX' && /137/.test(top.n) && /1200/.test(top.n) && top.tiles === 100 && top.k === 34 && top.u === 33, pre + `Kodex von der Karte: „137 / 1200“, 100 Bosse im ersten Rang-Band (${top.k} Trophäen)`);
    ok(await noOverflow(), pre + 'kein seitliches Scrollen');
    const sm = await small(); ok(!sm.length, pre + 'alle Knöpfe mindestens 44 px' + (sm.length ? ': ' + sm.slice(0, 6).join(', ') : ''));
    await shot('01_kodex');
    await tap('[data-act="bk_band"][data-i="3"]');
    ok(await p.evaluate(() => panel.querySelector('.bk-t span').textContent === '301'), pre + 'Rang-Band 301–400 gewählt');
    await tap('[data-act="bk_sel"][data-i="303"]');
    ok(await inView('.side.sheet .bk-d') && await p.evaluate(() => /MECHANIKEN/.test(panel.querySelector('.side').textContent)), pre + 'Boss angetippt: Bild, Name, Titel, Mechaniken sichtbar');
    await shot('02_detail');
    const unsel = async () => { if (await p.locator('.sheetx').first().isVisible()) await tap('.sheetx'); };
    await unsel(); await tap('[data-act="bk_band"][data-i="0"]'); await tap('[data-act="bk_sel"][data-i="5"]');
    ok(await p.evaluate(() => /Unbekannter Boss/.test(panel.querySelector('.side').textContent) && !/MECHANIKEN/.test(panel.querySelector('.side').textContent)), pre + 'Unbekannter Boss: nur Schatten, Rang und Hinweis zur Tiefe');
    await unsel(); await tap('[data-act="bk_f"][data-id="k"]');
    ok(await p.evaluate(() => panel.querySelectorAll('.bk-t').length === 34 && !panel.querySelector('.bk-t.u')), pre + 'Filter „Besiegt“');
    await tap('.bk-tt summary'); await tap('[data-act="bk_title"][data-i="3"]');
    ok(await p.evaluate(() => SAVE.meta.bosses.tt === 3 && /Hammer der Bosse/.test(panel.textContent)), pre + 'Titel gewählt');
    await tap('[data-act="bk_back"]');
    ok(await p.evaluate(() => /Boss-Kodex/.test(panel.textContent) && /Tages-Challenge/.test(panel.textContent)), pre + 'Zurück zu „Mehr“ auf der Karte');
    // Bestiarium im Titel
    await p.evaluate(() => { titleScene(); showTitle(); });
    await tap('[data-act="best"]'); await tap('[data-act="bk_open"]');
    ok(await p.evaluate(() => (panel.querySelector('h2') || {}).textContent === 'BOSS-KODEX'), pre + 'Kodex aus dem Bestiarium');
    await tap('[data-act="bk_back"]');
    ok(await p.evaluate(() => (panel.querySelector('h2') || {}).textContent === 'BESTIARIUM'), pre + 'Zurück ins Bestiarium');
    // Übungskampf gegen einen gesehenen Boss, Bilder mitten im Kampf
    await tap('[data-act="bk_open"]'); await tap('[data-act="bk_band"][data-i="2"]'); await tap('[data-act="bk_sel"][data-i="201"]');
    await tap('[data-act="bk_fight"]'); await p.waitForTimeout(400);
    ok(await p.evaluate(() => state === 'play' && G.type === 'bossarena' && !!BA && BA.practice), pre + 'Übungskampf gestartet');
    await p.evaluate(() => { __botOn(); P.st.hp = P.hp = 1e7; });
    let n = 0;
    for (let i = 0; i < 40 && n < 3; i++) { await p.waitForTimeout(500); const z = await p.evaluate(() => BZ.fx.length); if (z >= 1 && i > 3) { await shot('03_kampf_' + n); n++; } }
    ok(await p.evaluate(() => !$('bossbar').hidden && /Rang 202/.test($('bossSub').textContent)), pre + 'Bossleiste mit Titel und Rang');
    const hudOk = await p.evaluate(() => { const r = $('bossbar').getBoundingClientRect(), h = $('hud').getBoundingClientRect(); return r.top >= h.top && r.right <= innerWidth && r.left >= 0; });
    ok(hudOk, pre + 'Bossleiste im Bild');
    await p.evaluate(() => { __botOff(); const e = BA.e; killEnemy(e, 0, 0); });
    for (let i = 0; i < 20 && await p.evaluate(() => !!BA); i++) await p.waitForTimeout(400);
    await p.waitForTimeout(300);
    ok(await p.evaluate(() => (panel.querySelector('h2') || {}).textContent === 'BOSS-KODEX' && !BA), pre + 'Nach dem Übungskampf zurück im Kodex');
    await ctx.close();
  }
  ok(!errs.length, 'keine Fehler im Spiel' + (errs.length ? ': ' + errs.slice(0, 3).join(' | ') : ''));
  await b.close();
  console.log(fails.length ? `\n${fails.length} FEHLGESCHLAGEN` : '\nAlles grün');
  process.exit(fails.length ? 1 : 0);
})();
