'use strict';
/* =========================================================
   KLINGENHORT – Meisterschaft – Fähigkeiten werden durch Benutzen stärker und ändern ihr Aussehen
   Hängt sich über HOOK/ACTS (js/core.js) ins Spiel ein.
   P.mastery = { <Fähigkeit>: Punkte gesamt } (alte Spielstände: leer = Stufe 1).
   Stufe 1–50. Punkte nur im Kampf (Gegner im Raum, nicht im Versteck): 1 je angefangene 2,5 s
   Grund-Abklingzeit (Ultimative 5) – so brauchen seltene Fähigkeiten nicht viel länger als häufige.
   Rang II nach etwa einer Stunde, Stufe 50 nach Hunderten von Stunden.
   Je Stufe: +2 % Schaden, −0,4 % Abklingzeit (höchstens −20 %), −0,5 % Kosten.
   Je Rang (I 1–9, II 10, III 20, IV 30, V 40, VI 50): neue Farbe + Partikelspur, ab III größer,
   VI golden mit Funkeln – und eine kleine Verbesserung aus MASTERY (Werte wie Talente: mod('k1Stun') …).
   Grafik ohne ctx.filter: jedes Bild wird einmal pixelweise umgefärbt und zwischengespeichert
   (läuft so auch in Safari auf älteren iPhones). Gezeichnet in js/render.js, Werte genutzt in js/combat.js.
   ========================================================= */

const MAST_MAX = 50;
const MRANK = [_t('Lehrling'), _t('Geselle'), _t('Experte'), _t('Meister'), _t('Großmeister'), _t('Legende')];
const MROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI'];
// Punkte von Stufe l auf l+1 – früh schnell, spät sehr lang (Stufe 10 ≈ 1050, Stufe 50 ≈ 272 000)
const mastNeed = l => Math.round(6 * Math.pow(l, 1.7) * (1 + Math.pow(l / 25, 2)));
const MCUM = [0, 0]; for (let l = 1; l < MAST_MAX; l++) MCUM.push(MCUM[l] + mastNeed(l)); // MCUM[lv] = Punkte gesamt für Stufe lv
const MSC = [1, 1, 1.1, 1.25, 1.3, 1.4];     // Größe der Effekte je Rang
const MTRAIL = [0, 14, 22, 32, 40, 50];      // Spurpartikel je Sekunde und Geschoss

/* Je Fähigkeit: c0 = Grundfarbe (Rang I), h = Farbtöne der Ränge II–V (VI = Gold),
   up = Verbesserung je Rang II–VI (wird aufaddiert). Neue Werte wirken in js/combat.js. */
const MASTERY = {
  k1: { c0: '#ffd27a', h: [15, 200, 275, 345], up: [[{ k1Stun: .2 }, _t('+0,2 s Betäubung')], [{ k1Dmg: .2 }, _t('+20 % Schaden')], [{ k1Wide: 1 }, _t('Breiter und 20 % weiter')], [{ k1Wave: 1 }, _t('Schockwelle am Ende des Ansturms')], [{ k1Wave: 1, k1Stun: .3 }, _t('Größere Schockwelle, +0,3 s Betäubung')]] },
  k2: { c0: '#e8eef8', h: [190, 130, 280, 0], up: [[{ k2Dur: .2 }, _t('+0,2 s Dauer')], [{ k2Rad: .15 }, _t('+15 % Reichweite')], [{ k2Dmg: .2 }, _t('+20 % Schaden')], [{ k2Pull: 1 }, _t('Zieht Gegner in den Wirbel')], [{ k2Dur: .3, k2Rad: .15 }, _t('+0,3 s Dauer, +15 % Reichweite')]] },
  k3: { c0: '#6a8ae8', h: [185, 140, 285, 15], up: [[{ k3Dur: .5 }, _t('+0,5 s Dauer')], [{ k3Heal: .08 }, _t('Heilt beim Wirken 8 % LP')], [{ k3Dr: .1 }, _t('80 % statt 70 % weniger Schaden')], [{ k3Push: 1 }, _t('Stößt Gegner beim Wirken zurück')], [{ k3Dur: .5, k3Heal: .04 }, _t('+0,5 s Dauer, Heilung 12 % LP')]] },
  ku: { c0: '#ffb03a', h: [355, 95, 200, 290], up: [[{ uRad: .1 }, _t('+10 % Radius')], [{ uDmg: .2 }, _t('+20 % Schaden')], [{ uStun: 1 }, _t('Betäubt Getroffene 1 s')], [{ uAfter: 1 }, _t('Nachbeben nach 0,4 s')], [{ uRad: .15, uDmg: .2 }, _t('+15 % Radius, +20 % Schaden')]] },
  m1: { c0: '#ff8a2a', h: [357, 312, 210, 268], up: [[{ m1Rad: .15 }, _t('+15 % Explosionsradius')], [{ m1Burn: 1 }, _t('Setzt Getroffene immer in Brand')], [{ m1Dmg: .2 }, _t('+20 % Schaden')], [{ m1Twin: 1 }, _t('Zwei Feuerbälle auf einmal')], [{ m1Twin: 1 }, _t('Drei Feuerbälle auf einmal')]] },
  m2: { c0: '#8ee6ff', h: [160, 225, 270, 320], up: [[{ m2Freeze: .3 }, _t('+0,3 s Einfrieren')], [{ m2Rad: .15 }, _t('+15 % Radius')], [{ m2Dmg: .25 }, _t('+25 % Schaden')], [{ m2Armor: 1 }, _t('Frostpanzer: 3 s lang −30 % Schaden')], [{ m2Rad: .15, m2Freeze: .3 }, _t('+15 % Radius, +0,3 s Einfrieren')]] },
  m3: { c0: '#aae6ff', h: [265, 130, 0, 300], up: [[{ m3Chain: 1 }, _t('+1 Sprung')], [{ m3Range: .25 }, _t('+25 % Sprungweite')], [{ m3Decay: .075 }, _t('Verliert beim Springen nur halb so viel Kraft')], [{ m3Chain: 1 }, _t('+1 Sprung')], [{ m3Chain: 1, m3Stun: .5 }, _t('+1 Sprung, lähmt Getroffene 0,5 s')]] },
  mu: { c0: '#ff8a2a', h: [357, 312, 210, 268], up: [[{ uCount: 2 }, _t('+2 Meteore')], [{ muRad: .15 }, _t('+15 % Einschlagradius')], [{ uCount: 2 }, _t('+2 Meteore')], [{ muDmg: .25 }, _t('+25 % Schaden')], [{ uCount: 4, muRad: .15 }, _t('+4 Meteore, +15 % Einschlagradius')]] },
  r1: { c0: '#b892f4', h: [295, 160, 0, 215], up: [[{ r1Far: .2 }, _t('+20 % Weg')], [{ r1Dmg: .2 }, _t('+20 % Schaden')], [{ r1Wide: 1 }, _t('Breiter Schritt (+40 % Trefferbreite)')], [{ r1Stealth: .8 }, _t('Danach 0,8 s unsichtbar')], [{ r1Dmg: .3, r1Far: .2 }, _t('+30 % Schaden, +20 % Weg')]] },
  r2: { c0: '#6ad8e0', h: [95, 270, 325, 15], up: [[{ r2Knives: 1 }, _t('+1 Messer')], [{ r2Pierce: 1 }, _t('Messer durchbohren Gegner')], [{ r2Dmg: .25 }, _t('+25 % Schaden')], [{ r2Knives: 2 }, _t('+2 Messer')], [{ r2Ring: 1 }, _t('Zusätzlich ein Messerkranz rundum')]] },
  r3: { c0: '#6a6478', h: [285, 160, 0, 215], up: [[{ r3Dur: .5 }, _t('+0,5 s Unsichtbarkeit')], [{ r3Dmg: .25 }, _t('+25 % Hinterhalt-Schaden')], [{ r3Blind: 1.5 }, _t('Rauch betäubt Gegner ringsum 1,5 s')], [{ r3Heal: .1 }, _t('Heilt 10 % LP')], [{ r3Dur: .5, r3Dmg: .25 }, _t('+0,5 s, +25 % Hinterhalt-Schaden')]] },
  ru: { c0: '#7a5ab8', h: [300, 170, 0, 215], up: [[{ ruDur: 1 }, _t('+1 s Dauer')], [{ ruDmg: .25 }, _t('+25 % Klon-Schaden')], [{ uCount: 1 }, _t('+1 Klon')], [{ ruBoom: 1 }, _t('Klone explodieren am Ende')], [{ uCount: 1, ruDur: 1 }, _t('+1 Klon, +1 s Dauer')]] },
  a1: { c0: '#c8463c', h: [95, 185, 280, 330], up: [[{ a1Count: 1 }, _t('+1 Pfeil')], [{ a1Pierce: 1 }, _t('Pfeile durchbohren Gegner')], [{ a1Dmg: .2 }, _t('+20 % Schaden')], [{ a1Count: 2 }, _t('+2 Pfeile')], [{ a1Twice: 1 }, _t('Zweite Salve mit halbem Schaden')]] },
  a2: { c0: '#ffb03a', h: [95, 190, 280, 0], up: [[{ a2Rad: .1 }, _t('+10 % Radius')], [{ a2Dmg: .2 }, _t('+20 % Schaden')], [{ a2Max: 1 }, _t('+1 gleichzeitige Falle')], [{ a2Slow: 2.5 }, _t('Explosion verlangsamt 2,5 s')], [{ a2Rad: .15, a2Dmg: .25 }, _t('+15 % Radius, +25 % Schaden')]] },
  a3: { c0: '#9be070', h: [165, 320, 270, 20], up: [[{ a3Dur: 2 }, _t('+2 s Dauer')], [{ a3Dmg: .2 }, _t('+20 % Schaden')], [{ a3Fast: .25 }, _t('Schießt 25 % schneller')], [{ a3Heal: 1 }, _t('Heilt dich alle 3 s um 2 % LP')], [{ a3Count: 1 }, _t('Ein weiterer Waldgeist')]] },
  au: { c0: '#c8463c', h: [200, 140, 270, 320], up: [[{ uDur: 1 }, _t('+1 Salve')], [{ uDmg: .2 }, _t('+20 % Schaden')], [{ auArrows: 1 }, _t('+2 Pfeile je Salve')], [{ uDur: 2 }, _t('+2 Salven')], [{ uDmg: .25, auArrows: 1 }, _t('+25 % Schaden, +2 Pfeile je Salve')]] }
};

/* ---------- Stufe & Werte ---------- */
function mastXP(id) { const v = P && P.mastery ? +P.mastery[id] : 0; return v > 0 && isFinite(v) ? v : 0; }
function mastLv(id) { const x = mastXP(id); let l = 1; while (l < MAST_MAX && x >= MCUM[l + 1]) l++; return l; }
const mrank = lv => lv >= MAST_MAX ? 5 : Math.floor(lv / 10);
function mastPts(id) { const S = SKILLS[id]; return S.ult ? 5 : Math.max(1, Math.ceil(S.cd / 2.5)); }
function mastCd(id) { return 1 - Math.min(.2, (mastLv(id) - 1) * .004); }
function mastCost(id) { return 1 - (mastLv(id) - 1) * .005; }
function classSkills() { const C = CLASSES[P.cls]; return C.skills.concat([C.ult]); }

/* ---------- Aussehen je Rang ---------- */
function hslHex(h, s, l) { return '#' + hsl2rgb(h, s, l).map(v => v.toString(16).padStart(2, '0')).join(''); }
function rgb2hsl(r, g, b) {
  r /= 255; g /= 255; b /= 255; const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2;
  if (mx === mn) return [0, 0, l];
  const d = mx - mn, s = l > .5 ? d / (2 - mx - mn) : d / (mx + mn), h = mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [h * 60, s, l];
}
function hsl2rgb(h, s, l) {
  h = (((h % 360) + 360) % 360) / 360; if (!s) { const v = Math.round(l * 255); return [v, v, v]; }
  const q = l < .5 ? l * (1 + s) : l + s - l * s, p = 2 * l - q, f = t => { t = (t + 1) % 1; return t < 1 / 6 ? p + (q - p) * 6 * t : t < .5 ? q : t < 2 / 3 ? p + (q - p) * (2 / 3 - t) * 6 : p; };
  return [f(h + 1 / 3), f(h), f(h - 1 / 3)].map(v => Math.round(clamp(v, 0, 1) * 255));
}
/* sk = Aussehen einer Fähigkeit auf einem Rang (Rang I: null = Original). Wird an Geschosse/Effekte gehängt. */
const SKV = {};
function mastVis(id, r) {
  if (r == null) r = mrank(mastLv(id)); if (!r || !MASTERY[id]) return null;
  const k = id + r; if (SKV[k]) return SKV[k];
  const gold = r === 5, h = gold ? 44 : MASTERY[id].h[r - 1];
  const v = gold ? { col: '#ffd24a', col2: '#fff6c0', pal: ['#fff6c0', '#ffe27a', '#ffd24a', '#c8902a'], glow: '255,214,110' }
    : { col: hslHex(h, .85, .62), col2: hslHex(h + 25, .95, .8), pal: [hslHex(h + 30, 1, .86), hslHex(h + 10, .95, .68), hslHex(h, .85, .54), hslHex(h - 15, .8, .4)], glow: hsl2rgb(h, .9, .62).join(',') };
  return SKV[k] = Object.assign(v, { id, r, hue: h, gold, sc: MSC[r], key: k });
}
/* Bild einmal pixelweise umfärben: Farbton drehen (h0 = Grundton des Bildes), Grau tönen, Rang VI golden;
   tint = ganz in die Rangfarbe tauchen (Waldgeist). Ersetzt ctx.filter, das alte iPhones nicht können. */
function skRecolor(src, sx, sy, w, h, sk, h0, tint, dim) {
  const c = mk(w, h, g => g.drawImage(src, sx, sy, w, h, 0, 0, w, h)), g = c.getContext('2d');
  let d; try { d = g.getImageData(0, 0, w, h); } catch (e) { return c; }
  const p = d.data, rot = sk.hue - h0;
  for (let i = 0; i < p.length; i += 4) {
    if (!p[i + 3]) continue;
    let [hh, s, l] = rgb2hsl(p[i], p[i + 1], p[i + 2]);
    if (sk.gold) { hh = 44 + angDiff((hh - h0) * Math.PI / 180, 0) * 3.4; s = Math.min(1, .5 + s * .5); l = Math.min(.97, l * 1.04 + .03); }
    else if (tint) { hh = sk.hue + (hh - h0) * .15; s = Math.max(s, .6); }
    else if (s < .18) { hh = sk.hue; s = .3 + s * 2; }
    else hh += rot;
    if (dim && l > .45) { l = .45 + (l - .45) * dim; s = Math.max(s, .8); } // helle, additiv gemalte Bilder: sonst nur Weiß
    const rgb = hsl2rgb(hh, s, l); p[i] = rgb[0]; p[i + 1] = rgb[1]; p[i + 2] = rgb[2];
  }
  g.putImageData(d, 0, 0); return c;
}
const SKC = {};
const FXH = { fireball: 25, firebomb: 25, boom: 35, ring: 150, bolt: 195, icelance: 190, plant: 100, shield: 225, splash: 200 };
const FXDIM = { bolt: .45, ring: .7, icelance: .75 };
// Effekt-Bildstreifen (alle Frames, wie tintedFx) in der Rangfarbe
function skFx(name, sk) { const k = name + sk.key; if (SKC[k]) return SKC[k]; const m = FX[name]; return SKC[k] = skRecolor(FXIMG, m[0], m[1], m[2] * m[4], m[3], sk, FXH[name] || 0, false, FXDIM[name]); }
// Ausschnitt aus dem Atlas (Pfeil, Messer, Falle, Waldgeist) in der Rangfarbe
function skSheet(sx, sy, w, h, sk, h0, tint) { const k = sx + ',' + sy + sk.key; if (SKC[k]) return SKC[k]; return SKC[k] = skRecolor(SHEET, sx, sy, w, h, sk, h0, tint); }
// weiches Leuchten: einmal gemalt, danach nur kopiert (billiger als ein Verlauf je Geschoss)
function skGlow(sk, x, y, r, a) {
  const k = 'g' + sk.key; let c = SKC[k];
  if (!c) { c = SKC[k] = mk(32, 32); const g = c.getContext('2d'), gr = g.createRadialGradient(16, 16, 0, 16, 16, 16); gr.addColorStop(0, 'rgba(' + sk.glow + ',1)'); gr.addColorStop(1, 'rgba(' + sk.glow + ',0)'); g.fillStyle = gr; g.fillRect(0, 0, 32, 32); }
  ctx.globalAlpha = a; ctx.drawImage(c, x - r, y - r, r * 2, r * 2); ctx.globalAlpha = 1;
}
// Bilder vorab färben, damit der erste Einsatz nicht ruckelt
const MWARM = { k1: ['boom'], k3: ['shield'], ku: ['ring', 'boom'], m1: ['fireball', 'boom'], m2: ['ring', 'icelance'], m3: ['bolt'], mu: ['firebomb', 'boom'], ru: ['boom'], a2: ['boom'], a3: ['plant'] };
function mastWarm(id) { const sk = mastVis(id); if (sk && FXIMG.complete) for (const n of MWARM[id] || []) skFx(n, sk); }

/* ---------- Punkte sammeln, Aufstieg ---------- */
function mpart(x, y, z, vx, vy, vz, col, life, s, g, blink) { parts.push({ x, y, z, vx, vy, vz, col, life, max: life, s: s || 1, g, glow: 1, blink: blink ? 1 : 0 }); }
function mastGain(id, n) {
  const a = mastLv(id); P.mastery[id] = Math.min(MCUM[MAST_MAX], mastXP(id) + n); const b = mastLv(id);
  if (b === a) return;
  const r = mrank(b);
  if (r > mrank(a)) { mastRankUp(id, r); return; }
  const sk = mastVis(id, r); txt(P.x, P.y - 46, _t('{skill} Stufe {lv}', { skill: SKILLS[id].n, lv: b }), sk ? sk.col : '#efe2bf');
}
function mastRankUp(id, r) {
  const S = SKILLS[id], sk = mastVis(id, r);
  computeStats(); mastWarm(id); mastPips();
  banner(_t('{skill} – {rank}', { skill: S.n.toLocaleUpperCase(LOCALE), rank: MRANK[r].toLocaleUpperCase(LOCALE) }), _t('Meisterschaft Rang {n}: {up}', { n: MROMAN[r], up: MASTERY[id].up[r - 1][1] }));
  sfx(r === 5 ? 'myth' : 'ach');
  if (!G || !bg) return;
  rings.push({ x: P.x, y: P.y, r: 2, max: 54, life: .6, max2: .6, col: sk.col }, { x: P.x, y: P.y, r: 2, max: 32, life: .45, max2: .45, col: sk.col2 });
  fx.push({ k: 'pillar', x: P.x, y: P.y, life: 1, max: 1 });
  for (let i = 0; i < 40; i++) mpart(P.x + rnd(-8, 8), P.y + rnd(-4, 4), rnd(0, 12), rnd(-50, 50), rnd(-30, 30), rnd(40, 130), pick(sk.pal), rnd(.5, 1.1), Math.random() < .4 ? 2 : 1, 120, r === 5);
}

/* ---------- Andocken ---------- */
HOOK.activate.push(c => {
  if (!c.mastery || typeof c.mastery !== 'object' || Array.isArray(c.mastery)) c.mastery = {};
  for (const k in c.mastery) { const v = +c.mastery[k]; c.mastery[k] = v > 0 && isFinite(v) ? Math.min(v, MCUM[MAST_MAX]) : 0; }
  c.msFrost = 0;
});
// Rang-Verbesserungen als Werte wie bei Talenten; Rauchbombe: Stufen-Bonus auf den Hinterhalt-Schaden
HOOK.stats.push(add => {
  if (!P || !P.mastery) return;
  for (const id of classSkills()) {
    const M = MASTERY[id]; if (!M) continue; const lv = mastLv(id), r = mrank(lv);
    for (let i = 1; i <= r; i++) { const e = M.up[i - 1][0]; for (const k in e) add(k, e[k]); }
    if (id === 'r3' && lv > 1) add('r3Dmg', (lv - 1) * .02);
  }
});
// Jeder Einsatz: Punkte (nur im echten Kampf), Schaden je Stufe, Aussehen des Rangs für alle Treffer/Effekte
HOOK.skill.push((id, w) => {
  if (!MASTERY[id] || !P) return;
  if (G && G.type !== 'versteck' && enemies.some(e => !e.dead && e.ai !== 'dummy')) mastGain(id, mastPts(id));
  const lv = mastLv(id); w.dmg *= 1 + (lv - 1) * .02; w.sk = mastVis(id);
});
// Frostnova Rang V: Frostpanzer
HOOK.hurt.push(d => P.msFrost > T ? d * .7 : d);
HOOK.room.push(() => { P.msFrost = 0; for (const id of classSkills()) mastWarm(id); });
let mPipT = 0;
HOOK.update.push(dt => { mastTrails(dt); if ((mPipT -= dt) <= 0) { mPipT = .5; mastPips(); } });

/* ---------- Partikelspuren (überall sichtbar, auch ohne Filter) ---------- */
function trail(sk, x, y, z, vx, vy, rate, dt, spread, g) {
  let n = rate * dt; const s = spread || 1.5;
  while (n > 0) {
    if (n < 1 && Math.random() > n) break; n--;
    const spark = sk.gold ? Math.random() < .35 : sk.r >= 4 && Math.random() < .15;
    const col = spark ? (sk.gold ? '#ffffff' : sk.col2) : sk.r >= 3 ? (Math.random() < .5 ? sk.col : sk.col2) : sk.col;
    mpart(x + rnd(-s, s), y + rnd(-s, s) * .5, Math.max(0, z + rnd(-s, s) * .6), vx + rnd(-8, 8), vy + rnd(-5, 5), rnd(-3, 10), col, rnd(.25, .4) + sk.r * .04, sk.r >= 3 && Math.random() < .3 ? 2 : 1, g == null ? -6 : g, spark);
  }
}
function mastTrails(dt) {
  // alle Geschosse zusammen höchstens ~160 Spurpartikel pro Sekunde (Pfeilsturm!)
  let n = 0; for (const p of projs) if (p.from === 'p' && p.w && p.w.sk && !(p.delay > 0)) n++;
  for (const p of projs) { const sk = p.from === 'p' && p.w && p.w.sk; if (!sk || p.delay > 0) continue; trail(sk, p.x, p.y, p.h, -p.vx * .08, -p.vy * .08, Math.min(MTRAIL[sk.r], 160 / n), dt); }
  const D = P.dash, L = P.leap;
  if (D && D.sk) trail(D.sk, P.x, P.y, 8, -D.dx * 30, -D.dy * 30, 70, dt, 6);
  if (L && L.sk) trail(L.sk, P.x, P.y, P.z + 6, 0, 0, 60, dt, 6);
  if (P.spin > 0 && P.spinSk) { const K = 1 + mod('k2Rad'); trail(P.spinSk, P.x + Math.cos(P.spinA) * 24 * K, P.y + Math.sin(P.spinA) * 12 * K, 8, 0, 0, 60, dt, 2); }
  if (P.wall > 0 && P.wallSk) { const a = rnd(0, 6.283); trail(P.wallSk, P.x + Math.cos(a) * 12, P.y + Math.sin(a) * 6, rnd(2, 18), 0, 0, 24, dt, 1, -30); }
  if (P.stealth > 0 && P.stealthSk) trail(P.stealthSk, P.x, P.y, rnd(2, 14), 0, 0, 18, dt, 7, -10);
  if (P.msFrost > T) { const sk = mastVis('m2') || mastVis('m2', 2); trail(sk, P.x, P.y, rnd(2, 16), 0, 0, 16, dt, 8, -15); }
  for (const a of allies) if (a.sk) trail(a.sk, a.x, a.y, (a.z || 0) + 6, 0, 0, a.k === 'spirit' ? 20 : 12, dt, 4);
  for (const t of traps) if (t.sk) trail(t.sk, t.x, t.y, 6, 0, 0, 5, dt, 5, -20);
}

/* ---------- Rang-Zeichen auf den Fähigkeits-Knöpfen (ab Rang II) ---------- */
function mastPips() {
  if (!P || !P.cls) return;
  classSkills().forEach((id, i) => {
    const r = mrank(mastLv(id)), sk = mastVis(id, r), t = r ? MROMAN[r] : '', key = t + (sk ? sk.col : '');
    for (const el of [$(['bS1', 'bS2', 'bS3', 'bUlt'][i]), $('sk' + i)]) {
      if (!el) continue; let b = el.querySelector('.mpip');
      if (!b) { if (!t) continue; b = document.createElement('b'); b.className = 'mpip'; el.appendChild(b); }
      if (b.dataset.k !== key) { b.dataset.k = key; b.textContent = t; b.style.color = sk ? sk.col : ''; }
    }
  });
}

/* ---------- Charakter → Talente: Meisterschaft je Fähigkeit ---------- */
function mastSw(id, r) { const sk = mastVis(id, r); return !sk ? MASTERY[id].c0 : sk.gold ? 'linear-gradient(135deg,#fff6c0,#ffd24a 45%,#9c6a24)' : `linear-gradient(135deg,${sk.col2},${sk.col} 50%,${sk.pal[3]})`; }
HOOK.skillRow.push(id => {
  const M = MASTERY[id]; if (!M || !P) return '';
  const S = SKILLS[id], lv = mastLv(id), r = mrank(lv), sk = mastVis(id, r), x = mastXP(id), full = lv >= MAST_MAX;
  const a = MCUM[lv], b = full ? a : MCUM[lv + 1], p = full ? 100 : (x - a) / (b - a) * 100, n1 = v => (Math.round(v * 10) / 10).toLocaleString(LOCALE), d = (lv - 1) * 2;
  const eff = [id === 'k3' ? _t('+{n} % Rückwurf-Schaden', { n: d }) : id === 'r3' ? _t('+{n} % Hinterhalt-Schaden', { n: d }) : _t('+{n} % Schaden', { n: d })];
  if (!S.ult) eff.push(_t('Abklingzeit −{n} %', { n: n1((1 - mastCd(id)) * 100) }), _t('Kosten −{n} %', { n: n1((1 - mastCost(id)) * 100) }));
  const nr = r < 5 ? r + 1 : 0, pts = mastPts(id);
  const next = nr ? _t('Ab Stufe {lv}: Rang {n} {rank} – {up}', { lv: nr === 5 ? MAST_MAX : nr * 10, n: MROMAN[nr], rank: MRANK[nr], up: M.up[nr - 1][1] }) : _t('Höchster Rang erreicht – golden und funkelnd!');
  const all = MROMAN.map((rn, i) => `<div class="${i <= r ? 'on' : ''}"><i class="msw" style="background:${mastSw(id, i)}"></i><b>${rn}</b> ${MRANK[i]} · ${_t('Stufe {lv}', { lv: i === 5 ? MAST_MAX : Math.max(1, i * 10) })}: ${i ? M.up[i - 1][1] : _t('Grundform')}</div>`).join('');
  return `<div class="mst" style="--c:${sk ? sk.col : 'var(--parch)'}"><div class="mh"><b class="mrk" style="background:${mastSw(id, r)}">${MROMAN[r]}</b><span>${MRANK[r]} · ${_t('Stufe {lv}/{max}', { lv, max: MAST_MAX })}</span></div>`
    + `<div class="mbar"><i style="width:${p.toFixed(1)}%"></i><span>${full ? _t('VOLL') : fmt(x - a) + '/' + fmt(b - a)}</span></div>`
    + `<small>${eff.join(' · ')}</small><small class="mnx">${nr ? `<i class="msw" style="background:${mastSw(id, nr)}"></i>` : ''}${next}</small>`
    + `<small>${pts === 1 ? _t('+1 Punkt je Einsatz im Kampf') : _t('+{n} Punkte je Einsatz im Kampf', { n: pts })}</small>`
    + `<details class="mall"><summary>${_t('ALLE RÄNGE')}</summary>${all}</details></div>`;
});

document.head.insertAdjacentHTML('beforeend', `<style>
.mst{margin-top:6px;font-size:16px;line-height:1.1}.mst .mh{display:flex;align-items:center;gap:6px;flex-wrap:wrap}.mst .mh span{color:var(--c)}
.mrk{display:inline-block;min-width:24px;text-align:center;font-family:var(--f-display);font-size:8px;font-weight:400;padding:4px 3px 3px;color:#110e17;box-shadow:0 0 0 1px #000}
.mbar{position:relative;height:12px;margin:5px 0 4px;background:var(--night);box-shadow:0 0 0 1px var(--stone-hi)}.mbar i{position:absolute;left:0;top:0;bottom:0;background:var(--c);box-shadow:inset 0 2px 0 rgba(255,255,255,.3)}
.mbar span{position:absolute;inset:0;display:grid;place-items:center;font-family:var(--f-display);font-size:7px;color:#fff;text-shadow:1px 1px 0 #000}
.mst small{display:block;font-size:15px;color:var(--parch-dim);margin-top:2px}.mst .mnx{color:var(--parch)}
.msw{display:inline-block;width:10px;height:10px;margin-right:5px;vertical-align:-1px;box-shadow:0 0 0 1px #000}
details.mall summary{display:flex;align-items:center;min-height:44px;cursor:pointer;list-style:none;font-family:var(--f-display);font-size:8px;color:var(--gold)}
details.mall summary::-webkit-details-marker{display:none}details.mall summary::before{content:'';border:4px solid transparent;border-left:6px solid var(--gold);margin-right:6px}details.mall[open] summary::before{border:4px solid transparent;border-top:6px solid var(--gold);margin-top:4px}
details.mall div{font-size:15px;color:var(--parch-dim);opacity:.55;margin:3px 0}details.mall div.on{opacity:1;color:var(--parch)}
.mpip{position:absolute;z-index:3;font-family:var(--f-display);font-size:6px;font-weight:400;line-height:1;text-shadow:1px 1px 0 #000,-1px -1px 0 #000;pointer-events:none}
.tb .mpip{left:50%;bottom:5px;transform:translateX(-50%)}.sk .mpip{left:2px;bottom:2px}
</style>`);
