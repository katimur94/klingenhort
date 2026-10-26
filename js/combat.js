'use strict';
/* =========================================================
   KLINGENHORT – Kampf: Spieler, Fähigkeiten, Gegner, Schaden
   ========================================================= */

let T = 0, hitStop = 0, slowmo = 0, deadT = 0;
let flash = { a: 0, c: '200,40,40' };

/* ---------- Effekte ---------- */
function shake(m) { if (SAVE && SAVE.meta.settings.calm) return; shk.m = Math.max(shk.m, m); }
function txt(x, y, s, col, big) { texts.push({ x, y, s, col, life: .8, big, born: T }); }
function part(x, y, z, vx, vy, vz, col, life, s, g, glow) { parts.push({ x, y, z, vx, vy, vz, col, life, max: life, s: s || 1, g: g == null ? 220 : g, glow }); }
function dust(x, y, n) { for (let i = 0; i < (n || 2); i++) part(x + rnd(-3, 3), y + rnd(-1, 1), 1, rnd(-15, 15), rnd(-6, 6), rnd(10, 25), bg ? bg.b.dust : '#8a8a7a', rnd(.25, .45), 1, 60); }
function burst(x, y, z, col, n, sp, glow) { for (let i = 0; i < n; i++) { const a = rnd(0, 6.28), v = rnd(.3, 1) * (sp || 60); part(x, y, z, Math.cos(a) * v, Math.sin(a) * v * .6, rnd(30, 90), col, rnd(.3, .7), Math.random() < .3 ? 2 : 1, 220, glow); } }
function spark(x, y, ang, col) { fx.push({ k: 'spark', x, y, ang, life: .14, max: .14, col: col || '#fff' }); }
function fxAnim(name, x, y, o) { o = o || {}; fx.push(Object.assign({ k: 'anim', name, x, y, life: o.dur || .5, max: o.dur || .5, sc: 1, rot: 0, alpha: 1, add: false }, o)); }
function decal(x, y, col, n, spread) { if (!bg) return; const g = bg.c.getContext('2d'); g.globalAlpha = .5; const s = spread || 7; for (let i = 0; i < n; i++) px(g, Math.round(x + rnd(-s, s)), Math.round(y + rnd(-s / 2, s / 2)), ri(1, 2), 1, col); g.globalAlpha = 1; }
function scorch(x, y, r) { if (!bg) return; const g = bg.c.getContext('2d'); g.fillStyle = 'rgba(10,6,4,.4)'; g.beginPath(); g.ellipse(x, y, r * .7, r * .35, 0, 0, 7); g.fill(); decal(x, y, '#1a0e08', 30, r * .9); }
function banner(t, s) { const b = $('banner'); $('banTitle').textContent = t; $('banSub').textContent = s || ''; b.classList.remove('show'); void b.offsetWidth; b.classList.add('show'); }
function toast(t, col) { const b = $('toast'); b.textContent = t; b.style.color = col || ''; b.classList.toggle('low', !$('ov').hidden); b.classList.remove('show'); void b.offsetWidth; b.classList.add('show'); }
function explode(x, y, rad, dmg, src, opt) {
  opt = opt || {}; const sk = opt.sk; // sk: Aussehen des Meisterschafts-Rangs (js/mastery.js), w: Waffe des Spielers (Element)
  fxAnim('boom', x, y - Math.min(rad, 34) * .3, { sc: Math.min(2, rad / 17), dur: .55, sk });
  if (rad > 34) for (let k = 0; k < 4; k++) { const a = k / 4 * 6.283 + rnd(0, .8); fxAnim('boom', x + Math.cos(a) * rad * .55, y + Math.sin(a) * rad * .3 - 6, { sc: rnd(.9, 1.3), dur: rnd(.4, .6), sk }); }
  fx.push({ k: 'boom', x, y, r: rad, life: .45, max: .45, sk });
  rings.push({ x, y, r: 4, max: rad * 1.2, life: .35, max2: .35, col: opt.col || (sk ? sk.col : '#ffd27a') });
  for (let i = 0; i < 22; i++) { const a = rnd(0, 6.28), v = rnd(30, 140); part(x, y, rnd(2, 10), Math.cos(a) * v, Math.sin(a) * v * .6, rnd(40, 120), pick(sk ? sk.pal : ['#fff0a0', '#ffb03a', '#ff6a2a', '#e8402a']), rnd(.3, .7), Math.random() < .4 ? 2 : 1, 160, 1); }
  for (let i = 0; i < 10; i++) part(x + rnd(-8, 8), y + rnd(-4, 4), rnd(4, 14), rnd(-20, 20), rnd(-10, 10), rnd(10, 30), pick(['#3a3440', '#4a4450', '#2a2630']), rnd(.6, 1.1), 2, -6);
  shake(Math.min(10, 3 + rad / 10)); hitStop = Math.max(hitStop, .05); sfx('boom'); flash = { a: .2, c: sk ? sk.glow : '255,200,120' }; scorch(x, y, rad);
  if (dmg > 0) for (const e of enemies) { if (e.dead || e.st === 'spawn') continue; const d = Math.hypot(e.x - x, e.y - y); if (d < rad + e.r * e.sc) { const n = d || 1; let v = dmg * (src === 'e' ? .5 : 1) * (1 - d / (rad * 2.2)); if (src === 'p' && opt.w) v = hookVal('hit', v, e, opt.w, false); hurtEnemy(e, Math.round(v), (e.x - x) / n, (e.y - y) / n, 200, false, src !== 'p'); if (opt.burn && !e.dead) { e.burn = 3; e.burnDmg = Math.max(1, Math.round(dmg * .12)); } } }
  if (src !== 'p' && dmg > 0) { const d = Math.hypot(P.x - x, P.y - y); if (d < rad + P.r) hurtPlayer(dmg * (src === 'n' ? .5 : 1), { x, y }); }
  for (const o of obs) if ((o.k === 'crate' || o.k === 'xcrate') && !o.dead && Math.hypot(o.x - x, o.y - y) < rad + 6) setTimeout(() => { if (G) hitObs(o, 99, 0, 0, true); }, 80);
}

/* ---------- Beute ---------- */
function dropCoins(x, y, total, big) {
  total = Math.round(total * (1 + ((P.st && P.st.gold) || 0)));
  const n = Math.min(big ? 14 : 8, Math.max(1, Math.ceil(total / 4))); let g = total;
  for (let i = 0; i < n; i++) { const v = i === n - 1 ? g : Math.floor(total / n); g -= v; if (v > 0) pickups.push({ k: 'coin', x, y, z: 6, vz: rnd(60, big ? 140 : 100), vx: rnd(-50, 50), vy: rnd(-30, 30), v, t: rnd(0, 6) }); }
}
function dropLoot(x, y, minRar, setChance) { const it = randomItem(stageNum(), minRar, { setChance: setChance || .006 }); dropItem(x, y, it); }
function dropItem(x, y, it) { pickups.push({ k: 'loot', it, x, y, z: 8, vz: 120, vx: rnd(-30, 30), vy: rnd(-15, 15), t: 0 }); }
function dropMat(x, y, k, n) { pickups.push({ k: 'mat', m: k, n, x, y, z: 6, vz: rnd(60, 100), vx: rnd(-40, 40), vy: rnd(-25, 25), t: 0 }); }
function dropGem(x, y, gk) { pickups.push({ k: 'gem', g: gk, x, y, z: 8, vz: 110, vx: rnd(-30, 30), vy: rnd(-20, 20), t: 0 }); }
function gemMul() { const jl = hideLv('juwelier'); return (mod('my_midas') ? 2 : 1) * (jl >= 3 ? 1.5 + (jl - 3) * .1 : 1); }
function gainFate(n, show) { P.fate = (P.fate || 0) + n; if (show) { toast(n > 1 ? _t('+{n} Glücksmünzen', { n }) : _t('+{n} Glücksmünze', { n }), '#ffd24a'); sfx('coin'); } }
/* Chronikseite finden (account-weit) */
function gainLore() {
  const have = SAVE.meta.lore, free = LORE.map((_, i) => i).filter(i => !have.includes(i)); if (!free.length) return false;
  const i = free[0]; have.push(i); statMax('lore', have.length); toast(_t('Chronikseite: „{title}“', { title: LORE[i][0] }), '#b892f4'); sfx('page'); persist(); return true;
}
function loreChance() { return hideLv('bibliothek') >= 3 ? 1.6 : 1; }

/* ---------- Hindernisse ---------- */
function hitObs(o, dmg, nx, ny, boom) {
  if (o.dead) return;
  if (o.k === 'col' || o.k === 'station' || o.k === 'npc') return;
  if (o.k === 'gat') { if (typeof gatherHit === 'function') gatherHit(o, nx, ny); return; }   // Holzplatz im Versteck (js/bauen.js)
  if (o.k === 'quelle') { useFountain(o); return; }
  if (o.k === 'chest') { openChest(o); return; }
  if (o.k === 'lever') { if (o.cd > 0) return; o.on = !o.on; o.cd = 1; G.spikeRush = 4; sfx('spike'); shake(2); toast(_t('Die Fallen sind scharf!')); return; }
  if (o.k === 'vein') {
    o.hp--; o.flash = .12; sfx('mine'); for (let i = 0; i < 6; i++) part(o.x, o.y, 8, rnd(-50, 50), rnd(-30, 30), rnd(30, 80), MATS[o.mat].c, rnd(.3, .6), 1, 220, 1);
    if (o.hp <= 0) { o.dead = true; dropMat(o.x, o.y, o.mat, ri(2, 4)); if (Math.random() < .5) dropMat(o.x, o.y, 'erz', ri(1, 2)); if (Math.random() < .08) dropGem(o.x, o.y, randomGem(stageNum())); burst(o.x, o.y, 6, '#6a5e52', 12, 60); }
    return;
  }
  if (o.k === 'xcrate' && !boom && (nx || ny) && !o.kicked) { o.kicked = true; o.vx = nx * 230; o.vy = ny * 230; o.kickT = 1.2; sfx('wood'); return; }
  o.hp -= dmg; o.flash = .1;
  if (o.hp <= 0) {
    o.dead = true; sfx('wood');
    for (let i = 0; i < 10; i++) part(o.x, o.y, 8, rnd(-70, 70), rnd(-40, 40), rnd(40, 100), pick(['#8a4a2a', '#b8642e', '#5a2e18']), rnd(.4, .8), Math.random() < .4 ? 2 : 1);
    if (o.k === 'xcrate') explode(o.x, o.y, 36, 30 + stageNum() * 6, o.kicked ? 'p' : 'n');
    else { if (Math.random() < .55) dropCoins(o.x, o.y, ri(2, 5) + stageNum()); if (Math.random() < .25) dropMat(o.x, o.y, pick(['erz', 'leder']), 1); if (Math.random() < .3) dropMat(o.x, o.y, 'holz', ri(1, 2)); if (Math.random() < .06) pickups.push({ k: 'flask', x: o.x, y: o.y, z: 6, vz: 80, vx: rnd(-20, 20), vy: rnd(-10, 10), t: 0 }); }
  }
}
function openChest(o) {
  if (o.open) return; o.open = .001;
  if (o.mimic) { o.dead = true; spawnEnemy(o.gold ? 'goldmimik' : 'mimic', { x: o.x, y: o.y, instant: true, elite: Math.random() < .3 }); toast(o.gold ? _t('Eine Goldmimik!') : _t('Ein Mimik!'), '#ff6a5a'); shake(4); sfx('lunge'); return; }
  sfx('chest');
  setTimeout(() => { if (!G) return; const st = stageNum(), mats = MONMATS.slice(0, Math.min(MONMATS.length, 6 + Math.floor(st / 8))); dropCoins(o.x, o.y, (10 + st * 5) * (o.gold ? 2.5 : 1), true); if (Math.random() < (o.gold ? 1 : .55) * G.lootMul) dropLoot(o.x, o.y, o.gold ? 2 : 1); if (Math.random() < .25 * gemMul()) dropGem(o.x, o.y, randomGem(st)); dropMat(o.x, o.y, pick(mats), ri(1, 3)); if (Math.random() < .25) pickups.push({ k: 'flask', x: o.x, y: o.y, z: 8, vz: 90, vx: rnd(-30, 30), vy: rnd(-10, 20), t: 0 }); if (Math.random() < .04 * loreChance()) gainLore(); if (Math.random() < (o.gold ? .1 : .02) * (1 + weekFx('fate'))) gainFate(1, true); }, 250);
}
function useFountain(o) {
  if (o.used) return; o.used = true; const h = Math.round(P.st.hp * .35); P.hp = Math.min(P.st.hp, P.hp + h);
  txt(P.x, P.y - 24, '+' + h, '#79c24e', true); sfx('heal'); toast(_t('Heilquelle: +{n} LP', { n: h }), '#79c24e'); rings.push({ x: o.x, y: o.y, r: 4, max: 34, life: .5, max2: .5, col: '#8ecbff' });
  for (let i = 0; i < 16; i++) part(P.x + rnd(-6, 6), P.y, rnd(0, 14), 0, 0, rnd(20, 40), '#8ecbff', rnd(.5, .9), 1, -10, 1);
}
function solidPush(e, r) { for (const o of obs) { if (!o.solid || o.dead) continue; const dx = e.x - o.x, dy = e.y - o.y, d = Math.hypot(dx, dy) || .01, m = o.r + r; if (d < m) { e.x = o.x + dx / d * m; e.y = o.y + dy / d * m; if (e === P && o.k === 'chest' && !o.open) openChest(o); if (e === P && o.k === 'quelle' && !o.used) useFountain(o); } } }
function updObs(dt) {
  for (const o of obs) {
    if (o.flash > 0) o.flash -= dt; if (o.cd > 0) o.cd -= dt;
    if (o.open > 0 && o.open < 1) o.open = Math.min(1, o.open + dt * 5);
    if (o.kicked && !o.dead) {
      o.x += o.vx * dt; o.y += o.vy * dt; o.kickT -= dt; if (Math.random() < .6) dust(o.x, o.y, 1);
      const hitE = enemies.find(e => e.st !== 'spawn' && Math.hypot(e.x - o.x, e.y - o.y) < e.r * e.sc + 7);
      const hitWall = o.x < BD.x0 || o.x > BD.x1 || o.y < BD.y0 || o.y > BD.y1 || obs.some(q => q !== o && q.solid && !q.dead && q.k === 'col' && Math.hypot(q.x - o.x, q.y - o.y) < q.r + 6);
      if (hitE || hitWall || o.kickT <= 0) { o.dead = true; explode(o.x, o.y, 40, (30 + stageNum() * 6) * 1.5, 'p'); }
    }
  }
  obs = obs.filter(o => !o.dead);
}

/* ---------- Spieler ---------- */
// mouse.in: Zeiger im Fenster · mouse.aim: die Maus zielt (zuletzt bewegt/geklickt; J/Leertaste schaltet zurück aufs automatische Zielen)
const keys = {}, mouse = { x: 0, y: 0, down: false, in: false, aim: false };
const stick = { id: null, ox: 0, oy: 0, x: 0, y: 0 };
let touchAtk = false;
// Mauszeiger in Weltkoordinaten (Ränder bei Ultrabreit und der Kamera-Rest unter einem Spielpixel eingerechnet)
function mouseWorld() { return { x: CX + ((mouse.x - VIEW.ox) * DPR + VIEW.sx) / PXS, y: CY + (mouse.y * DPR + VIEW.sy) / PXS }; }
// Winkel vom Helden zum Mauszeiger – nur wenn gerade mit der Maus gespielt wird, sonst null
function mouseAimAng() { if (isTouch || !mouse.aim || !mouse.in) return null; const m = mouseWorld(); return Math.atan2(m.y - (P.y - 6), m.x - P.x); }
function readInput() {
  let mx = 0, my = 0;
  if (keys.KeyA || keys.ArrowLeft) mx -= 1; if (keys.KeyD || keys.ArrowRight) mx += 1;
  if (keys.KeyW || keys.ArrowUp) my -= 1; if (keys.KeyS || keys.ArrowDown) my += 1;
  if (stick.id !== null) { mx += stick.x; my += stick.y; }
  const l = Math.hypot(mx, my); if (l > 1) { mx /= l; my /= l; }
  return { mx, my, attack: !!(keys.KeyJ || keys.Space || mouse.down || touchAtk) };
}
function nearestEnemy(range, from) {
  from = from || P; let t = null, b = range;
  for (const e of enemies) { if (e.st === 'spawn' || e.dead || e.under > 0 || e.fade > .6) continue; const d = Math.hypot(e.x - from.x, e.y - from.y); if (d < b) { b = d; t = e; } }
  return t;
}
// Ziel für Ketten-Fähigkeiten: mit der Maus der Gegner, der dem Zeiger am nächsten ist (in Reichweite des Helden), sonst der nächste
function aimTarget(range) {
  if (mouseAimAng() == null) return nearestEnemy(range);
  const m = mouseWorld(); let t = null, b = Infinity;
  for (const e of enemies) { if (e.st === 'spawn' || e.dead || e.under > 0 || e.fade > .6 || Math.hypot(e.x - P.x, e.y - P.y) > range) continue; const d = Math.hypot(e.x - m.x, e.y - m.y); if (d < b) { b = d; t = e; } }
  return t;
}
function autoAim(range, inp) {
  if (P.manAim != null) return P.manAim;
  const ma = mouseAimAng(); if (ma != null) return ma;   // PC: Angriffe und Fähigkeiten folgen dem Mauszeiger
  const t = nearestEnemy(range); if (t) return Math.atan2(t.y - P.y, t.x - P.x);
  if (inp && Math.hypot(inp.mx, inp.my) > .15) return Math.atan2(inp.my, inp.mx);
  return P.face > 0 ? 0 : Math.PI;
}
function busy() { return P.spin > 0 || P.leap || P.dash; }
function playerW() {
  const st = P.st, w = P.gear.weapon, W = WT[w.base];
  return { type: w.base, tier: w.tier, dmg: st.wbase * st.dmgMul, crit: st.crit, critdmg: st.critdmg, kb: st.kb || W.kb, range: st.range || W.range, arc: W.arc, leech: st.leech, burn: (st.m.burnW || 0) + (st.m.burn || 0), frost: st.m.frostW || 0, poison: P.poisonT > 0, col: weaponGlow(w) };
}
function startAttack(inp) {
  const w = playerW(), W = WT[w.type], ranged = !!W.ranged;
  P.combo = P.comboT > 0 ? (P.combo + 1) % 3 : 0;
  P.aim = autoAim(ranged ? 210 : w.range + 42, inp);
  P.face = Math.cos(P.aim) >= 0 ? 1 : -1;
  const fin = P.combo === 2;
  P.atkDur = P.st.cd * (fin ? 1.05 : .85); P.atkT = P.atkDur; P.atkCd = P.st.cd * (fin ? 1.25 : 1); P.hitSet = new Set(); P.struck = false;
  if (!ranged) {
    const dash = fin ? 130 : 55; P.vx += Math.cos(P.aim) * dash; P.vy += Math.sin(P.aim) * dash; sfx(fin ? 'swing2' : 'swing');
    const sc = w.type === 'axe' ? .75 : w.type === 'dagger' ? .45 : .6;
    fx.push({ k: 'slash', x: P.x, y: P.y - 8, ang: P.aim, flip: P.combo === 1, sc: sc * (fin ? 1.25 : 1) * (1 + (w.range - WT[w.type].range) / 30), life: .22, max: .22, col: TINT[w.tier] || '#e8eef8', follow: true });
  }
  P.squash = fin ? -.18 : -.1;
}
function doRoll() {
  if (state !== 'play' || P.roll > 0 || P.rollCd > 0 || busy()) return;
  // in Laufrichtung; im Stand mit der Maus zum Zeiger, sonst nach vorn
  const inp = readInput(); let dx = inp.mx, dy = inp.my; const l = Math.hypot(dx, dy), ma = l < .15 ? mouseAimAng() : null;
  if (ma != null) { dx = Math.cos(ma); dy = Math.sin(ma); } else if (l < .15) { dx = P.face; dy = 0; } else { dx /= l; dy /= l; }
  P.rdx = dx; P.rdy = dy; P.roll = .32; P.rollCd = .7; P.atkT = 0; if (Math.abs(dx) > .2) P.face = dx > 0 ? 1 : -1;
  P.rollT = T; sfx('roll'); dust(P.x, P.y, 4);
}
// auto = automatisch bei wenig LP; Schutz: kurz nach einer Rolle wird kein Trank getrunken (verrutschter Daumen)
function drinkPotion(auto) {
  if (state !== 'play' || (G && G.type === 'versteck')) return;
  if (!auto && P.rollT && T - P.rollT < .4) return;
  if (P.potions <= 0) { if (!auto) { toast(_t('Keine Tränke – im Alchemielabor brauen oder beim Händler kaufen')); sfx('deny'); } return; }
  if (P.potCd > 0) { if (!auto) toast(_t('Trank noch nicht bereit')); return; }
  if (P.hp >= P.st.hp) { if (!auto) toast(_t('Lebenspunkte sind voll')); return; }
  P.potions--; P.potCd = 6; const h = Math.round(P.st.hp * potHeal()); P.hp = Math.min(P.st.hp, P.hp + h);
  txt(P.x, P.y - 22, '+' + h, '#79c24e', true); sfx('heal'); if (auto) toast(_t('Auto-Trank: +{n} LP', { n: h }), '#79c24e');
  for (let i = 0; i < 16; i++) part(P.x + rnd(-6, 6), P.y, rnd(0, 14), 0, 0, rnd(20, 40), '#79c24e', rnd(.5, .9), 1, -10, 1);
}
function weaponHit(e, w, mul, nx, ny, kbMul, forceCrit) {
  let crit = forceCrit || Math.random() < w.crit;
  let m = mul;
  if (P.stealth > 0) { m *= (2 + mod('stealth')) * (1 + mod('r3Dmg')); crit = true; P.stealth = 0; burst(P.x, P.y, 8, '#3a3448', 12, 50); }
  const dmg = Math.round(hookVal('hit', w.dmg * m * rnd(.9, 1.1) * (crit ? w.critdmg : 1), e, w, crit));
  hurtEnemy(e, dmg, nx, ny, w.kb * (kbMul || 1), crit, !!w.pet); // Begleiter-Treffer füllen weder Wut noch Kombo
  hook('afterHit', e, w, dmg, crit);
  if (w.leech && state === 'play') P.hp = Math.min(P.st.hp, P.hp + dmg * w.leech);
  if (crit && mod('my_fireburst') && (P.fbT || 0) < T) { P.fbT = T + .35; const x = e.x, y = e.y; explode(x, y, 26, w.dmg * .9, 'p', { burn: true, w }); }
  if (mod('my_chain') && Math.random() < .2 && !w.chained) mythChain(e, w);
  if (e.dead) { if (mod('r1Reset')) P.cds[0] = 0; return; }
  if (w.burn && Math.random() < w.burn) { e.burn = 3; e.burnDmg = Math.max(1, Math.round(w.dmg * .25)); }
  if (w.frost && Math.random() < w.frost) e.chill = 2;
  if (w.poison) { e.poison = 4; e.poisonDmg = Math.max(1, Math.round(w.dmg * .3 * (1 + mod('poison')))); }
}
/* Mythisch „Klinge von Klingenhort“: Kettenblitz auf bis zu drei Nachbarn */
function mythChain(e, w) {
  let from = e, hit = new Set([e]), pts = [[e.x, e.y - 8]];
  for (let k = 0; k < 3; k++) {
    let nt = null, b = 70; for (const o of enemies) { if (hit.has(o) || o.dead || o.st === 'spawn') continue; const d = Math.hypot(o.x - from.x, o.y - from.y); if (d < b) { b = d; nt = o; } }
    if (!nt) break; hit.add(nt); pts.push([nt.x, nt.y - 8 * nt.sc]); hurtEnemy(nt, Math.round(w.dmg * .6), 0, 0, 20, false, true); from = nt;
  }
  if (pts.length > 1) { fx.push({ k: 'zap', pts, life: .22, max: .22 }); sfx('zap'); }
}
function meleeSweep(w, fin) {
  const range = w.range + (fin ? 6 : 0), arc = w.arc * (fin ? 1.25 : 1), mul = fin ? 1.7 * (1 + mod('fin')) : 1;
  for (const e of enemies) {
    if (e.st === 'spawn' || P.hitSet.has(e)) continue;
    const ex = e.x - P.x, ey = e.y - P.y, d = Math.hypot(ex, ey), er = e.r * e.sc;
    if (d > range + er) continue;
    if (Math.abs(angDiff(Math.atan2(ey, ex), P.aim)) > arc / 2 + .4 && d > er + 5) continue;
    P.hitSet.add(e); const n = d || 1;
    weaponHit(e, w, mul, ex / n, ey / n, fin ? 1.8 : 1);
  }
  for (const o of obs) { if (o.dead || o.k === 'col' || P.hitSet.has(o)) continue; const ex = o.x - P.x, ey = o.y - P.y, d = Math.hypot(ex, ey); if (d < range + o.r && (Math.abs(angDiff(Math.atan2(ey, ex), P.aim)) < arc / 2 + .4 || d < o.r + 6)) { P.hitSet.add(o); hitObs(o, 1, ex / (d || 1), ey / (d || 1)); } }
  if (typeof gatherSweep === 'function') gatherSweep(range, arc);   // Bäume, Felsen, Büsche in den Landen (js/bauen.js)
  for (const p of projs) {
    if (p.from !== 'e' || p.k === 'fire' || p.k === 'bomb' || p.life <= 0) continue;
    const ex = p.x - P.x, ey = p.y - P.y, d = Math.hypot(ex, ey);
    if (d < range + 6 && Math.abs(angDiff(Math.atan2(ey, ex), P.aim)) < arc / 2 + .4) { p.life = 0; burst(p.x, p.y, p.h, '#d8b8ff', 6, 50, 1); spark(p.x, p.y - p.h, 0, '#d8b8ff'); sfx('deflect'); }
  }
}
function fireProj(o) {
  const sp = o.sp || 260, c = Math.cos(o.ang), s = Math.sin(o.ang);
  projs.push(Object.assign({ x: (o.x != null ? o.x : P.x) + c * 6, y: (o.y != null ? o.y : P.y) + s * 6, h: 8, vx: c * sp, vy: s * sp, life: .85, max: .85, from: 'p', r: 3, pierce: false, hit: new Set(), mul: 1 }, o));
}
function primaryRanged(w, fin) {
  if (w.type === 'bow') {
    const pierce = w.tier >= 3 || !!mod('pierce');
    if (fin) for (let i = -1; i <= 1; i++) fireProj({ k: 'arrow', ang: P.aim + i * .18, w, mul: 1.2, pierce });
    else fireProj({ k: 'arrow', ang: P.aim, w, mul: 1, pierce });
    sfx('bow');
  } else {
    const fxn = WT.staff.proj[w.tier];
    if (fin) for (let i = -1; i <= 1; i++) fireProj({ k: 'bolt', fxn, ang: P.aim + i * .2, w, mul: 1.1, sp: 220, life: .9, r: 4 });
    else fireProj({ k: 'bolt', fxn, ang: P.aim, w, mul: 1, sp: 220, life: .9, r: 4 });
    sfx('zapbolt');
  }
}

/* ---------- Fähigkeiten ---------- */
// mastCd/mastCost: Meisterschaft der Fähigkeit (js/mastery.js)
function skillCd(i) { const id = CLASSES[P.cls].skills[i], S = SKILLS[id]; let cd = S.cd * (1 - P.st.cdr) * (mod('my_echo') ? .8 : 1) * mastCd(id); if (id === 'k2' && mod('k2Cdr')) cd *= 1 - mod('k2Cdr'); return cd; }
function skillCost(i) { const id = CLASSES[P.cls].skills[i]; return Math.round(SKILLS[id].cost * (mod('my_echo') ? .7 : 1) * mastCost(id)); }
function useSkill(i) {
  if (state !== 'play' || busy() || P.roll > 0) return;
  const id = CLASSES[P.cls].skills[i], S = SKILLS[id], cost = skillCost(i);
  if (P.cds[i] > 0) { sfx('deny'); return; }
  if (P.res < cost) { toast(_t('{res} reicht nicht', { res: CLASSES[P.cls].res.name })); sfx('deny'); return; }
  if (id === 'a2' && traps.length >= 2 + mod('a2Max')) { toast(_t('Maximale Anzahl Fallen gelegt')); return; }
  const inp = readInput(), w = playerW();
  // ab hier gilt der Einsatz: Meisterschaft setzt Schaden und Aussehen (w.sk), w trägt beides zu allen Treffern
  hook('skill', id, w); const sk = w.sk;
  P.res -= cost; P.cds[i] = skillCd(i); P.atkT = 0; buzz(8);
  txt(P.x, P.y - 30, S.n, sk ? sk.col : '#efe2bf');
  switch (id) {
    case 'k1': { const a = autoAim(140, inp); P.aim = a; P.face = Math.cos(a) >= 0 ? 1 : -1; P.dash = { t: 0, dur: .22 * (1 + mod('k1Wide') * .2), dx: Math.cos(a), dy: Math.sin(a), hit: new Set(), kind: 'charge', sp: 470, w, sk, wide: mod('k1Wide') * 6 }; sfx('lunge'); break; }
    case 'k2': P.spin = 1.0 + mod('k2Dur'); P.spinTick = 0; P.spinW = w; P.spinSk = sk; sfx('swing2'); break;
    case 'k3': {
      P.wall = 3 + mod('k3Dur'); P.wallW = w; P.wallSk = sk; sfx('shield'); rings.push({ x: P.x, y: P.y, r: 4, max: 30, life: .3, max2: .3, col: sk ? sk.col : '#8ecbff' });
      if (mod('k3Heal')) { const h = Math.round(P.st.hp * mod('k3Heal')); P.hp = Math.min(P.st.hp, P.hp + h); txt(P.x, P.y - 22, '+' + h, '#79c24e'); }
      if (mod('k3Push')) { rings.push({ x: P.x, y: P.y, r: 4, max: 56, life: .35, max2: .35, col: sk ? sk.col2 : '#bfefff' }); for (const e of enemies) { if (e.st === 'spawn' || e.dead) continue; const dx = e.x - P.x, dy = e.y - P.y, d = Math.hypot(dx, dy) || 1; if (d < 50 + e.r * e.sc) weaponHit(e, w, .5, dx / d, dy / d, 3); } }
      break;
    }
    case 'm1': { const a = autoAim(220, inp), n = 1 + mod('m1Twin'); P.aim = a; P.face = Math.cos(a) >= 0 ? 1 : -1; for (let k = 0; k < n; k++) fireProj({ k: 'fireball', fxn: 'fireball', ang: a + (k - (n - 1) / 2) * .16, w, mul: 1.8 * (1 + mod('m1Dmg')), sp: 190, life: 1.1, r: 5, split: !!mod('m1Split') }); sfx('fire'); break; }
    case 'm2': {
      const R = 72 * (1 + mod('m2Rad')); fxAnim('ring', P.x, P.y - 4, { sc: R / 22, dur: .5, add: true, sk }); sfx('frost');
      for (let k = 0; k < 14; k++) { const a = k / 14 * 6.283; fx.push({ k: 'shard', x: P.x, y: P.y, ang: a, life: .4, max: .4, d: R * .97, sk }); }
      for (const e of enemies) { if (e.st === 'spawn') continue; const d = Math.hypot(e.x - P.x, e.y - P.y); if (d < R + e.r * e.sc) { weaponHit(e, w, 1.2 * (1 + mod('m2Dmg')), (e.x - P.x) / (d || 1), (e.y - P.y) / (d || 1), .5); if (!e.dead && !e.boss) e.freeze = 1.6 + mod('m2Freeze'); else if (!e.dead) e.chill = 2.5; } }
      if (mod('m2Armor')) P.msFrost = T + 3;
      break;
    }
    case 'm3': {
      let from = { x: P.x, y: P.y - 8 }, t = aimTarget(170), mul = 1.4, hit = new Set(), pts = [[P.x, P.y - 10]];
      const n = 3 + mod('m3Chain'), jump = 80 * (1 + mod('m3Range')), keep = .85 + mod('m3Decay');
      for (let k = 0; k <= n && t; k++) {
        hit.add(t); pts.push([t.x, t.y - 8 * t.sc]); fxAnim('bolt', t.x, t.y - 18, { dur: .4, add: true, sk, sc: sk ? sk.sc : 1 });
        weaponHit(t, w, mul, (t.x - from.x) / 50, (t.y - from.y) / 50, .4); if (mod('m3Stun') && !t.dead && !t.boss) t.stun = Math.max(t.stun, mod('m3Stun')); mul *= keep; from = t;
        let nt = null, b = jump; for (const e of enemies) { if (hit.has(e) || e.st === 'spawn' || e.dead) continue; const d = Math.hypot(e.x - from.x, e.y - from.y); if (d < b) { b = d; nt = e; } } t = nt;
      }
      if (pts.length > 1) fx.push({ k: 'zap', pts, life: .28, max: .28, sk }); else toast(_t('Kein Ziel in Reichweite'));
      sfx('zap'); break;
    }
    case 'r1': { const a = autoAim(160, inp); P.aim = a; P.face = Math.cos(a) >= 0 ? 1 : -1; P.dash = { t: 0, dur: .2 * (1 + mod('r1Far')), dx: Math.cos(a), dy: Math.sin(a), hit: new Set(), kind: 'shadow', sp: 560, w, sk, wide: mod('r1Wide') * 6 }; sfx('lunge'); break; }
    case 'r2': {
      P.poisonT = 6; const a = autoAim(160, inp), n = 5 + mod('r2Knives'), pw = Object.assign({}, w, { poison: true }), mul = .7 * (1 + mod('r2Dmg')), pierce = !!mod('r2Pierce');
      for (let k = 0; k < n; k++) fireProj({ k: 'knife', ang: a + (k - (n - 1) / 2) * .16, w: pw, mul, sp: 280, life: .6, pierce });
      if (mod('r2Ring')) for (let k = 0; k < 8; k++) fireProj({ k: 'knife', ang: a + k / 8 * 6.283 + .39, w: pw, mul: mul * .7, sp: 240, life: .45, pierce });
      sfx('poison'); break;
    }
    case 'r3': {
      P.stealth = 3 + mod('stealth') / .3 * .5 + mod('r3Dur'); P.stealthSk = sk; sfx('smoke');
      for (let k = 0; k < 30; k++) part(P.x + rnd(-14, 14), P.y + rnd(-8, 8), rnd(0, 14), rnd(-20, 20), rnd(-10, 10), rnd(5, 20), pick(sk ? [sk.pal[2], sk.pal[3], '#3a3448'] : ['#4a4458', '#5a5468', '#3a3448']), rnd(.8, 1.4), 3, -4);
      if (mod('r3Blind')) for (const e of enemies) if (!e.dead && !e.boss && e.st !== 'spawn' && Math.hypot(e.x - P.x, e.y - P.y) < 56) e.stun = Math.max(e.stun, mod('r3Blind'));
      if (mod('r3Heal')) { const h = Math.round(P.st.hp * mod('r3Heal')); P.hp = Math.min(P.st.hp, P.hp + h); txt(P.x, P.y - 22, '+' + h, '#79c24e'); }
      break;
    }
    case 'a1': {
      const a = autoAim(210, inp), n = 7 + mod('a1Count'), pierce = !!mod('pierce') || !!mod('a1Pierce'), mul = .9 * (1 + mod('a1Dmg'));
      const fan = m => { for (let k = 0; k < n; k++) fireProj({ k: 'arrow', ang: a + (k - (n - 1) / 2) * .12, w, mul: m, pierce }); };
      fan(mul); sfx('bow'); shake(1.5);
      if (mod('a1Twice')) setTimeout(() => { if (G && state === 'play') { fan(mul * .5); sfx('bow'); } }, 250);
      break;
    }
    case 'a2': traps.push({ x: P.x, y: P.y + 2, armT: .5, life: 30, w, sk }); sfx('fuse'); break;
    case 'a3': { const n = 1 + mod('a3Count'); for (let k = 0; k < n; k++) allies.push({ k: 'spirit', x: P.x, y: P.y, z: 14, ang: k / n * 6.283, life: 15 + mod('a3Dur'), shotT: .4, healT: 3, seed: rnd(0, 9), w, sk }); sfx('heal'); break; }
  }
}
function doUlt() {
  if (state !== 'play' || busy() || P.roll > 0) return;
  if (P.rage < 100) { toast(_t('Wut noch nicht voll – triff Gegner!')); sfx('deny'); return; }
  P.rage = 0; P.atkT = 0; sfx('spec'); flash = { a: .2, c: '255,220,140' };
  const inp = readInput(), w = playerW(), id = CLASSES[P.cls].ult;
  hook('skill', id, w);
  txt(P.x, P.y - 34, SKILLS[id].n.toLocaleUpperCase(LOCALE) + '!', '#ffd24a', true);
  if (id === 'ku') { const a = autoAim(160, inp), t = mouseAimAng() != null ? mouseWorld() : nearestEnemy(999), d = Math.min(70, t ? dist(t, P) : 70); P.leap = { t: 0, dur: .5, sx: P.x, sy: P.y, tx: clamp(P.x + Math.cos(a) * d, BD.x0, BD.x1), ty: clamp(P.y + Math.sin(a) * d, BD.y0, BD.y1), w, sk: w.sk }; P.face = Math.cos(a) >= 0 ? 1 : -1; }
  else if (id === 'mu') { const n = 10 + mod('uCount'); for (let k = 0; k < n; k++) { const t = enemies.length ? pick(enemies) : null; const x = clamp((t ? t.x : P.x) + rnd(-30, 30), BD.x0, BD.x1), y = clamp((t ? t.y : P.y) + rnd(-20, 20), BD.y0, BD.y1); projs.push({ k: 'meteor', fxn: 'firebomb', x, y, tx: x, ty: y, h: 140, vx: 0, vy: 0, life: 9, max: 9, delay: k * .13, from: 'p', r: 0, w, hit: new Set() }); } }
  else if (id === 'ru') { const n = 3 + mod('uCount'); for (let k = 0; k < n; k++) { const a = k / n * 6.283; allies.push({ k: 'clone', x: P.x + Math.cos(a) * 16, y: P.y + Math.sin(a) * 10, life: 7 + mod('ruDur'), atkT: 0, phase: 0, face: 1, seed: rnd(0, 9), w, sk: w.sk }); burst(P.x + Math.cos(a) * 16, P.y + Math.sin(a) * 10, 8, w.sk ? w.sk.col : '#3a3448', 10, 40); } }
  else if (id === 'au') { P.volley = 3 + mod('uDur'); P.volleyT = 0; P.volleyW = w; P.aim = autoAim(220, inp); P.face = Math.cos(P.aim) >= 0 ? 1 : -1; }
}
function hurtEnemy(e, dmg, nx, ny, kb, crit, noRage) {
  if (e.dead) return;
  if (e.under > 0 || e.fade > .6) { if (e.fade > .6) txt(e.x, e.y - 14, _t('VERFEHLT'), '#bfefff'); return; }
  if (e.ai === 'dummy') { e.flash = .1; e.squash = .25; e.kbx = nx; e.dmgLog.push([T, dmg]); txt(e.x + rnd(-3, 3), e.y - 30, String(Math.round(dmg)), crit ? '#ffd24a' : '#ffffff', crit); sfx(crit ? 'crit' : 'hit'); spark(e.x, e.y - 16, Math.atan2(ny, nx), crit ? '#ffd24a' : '#fff'); if (!noRage) { P.rage = Math.min(100, P.rage + 4); const R = CLASSES[P.cls].res; if (R.onHit) P.res = Math.min(P.st.resMax, P.res + R.onHit); } return; }
  if (e.armor > 0) { const a = Math.min(e.armor, dmg * .7); e.armor -= a; dmg -= a; e.armorT = 4; if (e.armor <= 0) { burst(e.x, e.y, 10, '#c8c8d8', 14, 60); toast(_t('Panzer gebrochen!')); } }
  dmg = Math.round(dmg);
  e.hp -= dmg; e.flash = .1; e.squash = .18;
  if (e.ai === 'ghost' && !(e.hide > 0) && e.hp > 0 && Math.random() < .35) e.hide = 1.1;
  const m = e.mass || 1; e.kbx = nx * kb / m; e.kby = ny * kb / m;
  if (!e.boss && m < 2 && kb > 0) { e.stun = Math.max(e.stun, .16); if (e.st === 'wind') { e.st = 'move'; e.cd = .45; } }
  hitStop = Math.max(hitStop, crit ? .06 : .03); shake(crit ? 3 : 1.4);
  txt(e.x + rnd(-3, 3), e.y - 16 * e.sc - e.z, String(dmg), crit ? '#ffd24a' : '#ffffff', crit);
  const bc = e.def.blood || '#b8302a';
  for (let i = 0; i < (crit ? 12 : 6); i++) part(e.x, e.y, 8 * e.sc + e.z, nx * rnd(20, 90) + rnd(-20, 20), ny * rnd(10, 40) + rnd(-10, 10), rnd(20, 80), bc, rnd(.3, .6), Math.random() < .3 ? 2 : 1);
  spark(e.x - nx * 3, e.y - 8 * e.sc - e.z, Math.atan2(ny, nx), crit ? '#ffd24a' : '#ffffff');
  sfx(crit ? 'crit' : 'hit');
  if (e.ai === 'flee' && e.gold > 0) { const g = Math.max(1, Math.round(e.gold * .08)); e.gold -= g; dropCoins(e.x, e.y, g); }
  if (!noRage && state === 'play') { P.rage = Math.min(100, P.rage + (crit ? 6 : 4) * (1 + P.st.rage)); P.chain++; P.chainT = 2.2; statMax('maxCombo', P.chain); comboUI(); const R = CLASSES[P.cls].res; if (R.onHit) P.res = Math.min(P.st.resMax, P.res + R.onHit); }
  if (e.hp <= 0) killEnemy(e, nx, ny);
}
function killEnemy(e, nx, ny) {
  e.dead = true; G.kills++;
  P.stats.kills++; stat('kills'); stat('k_' + e.t); if (!SAVE.meta.bestiary[e.t]) statMax('bestiary', Object.keys(SAVE.meta.bestiary).length + 1); SAVE.meta.bestiary[e.t] = (SAVE.meta.bestiary[e.t] || 0) + 1;
  gainXP(e.xp, e);
  hook('kill', e);
  const lm = G.lootMul * (1 + mod('loot')), qm = qualOf(P.act);
  dropCoins(e.x, e.y, e.gold * (1 + mod('loot')), e.boss);
  if (Math.random() < .06) pickups.push({ k: 'heart', x: e.x, y: e.y, z: 6, vz: 70, vx: rnd(-20, 20), vy: rnd(-10, 10), t: 0 });
  for (const k in (e.def.drop || {})) { const v = e.def.drop[k]; if (v >= 1) dropMat(e.x, e.y, k, Math.round(v * (e.boss ? 1 : 1))); else if (Math.random() < v * lm * (e.elite ? 2 : 1)) dropMat(e.x, e.y, k, e.elite ? 2 : 1); }
  if (qm && Math.random() < .03 * lm * (e.elite ? 3 : 1)) dropMat(e.x, e.y, 'aether', 1);
  if (weekFx('dragon') && !e.boss && Math.random() < (e.elite ? .12 : .03) * lm) dropMat(e.x, e.y, 'schuppe', 1);
  if (e.boss) { dropLoot(e.x, e.y, 2, .06); dropLoot(e.x + 10, e.y, 1, .03); if (qm) dropLoot(e.x - 10, e.y, 3, .04); dropGem(e.x, e.y, randomGem(stageNum() + 10)); dropMat(e.x, e.y, 'schuppe', ri(1, 3)); if (qm && Math.random() < .004 + qm * .001) dropItem(e.x, e.y, makeMythic()); /* seltener: Mythisch kommt vor allem aus den Verlorenen Landen */ if (!gainLore()) gainFate(1, true); }
  else if (e.elite) { if (Math.random() < .25 * lm) dropLoot(e.x, e.y, 1, .01); if (Math.random() < .14 * lm * gemMul()) dropGem(e.x, e.y, randomGem(stageNum())); if (Math.random() < .03 * loreChance()) gainLore(); if (Math.random() < .02 * (1 + weekFx('fate'))) gainFate(1, true); }
  else if (Math.random() < .02 * lm) dropLoot(e.x, e.y, 0);
  if (e.champ) { $('bossbar').hidden = true; banner(_t('CHAMPION BESIEGT'), e.name); slowmo = .6; }
  if (e.t === 'mimic' || e.t === 'goldmimik') dropLoot(e.x, e.y, e.t === 'goldmimik' ? 2 : 1, .02);
  if (e.def.boomDeath) { const x = e.x, y = e.y, dmg = e.atk * 1.2; fx.push({ k: 'warn', x, y, r: 26, life: .5, max: .5 }); setTimeout(() => { if (G && state === 'play') explode(x, y, 26, dmg, 'e'); }, 500); }
  if (mod('my_soul')) { P.hp = Math.min(P.st.hp, P.hp + P.st.hp * .04); P.res = Math.min(P.st.resMax, P.res + 10); }
  if (e.t === 'goldgob') { dropCoins(e.x, e.y, e.gold + 80 * stageNum(), true); dropGem(e.x, e.y, randomGem(stageNum() + 5)); dropLoot(e.x, e.y, 2); toast(_t('Schatzgoblin erwischt!'), '#e8d04a'); }
  P.rage = Math.min(100, P.rage + 8 * (1 + P.st.rage));
  const [fx0, fy0, fw, fh] = frameRect(e.sp, 'idle', 0);
  corpses.push({ sp: e.sp, fr: [fx0, fy0, fw, fh], x: e.x, y: e.y, z: e.z, vz: e.boss ? 60 : 110, vx: (nx || 0) * 80, vy: (ny || 0) * 40, rot: 0, vr: (nx || 1) * rnd(6, 12), turn: e.turn, sc: e.sc, life: e.boss ? 1.4 : .55, max: e.boss ? 1.4 : .55, blood: e.def.blood, boss: e.boss, tint: e.tint });
  decal(e.x, e.y, e.def.blood || '#6a1a18', e.boss ? 40 : 10);
  sfx('die'); shake(e.boss ? 10 : 2);
  if (e.def.split) for (let i = 0; i < 2; i++) spawnEnemy('minislime', { x: e.x + rnd(-6, 6), y: e.y + rnd(-4, 4), instant: true });
  if (e.affixes.includes('explosiv')) { const x = e.x, y = e.y, dmg = e.atk * 1.6; fx.push({ k: 'warn', x, y, r: 32, life: .8, max: .8 }); setTimeout(() => { if (G && state === 'play') explode(x, y, 32, dmg, 'e'); }, 800); }
  if (e.poison > 0 && mod('plague')) for (const o of enemies) if (!o.dead && o !== e && Math.hypot(o.x - e.x, o.y - e.y) < 50) { o.poison = 4; o.poisonDmg = e.poisonDmg; }
  hook('loot', e, lm);
  if (e.boss) { banner(_t('BOSS BESIEGT'), e.name); $('bossbar').hidden = true; hitStop = .2; slowmo = 1.2; flash = { a: .6, c: '255,255,255' }; setTimeout(() => { if (G && state === 'play') explode(e.x, e.y, 40, 0, 'p'); }, 350); }
}
function gainXP(v, e) {
  v = Math.round(v * (1 + mod('xp'))); if (e) txt(e.x, e.y - 24 * e.sc, _t('+{n} EP', { n: v }), '#57a7d6');
  if (P.lv >= 50) { P.pxp += v; while (P.pxp >= PARAGON_XP) { P.pxp -= PARAGON_XP; P.paragon++; statMax('maxPar', P.paragon); banner(_t('PARAGON {n}', { n: P.paragon }), _t('+1 Paragonpunkt')); sfx('lvl'); } return; }
  P.xp += v;
  while (P.xp >= xpNext(P.lv) && P.lv < 50) {
    P.xp -= xpNext(P.lv); P.lv++; P.sp++; computeStats(); P.hp = P.st.hp; P.res = P.st.resMax;
    statMax('maxLv', P.lv); if (P.hc) statMax('hcLv', P.lv);
    banner(_t('LEVEL {lv}', { lv: P.lv }), _t('+1 Talentpunkt · Mehr Lebenspunkte')); sfx('lvl');
    fx.push({ k: 'pillar', x: P.x, y: P.y, life: 1, max: 1 });
    rings.push({ x: P.x, y: P.y, r: 2, max: 44, life: .5, max2: .5, col: '#e8b04a' });
    for (let i = 0; i < 30; i++) part(P.x, P.y, rnd(0, 10), rnd(-50, 50), rnd(-30, 30), rnd(40, 120), '#ffd24a', rnd(.5, 1), 1, 120, 1);
  }
  if (P.lv >= 50) P.xp = 0;
}
function hurtPlayer(dmg, src) {
  if (P.inv > 0 || state !== 'play' || P.hp <= 0) return;
  if (Math.random() < P.st.dodge) { txt(P.x, P.y - 24, _t('AUSGEWICHEN'), '#8ee6ea'); P.inv = .25; return; }
  if (src && src.t && src.affixes) { if (src.affixes.includes('frostig') || (src.def && src.def.frosty)) P.slowT = 2; if (src.affixes.includes('vampir')) src.hp = Math.min(src.maxHp, src.hp + dmg * .5); if (mod('chill')) src.chill = 2; }
  let d = hookVal('hurt', dmg * rnd(.9, 1.1) * 40 / (40 + P.st.def) * (1 - P.st.dr), src);
  if (P.wall > 0) { d *= .3 - mod('k3Dr'); fxAnim('shield', P.x, P.y - 12, { dur: .25, alpha: .5, sk: P.wallSk }); }
  const t = Math.max(1, Math.round(d));
  P.hp -= t; P.inv = .7; P.flash = .2; P.squash = .15; P.chain = 0; comboUI(); buzz(25);
  if (src && src.maxHp && !src.dead && mod('my_thorns')) hurtEnemy(src, dmg, (src.x - P.x) / 30, (src.y - P.y) / 30, 60, false, true);
  if (src && src.x != null) { const dx = P.x - src.x, dy = P.y - src.y, n = Math.hypot(dx, dy) || 1; P.vx += dx / n * 140; P.vy += dy / n * 140; }
  txt(P.x, P.y - 24, '-' + t, '#ff6a5a', true); shake(4); hitStop = .05; sfx('hurt'); flash = { a: .35, c: '200,40,40' };
  for (let i = 0; i < 8; i++) part(P.x, P.y, 10, rnd(-50, 50), rnd(-20, 20), rnd(30, 70), '#b8302a', rnd(.3, .6), 1);
  if (P.hp <= 0 && mod('my_phoenix') && G && !G.phoenix) { G.phoenix = true; P.hp = P.st.hp * .5; P.inv = 2; banner(_t('PHÖNIX'), _t('Du erhebst dich aus der Asche!')); explode(P.x, P.y, 50, P.st.wbase * 3, 'p', { burn: true, col: '#ffd24a' }); sfx('spec'); return; }
  if (P.hp <= 0) playerDie();
}
function playerDie() {
  if (hookVal('die', false)) return;
  P.hp = 0; setState('dead'); deadT = 1.8; P.atkT = 0; P.spin = 0; P.leap = null; P.dash = null;
  burst(P.x, P.y, 8, '#b8302a', 24, 90); sfx('die'); $('bossbar').hidden = true; slowmo = 1.5;
  P.stats.deaths++; stat('deaths');
}
function addGhost(col) { ghosts.push({ x: P.x, y: P.y, z: P.z, turn: P.turn, fr: P.moving ? 4 + Math.floor(P.phase * .6) % 4 : 0, life: .28, max: .28, col }); }

function updPlayer(dt) {
  const inp = readInput(), st = P.st;
  P.atkCd -= dt; P.rollCd -= dt; P.inv -= dt; P.flash -= dt; P.comboT -= dt; P.potCd -= dt; P.squash *= Math.pow(.001, dt);
  for (let i = 0; i < 3; i++) P.cds[i] = Math.max(0, P.cds[i] - dt);
  P.res = Math.min(st.resMax, P.res + st.resRegen * dt);
  if (st.regen) P.hp = Math.min(st.hp, P.hp + st.regen * dt);
  if (P.wall > 0) P.wall -= dt; if (P.stealth > 0) P.stealth -= dt; if (P.poisonT > 0) P.poisonT -= dt; if (P.slowT > 0) P.slowT -= dt;
  if (P.chainT > 0) { P.chainT -= dt; if (P.chainT <= 0) { P.chain = 0; comboUI(); } }
  if (mod('fireAura')) { P.auraT = (P.auraT || 0) - dt; if (P.auraT <= 0) { P.auraT = .5; for (const e of enemies) if (!e.dead && e.st !== 'spawn' && Math.hypot(e.x - P.x, e.y - P.y) < 40) { e.burn = 2; e.burnDmg = Math.max(1, Math.round(st.wbase * .15)); } } }
  if (mod('my_frostaura')) for (const e of enemies) if (!e.dead && Math.hypot(e.x - P.x, e.y - P.y) < 55) e.chill = Math.max(e.chill || 0, .3);
  if (state === 'dead') { P.vx *= .9; P.vy *= .9; P.moving = false; return; }
  // Pfützen unter den Füßen
  P.poolT -= dt; const pl = P.z < 2 && !P.leap ? inPool(P.x, P.y) : null;
  if (pl) { if (pl.k === 'wasser' || pl.k === 'eis') P.slowT = Math.max(P.slowT, .15); if ((pl.k === 'lava' || pl.k === 'gift') && P.poolT <= 0 && P.roll <= 0) { P.poolT = .5; hurtPlayer((pl.k === 'lava' ? 7 : 4) + stageNum() * (pl.k === 'lava' ? 1.6 : 1), null); if (pl.k === 'gift') P.slowT = .8; } if (Math.random() < .2) part(P.x + rnd(-4, 4), P.y, 1, rnd(-10, 10), 0, rnd(10, 30), POOLCOL[pl.k][2], .4, 1, 120, pl.k === 'lava' ? 1 : 0); }
  if (ctlSet().pot === 'auto' && P.hp < P.st.hp * .3 && P.potCd <= 0 && P.potions > 0) drinkPotion(true);
  P.ghostT -= dt;
  if (P.leap) {
    const L = P.leap; L.t += dt; const p = Math.min(1, L.t / L.dur);
    P.x = lerp(L.sx, L.tx, p); P.y = lerp(L.sy, L.ty, p); P.z = Math.sin(p * Math.PI) * 24; P.inv = .1; P.moving = false; P.rollA = p * Math.PI * 2 * P.face;
    if (P.ghostT <= 0) { P.ghostT = .03; addGhost(L.sk && L.sk.col); }
    if (p >= 1) {
      P.leap = null; P.z = 0; P.rollA = 0; const w = L.w || playerW(), sk = L.sk, R = 58 * (1 + mod('uRad')), x = P.x, y = P.y;
      explode(x, y, R, w.dmg * 3 * (1 + mod('uDmg')), 'p', { sk, w }); fxAnim('ring', x, y - 4, { sc: R / 20, dur: .5, add: true, sk }); for (let i = 0; i < 14; i++) part(x + rnd(-20, 20), y + rnd(-10, 10), 0, rnd(-60, 60), rnd(-30, 30), rnd(80, 160), sk ? sk.pal[3] : '#6a5e52', rnd(.5, .9), 2); P.inv = .4;
      if (mod('uStun')) for (const e of enemies) if (!e.dead && !e.boss && Math.hypot(e.x - x, e.y - y) < R + e.r * e.sc) e.stun = Math.max(e.stun, mod('uStun'));
      if (mod('uAfter')) setTimeout(() => { if (G && state === 'play') explode(x, y, R * 1.25, w.dmg * 1.5 * (1 + mod('uDmg')), 'p', { sk, w }); }, 400);
    }
    P.turn = approach(P.turn, P.face, dt * 8); return;
  }
  if (P.dash) {
    const D = P.dash; D.t += dt;
    P.x = clamp(P.x + D.dx * D.sp * dt, BD.x0 + P.r, BD.x1 - P.r); P.y = clamp(P.y + D.dy * D.sp * dt, BD.y0, BD.y1); P.inv = .15; P.moving = true;
    const sk = D.sk, w = D.w || playerW();
    if (P.ghostT <= 0) { P.ghostT = .015; addGhost(sk ? sk.col : D.kind === 'shadow' ? '#b892f4' : '#ffd27a'); }
    for (const e of enemies) {
      if (e.st === 'spawn' || D.hit.has(e)) continue;
      if (Math.hypot(e.x - P.x, e.y - P.y) < e.r * e.sc + 14 + (D.wide || 0)) {
        D.hit.add(e);
        if (D.kind === 'shadow') { weaponHit(e, w, 2.4 * (1 + mod('r1Dmg')), D.dx, D.dy, 1.5, true); spark(e.x, e.y - 8, Math.atan2(D.dy, D.dx), sk ? sk.col : '#b892f4'); }
        else { weaponHit(e, w, 1.5 * (1 + mod('k1Dmg')), D.dx, D.dy, 2); if (!e.dead && !e.boss) e.stun = .8 + mod('k1Stun'); spark(e.x, e.y - 8, 0, sk ? sk.col : '#ffd27a'); }
      }
    }
    for (const o of obs) if (!o.dead && o.k !== 'col' && !D.hit.has(o) && Math.hypot(o.x - P.x, o.y - P.y) < o.r + 10) { D.hit.add(o); hitObs(o, 1, D.dx, D.dy); }
    if (D.t >= D.dur) {
      P.dash = null; P.vx = D.dx * 60; P.vy = D.dy * 60; shake(3);
      if (D.kind === 'charge' && mod('k1Wave')) explode(P.x, P.y, 30 * (1 + (mod('k1Wave') - 1) * .5), w.dmg * 1.2, 'p', { sk, w });
      if (D.kind === 'shadow' && mod('r1Stealth')) { P.stealth = Math.max(P.stealth, mod('r1Stealth')); P.stealthSk = sk; burst(P.x, P.y, 8, sk ? sk.col : '#3a3448', 10, 40); }
    }
    P.turn = approach(P.turn, P.face, dt * 8); return;
  }
  if (P.roll > 0) {
    P.roll -= dt; P.vx = P.rdx * 200; P.vy = P.rdy * 200; P.rollA = (1 - P.roll / .32) * Math.PI * 2 * P.face; P.inv = Math.max(P.inv, .05); P.moving = true;
    if (P.ghostT <= 0) { P.ghostT = .04; addGhost(); }
    if (Math.random() < .5) dust(P.x, P.y, 1); if (P.roll <= 0) P.rollA = 0;
  } else {
    const spd = st.spd * (P.atkT > 0 ? .62 : 1) * (P.spin > 0 ? .75 : 1) * (P.slowT > 0 ? .6 : 1), k = 1 - Math.pow(.0005, dt);
    P.vx = lerp(P.vx, inp.mx * spd, k); P.vy = lerp(P.vy, inp.my * spd, k);
    P.moving = Math.hypot(inp.mx, inp.my) > .15;
    if (P.moving) {
      const prev = Math.sin(P.phase); P.phase += dt * 13;
      if (Math.sign(Math.sin(P.phase)) !== Math.sign(prev)) { P.squash = Math.max(P.squash, .07); if (Math.random() < .6) dust(P.x, P.y, 1); }
      if (P.atkT <= 0) { P.aim = Math.atan2(inp.my, inp.mx); if (Math.abs(inp.mx) > .2) P.face = inp.mx > 0 ? 1 : -1; }
    } else if (P.atkT <= 0) { const ma = mouseAimAng(); if (ma != null && Math.abs(Math.cos(ma)) > .2) P.face = Math.cos(ma) > 0 ? 1 : -1; }   // im Stand zum Mauszeiger schauen
    if (inp.attack && P.atkCd <= 0 && P.spin <= 0 && P.volley <= 0) startAttack(inp);
  }
  P.x = clamp(P.x + P.vx * dt, BD.x0 + P.r, BD.x1 - P.r); P.y = clamp(P.y + P.vy * dt, BD.y0, BD.y1);
  solidPush(P, P.r);
  P.turn = approach(P.turn, P.face, dt * 8);
  P.lean = P.roll > 0 ? 0 : -clamp(P.vx / 78, -1, 1) * .14;
  if (P.spin > 0) {
    const sk = P.spinSk, K = 1 + mod('k2Rad'), R = 34 * K;
    P.spin -= dt; P.spinA += dt * 26 * P.face; P.inv = .05; P.spinTick -= dt;
    if (P.spinTick <= 0) { P.spinTick = .13; const w = P.spinW || playerW(); for (const e of enemies) { if (e.st === 'spawn') continue; const dx = e.x - P.x, dy = e.y - P.y, d = Math.hypot(dx, dy) || 1; if (d < R + e.r * e.sc) weaponHit(e, w, .8 * (1 + mod('k2Dmg')), dx / d, dy / d, .8); else if (mod('k2Pull') && !e.boss && !e.dead && d < R * 1.8) { e.x -= dx / d * 5; e.y -= dy / d * 5; } } for (const o of obs) if (!o.dead && o.k !== 'col' && Math.hypot(o.x - P.x, o.y - P.y) < R) hitObs(o, 1, 0, 0); sfx('swing'); }
    if (Math.random() < .6) part(P.x + Math.cos(P.spinA) * 24 * K, P.y + Math.sin(P.spinA) * 12 * K, 8, 0, 0, 10, sk ? sk.col2 : '#e8eef8', .25, 1, 0, 1);
    if (Math.random() < .3) fx.push({ k: 'slash', x: P.x, y: P.y - 8, ang: P.spinA, flip: P.face < 0, sc: .7 * (sk ? sk.sc : 1), life: .18, max: .18, col: sk ? sk.col : TINT[P.gear.weapon.tier] || '#e8eef8', follow: true });
  }
  if (P.volley > 0) { P.volleyT -= dt; if (P.volleyT <= 0) { P.volleyT = .1; P.volley--; const w = P.volleyW || playerW(), n = 4 + mod('auArrows'); for (let i = -n; i <= n; i++) fireProj({ k: 'arrow', ang: P.aim + i * .64 / n + rnd(-.03, .03), w, mul: 1.3 * (1 + mod('uDmg')), pierce: true }); sfx('bow'); shake(2); } }
  if (P.atkT > 0) {
    P.atkT -= dt; const w = playerW(), p = 1 - P.atkT / P.atkDur, fin = P.combo === 2;
    if (WT[w.type].ranged) { if (!P.struck && p >= .35) { P.struck = true; primaryRanged(w, fin); } }
    else if (w.type === 'dagger') {
      if (p > .15 && p < .45) meleeSweep(w, fin);
      if (p > .5 && !P.struck) { P.struck = true; P.hitSet = new Set(); fx.push({ k: 'slash', x: P.x, y: P.y - 8, ang: P.aim, flip: true, sc: .45, life: .18, max: .18, col: TINT[w.tier] || '#e8eef8', follow: true }); }
      if (p > .55 && p < .85) meleeSweep(w, fin);
    }
    else if (p > .18 && p < .78) meleeSweep(w, fin);
    if (fin && p > .3 && p < .4 && !WT[w.type].ranged) shake(2);
    if (P.atkT <= 0) P.comboT = .45;
  }
}

/* ---------- Verbündete & Fallen ---------- */
function updAllies(dt) {
  for (const a of allies) {
    a.life -= dt;
    if (a.k === 'spirit') {
      a.ang += dt * 1.6; const tx = P.x + Math.cos(a.ang) * 18, ty = P.y + Math.sin(a.ang) * 10 - 2;
      a.x = lerp(a.x, tx, 1 - Math.pow(.001, dt)); a.y = lerp(a.y, ty, 1 - Math.pow(.001, dt)); a.z = 14 + Math.sin(T * 4 + a.seed) * 2;
      a.shotT -= dt; if (Math.random() < .3) part(a.x, a.y, a.z, 0, 0, 0, a.sk ? a.sk.col : '#9be070', .4, 1, 0, 1);
      if (a.shotT <= 0) { const t = nearestEnemy(170, a); if (t) { a.shotT = .6 / (1 + mod('a3Fast')); fireProj({ k: 'plant', fxn: 'plant', x: a.x, y: a.y, ang: Math.atan2(t.y - a.y, t.x - a.x), w: a.w || playerW(), mul: .5 * (1 + mod('a3Dmg')), sp: 210, life: 1, h: a.z }); } }
      if (mod('a3Heal') && state === 'play' && (a.healT -= dt) <= 0) { a.healT = 3; const h = Math.max(1, Math.round(P.st.hp * .02)); P.hp = Math.min(P.st.hp, P.hp + h); txt(P.x, P.y - 22, '+' + h, '#79c24e'); for (let i = 0; i < 6; i++) part(P.x + rnd(-5, 5), P.y, rnd(0, 12), 0, 0, rnd(20, 40), a.sk ? a.sk.col : '#9be070', rnd(.4, .7), 1, -10, 1); }
    } else if (a.k === 'clone') {
      const t = nearestEnemy(200, a); a.atkT -= dt;
      if (t) {
        const dx = t.x - a.x, dy = t.y - a.y, d = Math.hypot(dx, dy) || 1; a.face = dx >= 0 ? 1 : -1;
        if (d > 14) { a.x += dx / d * 110 * dt; a.y += dy / d * 110 * dt; a.phase += dt * 13; a.moving = true; } else a.moving = false;
        if (d < 22 && a.atkT <= 0) { a.atkT = .35; const w = a.w || playerW(); w.poison = P.poisonT > 0; weaponHit(t, w, .6 * (1 + mod('ruDmg')), dx / d, dy / d, .5); fx.push({ k: 'slash', x: a.x, y: a.y - 6, ang: Math.atan2(dy, dx), flip: Math.random() < .5, sc: .4, life: .18, max: .18, col: a.sk ? a.sk.col : '#b892f4' }); }
      } else { a.moving = false; }
    }
    if (a.life <= 0) { burst(a.x, a.y, 8, a.sk ? a.sk.col : a.k === 'clone' ? '#3a3448' : '#9be070', 10, 40); if (a.k === 'clone' && mod('ruBoom') && state === 'play') explode(a.x, a.y, 26, (a.w || playerW()).dmg * 1.2, 'p', { sk: a.sk, w: a.w }); }
  }
  allies = allies.filter(a => a.life > 0);
  for (const t of traps) {
    t.armT -= dt; t.life -= dt;
    if (t.armT <= 0) {
      const e = enemies.find(e => !e.dead && e.st !== 'spawn' && e.z < 6 && Math.hypot(e.x - t.x, e.y - t.y) < 14 + e.r * e.sc);
      if (e) {
        t.life = 0; const w = t.w || playerW(), sk = t.sk, R = 34 * (1 + mod('a2Rad'));
        explode(t.x, t.y, R, w.dmg * 2.2 * (1 + mod('a2Dmg')), 'p', { sk, w });
        if (mod('a2Slow')) for (const o of enemies) if (!o.dead && Math.hypot(o.x - t.x, o.y - t.y) < R + o.r * o.sc) o.chill = Math.max(o.chill || 0, mod('a2Slow'));
        if (mod('a2Cluster')) for (let k = 0; k < 4; k++) { const a = k / 4 * 6.283 + .4; const x = t.x + Math.cos(a) * 26, y = t.y + Math.sin(a) * 16; setTimeout(() => { if (G && state === 'play') explode(x, y, 18, w.dmg * .9, 'p', { sk, w }); }, 200 + k * 90); }
      }
    }
  }
  traps = traps.filter(t => t.life > 0);
}

/* ---------- Gegner-KI ---------- */
function clampE(e) { const R = e.r * e.sc; e.x = clamp(e.x, BD.x0 + R, BD.x1 - R); e.y = clamp(e.y, BD.y0, BD.y1); if (!(e.ai === 'swoop' && e.z > 8) && e.ai !== 'ghost' && !(e.under > 0)) solidPush(e, R); }
function enemyArrow(e, ang, sp) { projs.push({ k: 'arrow', x: e.x + Math.cos(ang) * 6, y: e.y + Math.sin(ang) * 4, h: 8 * e.sc, vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp, life: 1.5, max: 1.5, dmg: e.atk, from: 'e', r: 3, src: e }); }
function castOrbs(e) {
  const n = e.boss ? (e.hp < e.maxHp * .5 ? 7 : 5) : 1, spread = .24, sp = Math.min(150, 90 + stageNum() * 2.2);
  for (let i = 0; i < n; i++) { const a = e.aim + (i - (n - 1) / 2) * spread; projs.push({ k: 'orb', fxn: e.def.orb || 'darkorb', x: e.x + Math.cos(a) * 8, y: e.y + Math.sin(a) * 8, h: 12 * e.sc, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 3, max: 3, dmg: e.atk, from: 'e', r: 4, src: e, slow: e.def.orb === 'waterorb' }); }
  sfx('cast'); e.casts++;
  if (e.def.summon && enemies.length < 22 && (e.boss ? e.casts % 2 === 0 : e.casts % 3 === 0)) { const k = e.boss ? 2 : 1; for (let i = 0; i < k; i++) spawnEnemy(e.def.summon, { x: clamp(e.x + rnd(-24, 24), BD.x0 + 10, BD.x1 - 10), y: clamp(e.y + rnd(-14, 14), BD.y0, BD.y1) }); }
}
function throwBomb(e) {
  const fl = !!e.def.flask, n = e.boss ? 3 : 1;
  for (let i = 0; i < n; i++) {
    const tx = P.x + P.vx * .5 + (i ? rnd(-40, 40) : 0), ty = P.y + P.vy * .5 + (i ? rnd(-26, 26) : 0);
    projs.push({ k: fl ? 'flask' : 'bomb', x: e.x, y: e.y, sx: e.x, sy: e.y, tx: clamp(tx, BD.x0, BD.x1), ty: clamp(ty, BD.y0, BD.y1), t: 0, dur: .8, fuse: fl ? .05 : .7, h: 10, vx: 0, vy: 0, life: 9, max: 9, dmg: e.atk * (fl ? 1 : 1.4), from: 'e', r: 0 });
  }
  e.casts++; if (e.boss && e.def.summon && e.casts % 3 === 0 && enemies.length < 20) { for (let i = 0; i < 2; i++) spawnEnemy(e.def.summon, { x: clamp(e.x + rnd(-24, 24), BD.x0 + 10, BD.x1 - 10), y: clamp(e.y + rnd(-14, 14), BD.y0, BD.y1) }); }
  sfx('lunge');
}
function updEnemy(e, dt) {
  e.flash -= dt; e.squash *= Math.pow(.001, dt); e.cd -= dt / e.cdMul; e.tcd -= dt; e.life += dt;
  const dx = P.x - e.x, dy = P.y - e.y, d = Math.hypot(dx, dy) || 1, R = e.r * e.sc, D = e.def;
  if (e.ai === 'dummy') { e.x = e.hx; e.y = e.hy; e.dmgLog = e.dmgLog.filter(l => T - l[0] < 3); let s = 0; for (const l of e.dmgLog) s += l[1]; e.dps = s / 3; e.hp = e.maxHp; return; }
  if (e.st === 'spawn') { e.stT -= dt; e.alpha = clamp(1 - e.stT / .7, 0, 1); if (e.stT <= 0) { e.st = 'move'; e.alpha = e.ai === 'ghost' ? .6 : null; } return; }
  if (HOOK.enemyUpd.length) hook('enemyUpd', e, dt);
  if (e.burn > 0) { e.burn -= dt; e.burnT -= dt; if (Math.random() < .4) part(e.x + rnd(-4, 4), e.y, rnd(4, 14) * e.sc, 0, 0, rnd(15, 30), pick(['#ffb03a', '#ff6a2a']), .4, 1, -20, 1); if (e.burnT <= 0) { e.burnT = .5; e.hp -= e.burnDmg; txt(e.x, e.y - 14 * e.sc, String(e.burnDmg), '#ff8a3a'); if (e.hp <= 0) { killEnemy(e, 0, 0); return; } } }
  if (e.poison > 0) { e.poison -= dt; e.poisonT -= dt; if (Math.random() < .3) part(e.x + rnd(-4, 4), e.y, rnd(4, 14) * e.sc, 0, 0, rnd(10, 20), '#79c24e', .4, 1, -10, 1); if (e.poisonT <= 0) { e.poisonT = .5; e.hp -= e.poisonDmg; txt(e.x, e.y - 14 * e.sc, String(e.poisonDmg), '#79c24e'); if (e.hp <= 0) { killEnemy(e, 0, 0); return; } } }
  if (e.chill > 0) e.chill -= dt;
  if (e.armorMax && e.armorT > 0) { e.armorT -= dt; } else if (e.armorMax && e.armor < e.armorMax) e.armor = Math.min(e.armorMax, e.armor + e.armorMax * .1 * dt);
  e.x += e.kbx * dt; e.y += e.kby * dt; const kd = Math.pow(.003, dt); e.kbx *= kd; e.kby *= kd;
  if (e.freeze > 0) { e.freeze -= dt; e.moving = false; clampE(e); return; }
  if (e.stun > 0) { e.stun -= dt; e.moving = false; clampE(e); return; }
  /* Affix-Verhalten */
  for (const a of e.affixes) {
    if (a === 'heiler') { e.healT -= dt; if (e.healT <= 0) { e.healT = 3; rings.push({ x: e.x, y: e.y, r: 4, max: 60, life: .5, max2: .5, col: '#79c24e' }); for (const o of enemies) if (!o.dead && Math.hypot(o.x - e.x, o.y - e.y) < 60) { const h = o.maxHp * .08; o.hp = Math.min(o.maxHp, o.hp + h); if (o !== e) txt(o.x, o.y - 16 * o.sc, '+' + Math.round(h), '#79c24e'); } } }
    if (a === 'teleport') { e.telT -= dt; if (e.telT <= 0 && e.st === 'move' && d > 40) { e.telT = 4 + rnd(0, 2); burst(e.x, e.y, 8, '#b892f4', 12, 50, 1); const ang = rnd(0, 6.28); e.x = clamp(P.x + Math.cos(ang) * 30, BD.x0 + 10, BD.x1 - 10); e.y = clamp(P.y + Math.sin(ang) * 20, BD.y0, BD.y1); burst(e.x, e.y, 8, '#b892f4', 12, 50, 1); sfx('cast'); } }
    if (a === 'brennend') { e.trailT -= dt; if (e.trailT <= 0 && e.moving) { e.trailT = .35; hazards.push({ x: e.x, y: e.y, r: 7, life: 3, max: 3, dmg: e.atk * .3, tick: 0 }); } }
  }
  if (D.trail) { e.trailT -= dt; if (e.trailT <= 0 && e.moving) { e.trailT = .45; hazards.push({ k: D.trail === 'gift' ? 'gift' : null, x: e.x, y: e.y, r: 7, life: 3.5, max: 3.5, dmg: e.atk * .3, tick: 0 }); } }
  if (pools.length && e.z < 2 && !e.boss && !(e.under > 0)) { const pl = inPool(e.x, e.y); if (pl && pl.k === 'lava') { e.lavaT = (e.lavaT || 0) - dt; if (e.lavaT <= 0) { e.lavaT = .5; hurtEnemy(e, Math.round(e.maxHp * .06 + 2), 0, 0, 0, false, true); if (e.dead) return; } } }
  if (e.st !== 'act') { e.aim = Math.atan2(dy, dx); e.face = dx >= 0 ? 1 : -1; }
  let mvx = 0, mvy = 0; const spd = e.spd * (e.chill > 0 ? .5 : 1) * (e.poison > 0 && mod('poisonSlow') ? 1 - mod('poisonSlow') : 1);
  if (state !== 'play') { e.moving = false; e.turn = approach(e.turn, e.face, dt * 7); return; }
  if (P.stealth > 0 && e.st === 'move' && e.ai !== 'flee') {
    if (!e.wander || Math.random() < .01) e.wander = { x: rnd(BD.x0, BD.x1), y: rnd(BD.y0, BD.y1) };
    const wx = e.wander.x - e.x, wy = e.wander.y - e.y, wd = Math.hypot(wx, wy) || 1; mvx = wx / wd * spd * .5; mvy = wy / wd * spd * .5;
  } else switch (e.ai) {
    case 'melee':
      if (e.st === 'move') { mvx = dx / d * spd; mvy = dy / d * spd; if (d < R + P.r + e.reach * .7) { mvx *= .15; mvy *= .15; } if (d < R + P.r + e.reach && e.cd <= 0) { e.st = 'wind'; e.stT = e.windDur = D.wind * (P.diff === 'hell' ? .8 : 1); } }
      else if (e.st === 'wind') { e.stT -= dt; if (e.stT <= 0) { e.st = 'act'; e.stT = .18; if (d < R + P.r + e.reach + 5) hurtPlayer(e.atk, e); e.squash = -.14; sfx('swing'); } }
      else if (e.st === 'act') { e.stT -= dt; if (e.stT <= 0) { e.st = 'move'; e.cd = D.cd * rnd(.8, 1.2); } }
      break;
    case 'lunge':
      if (e.st === 'move') { mvx = dx / d * spd; mvy = dy / d * spd; if (d < 64 && e.cd <= 0) { e.st = 'wind'; e.stT = e.windDur = .34; e.squash = .15; } }
      else if (e.st === 'wind') { e.stT -= dt; if (e.stT <= 0) { e.st = 'act'; e.stT = .28; e.ldx = dx / d; e.ldy = dy / d; e.hitDone = false; sfx('lunge'); } }
      else if (e.st === 'act') { e.stT -= dt; mvx = e.ldx * 220; mvy = e.ldy * 220; e.face = e.ldx >= 0 ? 1 : -1; if (!e.hitDone && d < R + P.r + 3) { e.hitDone = true; hurtPlayer(e.atk, e); } if (Math.random() < .5) dust(e.x, e.y, 1); if (e.stT <= 0) { e.st = 'rec'; e.stT = .35; } }
      else if (e.st === 'rec') { e.stT -= dt; if (e.stT <= 0) { e.st = 'move'; e.cd = 1.5 * rnd(.8, 1.2); } }
      break;
    case 'flee': {
      e.escape -= dt;
      const ax = -dx / d, ay = -dy / d; let tx = ax, ty = ay;
      if (e.x < BD.x0 + 30 || e.x > BD.x1 - 30) tx = -tx * .3 + (e.y < AH / 2 ? .7 : -.7) * 0; if (e.y < BD.y0 + 20 || e.y > BD.y1 - 20) ty = -ty * .3;
      mvx = (tx + Math.sin(T * 2 + e.seed) * .5) * spd * (d < 90 ? 1 : .5); mvy = (ty + Math.cos(T * 1.7 + e.seed) * .5) * spd * (d < 90 ? 1 : .5);
      if (Math.random() < .2) part(e.x, e.y, 6, 0, 0, 10, '#ffd24a', .4, 1, 0, 1);
      if (e.escape <= 0) { e.dead = true; fxAnim('ring', e.x, e.y - 6, { sc: .8, dur: .5, add: true }); burst(e.x, e.y, 8, '#b892f4', 20, 60, 1); toast(_t('Der Schatzgoblin ist entkommen!'), '#ff6a5a'); sfx('cast'); }
      break;
    }
    case 'bomber':
      if (e.st === 'move') { if (d < 80) { mvx = -dx / d * spd; mvy = -dy / d * spd; } else if (d > 140) { mvx = dx / d * spd; mvy = dy / d * spd; } else { mvx = -dy / d * spd * .6 * e.strafe; mvy = dx / d * spd * .6 * e.strafe; } if (e.cd <= 0 && d < 200) { e.st = 'wind'; e.stT = e.windDur = .5; } }
      else if (e.st === 'wind') { e.stT -= dt; if (e.stT <= 0) { throwBomb(e); e.st = 'rec'; e.stT = .4; } }
      else if (e.st === 'rec') { e.stT -= dt; if (e.stT <= 0) { e.st = 'move'; e.cd = 2.5 * rnd(.8, 1.2); if (Math.random() < .5) e.strafe *= -1; } }
      break;
    case 'caster':
      if (e.st === 'move') {
        const want = e.boss ? 115 : 105;
        if (d < want - 25) { mvx = -dx / d * spd; mvy = -dy / d * spd; } else if (d > want + 30) { mvx = dx / d * spd; mvy = dy / d * spd; } else { mvx = -dy / d * spd * .7 * e.strafe; mvy = dx / d * spd * .7 * e.strafe; }
        if (e.boss && d < 50 && e.tcd <= 0) {
          if (D.nova) { fxAnim('ring', e.x, e.y - 4, { sc: 3.2, dur: .5, add: true }); for (let k = 0; k < 14; k++) fx.push({ k: 'shard', x: e.x, y: e.y, ang: k / 14 * 6.283, life: .4, max: .4 }); sfx('frost'); if (d < 72) { hurtPlayer(e.atk * .8, e); P.slowT = 2.5; } }
          burst(e.x, e.y, 10, '#7ae07a', 20, 80, 1); placeFar(e); burst(e.x, e.y, 10, '#7ae07a', 20, 80, 1); fx.push({ k: 'portal', x: e.x, y: e.y, life: .5, max: .5 }); e.tcd = 3; sfx('cast');
        }
        if (e.cd <= 0 && d < 240) { e.st = 'wind'; e.stT = e.windDur = e.boss ? .45 : .55; }
      } else if (e.st === 'wind') { e.stT -= dt; if (Math.random() < .6) part(e.x + e.face * 8 * e.sc, e.y, 16 * e.sc, rnd(-10, 10), rnd(-5, 5), rnd(5, 20), e.t === 'shaman' ? '#7ae07a' : e.t === 'icez' ? '#bfefff' : '#c060ff', .35, 1, 0, 1); if (e.stT <= 0) { castOrbs(e); e.st = 'rec'; e.stT = .35; } }
      else if (e.st === 'rec') { e.stT -= dt; if (e.stT <= 0) { e.st = 'move'; e.cd = (e.boss ? 1.2 : 2.1) * rnd(.8, 1.2); if (Math.random() < .4) e.strafe *= -1; } }
      break;
    case 'slam':
      if (e.st === 'move') {
        mvx = dx / d * spd; mvy = dy / d * spd;
        if (e.boss && e.sum < 2 && e.hp < e.maxHp * (e.sum === 0 ? .66 : .33)) { e.sum++; const k = e.t === 'zombie' ? 'tinyz' : 'goblin'; for (let i = 0; i < 4; i++) spawnEnemy(k, { x: clamp(e.x + rnd(-30, 30), BD.x0, BD.x1), y: clamp(e.y + rnd(-20, 20), BD.y0, BD.y1) }); toast(_t('{name} ruft Verstärkung!', { name: e.name })); }
        if (d < R + P.r + 14 && e.cd <= 0) { e.st = 'wind'; e.stT = e.windDur = e.boss ? .62 : .78; }
      }
      else if (e.st === 'wind') {
        e.stT -= dt;
        if (e.stT <= 0) {
          e.st = 'act'; e.stT = .25; const rad = 34 * e.sc, fx0 = e.x + Math.cos(e.aim) * R * .8, fy0 = e.y + Math.sin(e.aim) * R * .8;
          rings.push({ x: fx0, y: fy0, r: 4, max: rad, life: .35, max2: .35, col: '#e8d8a8' }); fxAnim('ring', fx0, fy0 - 2, { sc: rad / 22, dur: .4, add: true });
          if (Math.hypot(P.x - fx0, P.y - fy0) < rad + P.r) hurtPlayer(e.atk, { x: fx0, y: fy0, t: e.t, affixes: e.affixes });
          shake(6); sfx('boom'); dust(fx0, fy0, 12); decal(fx0, fy0, '#1a1410', 14);
          for (let i = 0; i < 8; i++) part(fx0, fy0, 0, rnd(-60, 60), rnd(-30, 30), rnd(60, 120), '#6a5e52', rnd(.4, .8), 2);
          if (e.boss) for (let i = 0; i < 8; i++) { const a = i / 8 * 6.283; projs.push({ k: 'rock', x: fx0, y: fy0, h: 4, vx: Math.cos(a) * 110, vy: Math.sin(a) * 110, life: 1.2, max: 1.2, dmg: e.atk * .6, from: 'e', r: 4 }); }
        }
      }
      else if (e.st === 'act') { e.stT -= dt; if (e.stT <= 0) { e.st = 'rec'; e.stT = .5; } }
      else if (e.st === 'rec') { e.stT -= dt; if (e.stT <= 0) { e.st = 'move'; e.cd = e.boss ? 1.05 : 1.6; } }
      break;
    case 'charge':
      if (e.st === 'move' && e.boss && D.summon && e.sum < 2 && e.hp < e.maxHp * (e.sum === 0 ? .66 : .33)) { e.sum++; for (let i = 0; i < 3; i++) spawnEnemy(D.summon, { x: clamp(e.x + rnd(-40, 40), BD.x0, BD.x1), y: clamp(e.y + rnd(-24, 24), BD.y0, BD.y1) }); toast(_t('{name} ruft seine Garde!', { name: e.name })); }
      if (e.st === 'move') { mvx = dx / d * spd; mvy = dy / d * spd; if (e.cd <= 0) { if (d < R + P.r + 12) { e.st = 'wind'; e.mode = 'melee'; e.stT = e.windDur = .45; } else if (d < 170) { e.st = 'wind'; e.mode = 'charge'; e.stT = e.windDur = .6; } } }
      else if (e.st === 'wind') {
        e.stT -= dt; if (e.mode === 'charge') { e.ldx = dx / d; e.ldy = dy / d; if (Math.random() < .4) dust(e.x - e.face * 4, e.y, 1); }
        if (e.stT <= 0) { if (e.mode === 'melee') { if (d < R + P.r + 16) hurtPlayer(e.atk, e); e.st = 'rec'; e.stT = .3; sfx('swing'); } else { e.st = 'act'; e.stT = .85; e.hitDone = false; sfx('lunge'); } }
      }
      else if (e.st === 'act') {
        e.stT -= dt; mvx = e.ldx * 230; mvy = e.ldy * 230; e.face = e.ldx >= 0 ? 1 : -1; e.aim = Math.atan2(e.ldy, e.ldx); if (Math.random() < .6) dust(e.x, e.y, 1);
        if (!e.hitDone && d < R + P.r + 4) { e.hitDone = true; hurtPlayer(e.atk * 1.3, e); }
        const nx = e.x + mvx * dt, ny = e.y + mvy * dt;
        const hitCol = obs.find(o => o.solid && !o.dead && Math.hypot(o.x - nx, o.y - ny) < o.r + R);
        if (nx < BD.x0 + R || nx > BD.x1 - R || ny < BD.y0 || ny > BD.y1 || hitCol) { if (hitCol && hitCol.k !== 'col') hitObs(hitCol, 99, 0, 0, true); e.st = 'rec'; e.stT = 1.1; mvx = mvy = 0; shake(5); sfx('boom'); hurtEnemy(e, Math.round(e.maxHp * .08), -e.ldx, -e.ldy, 40, false, true); for (let i = 0; i < 6; i++) part(e.x, e.y, 20 * e.sc, rnd(-30, 30), rnd(-10, 10), rnd(30, 60), '#ffd24a', .6, 1, 220, 1); }
        if (e.stT <= 0 && e.st === 'act') { e.st = 'rec'; e.stT = .4; }
      }
      else if (e.st === 'rec') { e.stT -= dt; if (e.stT <= 0) { e.st = 'move'; e.cd = (e.boss ? .8 : 1.3) * rnd(.8, 1.3); } }
      break;
    case 'archer':
      if (e.st === 'move') {
        if (d < 70) { mvx = -dx / d * spd; mvy = -dy / d * spd; } else if (d > 160) { mvx = dx / d * spd; mvy = dy / d * spd; } else { mvx = -dy / d * spd * .7 * e.strafe; mvy = dx / d * spd * .7 * e.strafe; }
        if (e.cd <= 0 && d < 230) { e.st = 'wind'; e.stT = e.windDur = .6; }
      } else if (e.st === 'wind') {
        e.stT -= dt; if (e.stT > .15) e.lock = Math.atan2(P.y + P.vy * .2 - e.y, P.x + P.vx * .2 - e.x); e.aim = e.lock; e.face = Math.cos(e.lock) >= 0 ? 1 : -1;
        if (e.stT <= 0) { const n = e.t === 'elfe' ? 3 : 1; for (let i = 0; i < n; i++) enemyArrow(e, e.lock + (i - (n - 1) / 2) * .16, 175); sfx('bow'); e.st = 'act'; e.stT = .25; }
      } else if (e.st === 'act') { e.stT -= dt; if (e.stT <= 0) { e.st = 'move'; e.cd = 1.9 * rnd(.8, 1.2); if (Math.random() < .5) e.strafe *= -1; } }
      break;
    case 'ghost':
      e.z = 4 + Math.sin(T * 3 + e.seed) * 2; e.fade = approach(e.fade, e.hide > 0 ? 1 : 0, dt * 4); e.alpha = .65 * (1 - e.fade) + .05;
      if (e.hide > 0) { e.hide -= dt; mvx = dx / d * spd * .6; mvy = dy / d * spd * .6; if (e.hide <= 0) { const a = rnd(0, 6.28); e.x = clamp(P.x - P.face * 26 + Math.cos(a) * 6, BD.x0 + 8, BD.x1 - 8); e.y = clamp(P.y + Math.sin(a) * 10, BD.y0, BD.y1); burst(e.x, e.y, 8, '#bfefff', 10, 40, 1); e.cd = .3; } break; }
      if (e.st === 'move') { mvx = dx / d * spd; mvy = dy / d * spd; if (d < R + P.r + 12 && e.cd <= 0) { e.st = 'wind'; e.stT = e.windDur = .45; } }
      else if (e.st === 'wind') { e.stT -= dt; if (e.stT <= 0) { e.st = 'act'; e.stT = .2; if (d < R + P.r + 16) hurtPlayer(e.atk, e); sfx('frost'); } }
      else if (e.st === 'act') { e.stT -= dt; if (e.stT <= 0) { e.st = 'move'; e.cd = 1.3 * rnd(.8, 1.2); } }
      break;
    case 'burrow':
      if (e.st === 'move') {
        e.bt = (e.bt || 0) + dt; mvx = dx / d * spd * .5; mvy = dy / d * spd * .5;
        if (d < R + P.r + 10 && e.cd <= 0) { e.st = 'wind'; e.stT = e.windDur = .38; }
        else if (e.bt > 2.2) { e.st = 'under'; e.under = 1; e.stT = 1.5; e.bt = 0; sfx('dig'); dust(e.x, e.y, 8); }
      } else if (e.st === 'under') {
        e.stT -= dt; mvx = dx / d * spd * 2; mvy = dy / d * spd * 2; if (Math.random() < .5) dust(e.x, e.y, 1);
        if (e.stT <= 0 || d < 16) { e.st = 'emerge'; e.stT = .55; e.ex = P.x; e.ey = P.y; fx.push({ k: 'warn', x: e.ex, y: e.ey, r: 18, life: .55, max: .55 }); }
      } else if (e.st === 'emerge') {
        e.stT -= dt; e.x = lerp(e.x, e.ex, Math.min(1, dt * 10)); e.y = lerp(e.y, e.ey, Math.min(1, dt * 10));
        if (e.stT <= 0) { e.under = 0; e.st = 'act'; e.stT = .5; burst(e.x, e.y, 2, '#6a5e52', 16, 70); shake(3); sfx('boom'); if (Math.hypot(P.x - e.x, P.y - e.y) < 20) hurtPlayer(e.atk * 1.2, e); }
      } else if (e.st === 'wind') { e.stT -= dt; if (e.stT <= 0) { e.st = 'act'; e.stT = .3; if (d < R + P.r + 12) hurtPlayer(e.atk, e); sfx('swing'); } }
      else if (e.st === 'act') { e.stT -= dt; if (e.stT <= 0) { e.st = 'move'; e.cd = 1.2; } }
      break;
    case 'swoop':
      e.flap = (e.flap || 0) + dt * (e.st === 'act' ? 20 : 11);
      if (e.st === 'move') { e.orb += dt * .9 * e.strafe; const tx = P.x + Math.cos(e.orb) * 72, ty = P.y + Math.sin(e.orb) * 50, ddx = tx - e.x, ddy = ty - e.y, dd = Math.hypot(ddx, ddy) || 1, sp = Math.min(spd * 1.2, dd * 3); mvx = ddx / dd * sp; mvy = ddy / dd * sp; e.z = lerp(e.z, 14 + Math.sin(T * 3 + e.seed) * 2, 1 - Math.pow(.01, dt)); if (e.cd <= 0 && d < 120) { e.st = 'wind'; e.stT = e.windDur = .42; } }
      else if (e.st === 'wind') { e.stT -= dt; e.z = lerp(e.z, 22, dt * 4); if (e.stT <= 0) { e.st = 'act'; e.stT = .55; e.ldx = dx / d; e.ldy = dy / d; e.hitDone = false; sfx('lunge'); } }
      else if (e.st === 'act') { e.stT -= dt; mvx = e.ldx * 200; mvy = e.ldy * 200; e.z = lerp(e.z, 2, 1 - Math.pow(.0001, dt)); e.face = e.ldx >= 0 ? 1 : -1; if (Math.random() < .5) part(e.x, e.y, e.z + 6, 0, 0, 0, '#ff8a3a', .3, 1, 0, 1); if (!e.hitDone && d < R + P.r + 3) { e.hitDone = true; hurtPlayer(e.atk, e); } if (e.stT <= 0) { e.st = 'move'; e.cd = 2.3 * rnd(.8, 1.2); } }
      break;
    case 'dragon':
      if (e.st === 'move') {
        if (d > 80) { mvx = dx / d * spd; mvy = dy / d * spd; } else if (d < 50) { mvx = -dx / d * spd * .6; mvy = -dy / d * spd * .6; }
        if (e.boss && e.sum < 2 && e.hp < e.maxHp * (e.sum === 0 ? .66 : .33)) { e.sum++; for (let i = 0; i < (D.summon === 'jungdrache' ? 1 : 3); i++) spawnEnemy(D.summon || 'imp', {}); toast(_t('{name} ruft Verstärkung!', { name: e.name })); }
        if (e.cd <= 0) { if (d < R + P.r + 22) { e.st = 'wind'; e.mode = 'stomp'; e.stT = e.windDur = .6; } else { e.st = 'wind'; e.mode = 'breath'; e.stT = e.windDur = .8; } }
      } else if (e.st === 'wind') {
        e.stT -= dt; if (e.mode === 'breath' && Math.random() < .5) part(e.x + e.face * 14 * e.sc, e.y, 18 * e.sc, 0, 0, 10, '#ffb03a', .3, 1, 0, 1);
        if (e.stT <= 0) { if (e.mode === 'stomp') { explode(e.x, e.y, 54, e.atk, 'e'); e.st = 'rec'; e.stT = .5; } else { e.st = 'act'; e.stT = 1.3; e.bang = e.aim; e.fireT = 0; e.fireFace = e.face; } }
      } else if (e.st === 'act') {
        e.stT -= dt; e.fireT -= dt; e.face = e.fireFace; e.bang += angDiff(Math.atan2(dy, dx), e.bang) * dt * 1.2;
        if (Math.random() < .3) sfx('roll');
        while (e.fireT <= 0) { e.fireT += .045; const a = e.bang + rnd(-.28, .28), v = rnd(120, 160); projs.push({ k: 'fire', x: e.x + e.face * 14 * e.sc, y: e.y, h: 16 * e.sc, h0: 16 * e.sc, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: .8, max: .8, dmg: e.atk * .45, from: 'e', r: 5 }); }
        if (e.stT <= 0) { e.st = 'rec'; e.stT = .6; }
      } else if (e.st === 'rec') { e.stT -= dt; if (e.stT <= 0) { e.st = 'move'; e.cd = 1.15; } }
      break;
  }
  e.x += mvx * dt; e.y += mvy * dt; e.moving = Math.hypot(mvx, mvy) > 5;
  if (e.moving) e.phase += dt * (8 + e.spd / 10);
  e.turn = approach(e.turn, e.face, dt * 7); e.lean = -clamp(mvx / 120, -1, 1) * .12;
  clampE(e);
}
function separate() {
  for (let i = 0; i < enemies.length; i++) {
    const a = enemies[i]; if (a.st === 'spawn' || a.under > 0 || a.ai === 'dummy') continue;
    for (let j = i + 1; j < enemies.length; j++) {
      const b = enemies[j]; if (b.st === 'spawn' || b.under > 0 || b.ai === 'dummy') continue;
      const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy) || .01, m = (a.r * a.sc + b.r * b.sc) * .9;
      if (d < m) { const p = (m - d) / 2, nx = dx / d, ny = dy / d, wa = b.mass / (a.mass + b.mass), wb = 1 - wa; a.x -= nx * p * 2 * wa; a.y -= ny * p * 2 * wa; b.x += nx * p * 2 * wb; b.y += ny * p * 2 * wb; }
    }
    if (P.roll <= 0 && !P.dash && !P.leap && state === 'play' && !(a.ai === 'swoop' && a.z > 8)) { const dx = a.x - P.x, dy = a.y - P.y, d = Math.hypot(dx, dy) || .01, m = a.r * a.sc + P.r; if (d < m) { a.x += dx / d * (m - d); a.y += dy / d * (m - d); } }
  }
}

/* ---------- Projektile, Fallen, Pickups, Partikel ---------- */
function updProjs(dt) {
  for (const p of projs) {
    if (p.k === 'bomb' || p.k === 'flask') {
      if (p.t < p.dur) { p.t += dt; const q = Math.min(1, p.t / p.dur); p.x = lerp(p.sx, p.tx, q); p.y = lerp(p.sy, p.ty, q); p.h = 4 + Math.sin(q * Math.PI) * 34; }
      else if (p.k === 'flask') { p.life = 0; sfx('poison'); burst(p.x, p.y, 4, '#79c24e', 14, 50, 1); hazards.push({ k: 'gift', x: p.x, y: p.y, r: 15, life: 5, max: 5, dmg: p.dmg * .3, tick: .2 }); if (Math.hypot(P.x - p.x, P.y - p.y) < 18) hurtPlayer(p.dmg * .7, p); }
      else { p.h = 3; p.fuse -= dt; if (Math.random() < .5) { part(p.x + 2, p.y, 9, rnd(-10, 10), 0, rnd(10, 30), '#ffd24a', .2, 1, 0, 1); sfx('fuse'); } if (p.fuse <= 0) { p.life = 0; explode(p.x, p.y, 30, p.dmg, 'e'); } }
      continue;
    }
    if (p.k === 'meteor') {
      if (p.delay > 0) { p.delay -= dt; continue; }
      p.h -= 260 * dt; if (Math.random() < .7) part(p.x + rnd(-2, 2), p.y, p.h + 4, rnd(-10, 10), 0, 20, pick(['#ffb03a', '#ff6a2a']), .3, 1, 0, 1);
      if (p.h <= 0) { p.life = 0; explode(p.x, p.y, 30 * (1 + mod('muRad')), p.w.dmg * 2.4 * (1 + mod('muDmg')), 'p', { burn: true, sk: p.w.sk, w: p.w }); }
      continue;
    }
    p.x += p.vx * dt; p.y += p.vy * dt; p.life -= dt;
    if (p.k === 'fire') p.h = lerp(3, p.h0, p.life / p.max);
    const out = p.x < BD.x0 - 6 || p.x > BD.x1 + 6 || p.y < BD.y0 - 8 || p.y > BD.y1 + 6;
    if (out || (p.life <= 0 && p.k === 'fireball')) { p.life = 0; projHitEnd(p); if (out && p.k !== 'fireball') burst(p.x, p.y, p.h, p.k === 'arrow' ? '#c8b88a' : '#b07af0', 3, 30); continue; }
    const ob = obs.find(o => o.solid && !o.dead && Math.hypot(o.x - p.x, o.y - p.y) < o.r + 2);
    if (ob && p.k !== 'fire') { p.life = 0; if (ob.k !== 'col' && (p.from === 'p' || p.k === 'rock')) hitObs(ob, 1, p.vx / 260, p.vy / 260); projHitEnd(p); burst(p.x, p.y, p.h, p.k === 'arrow' ? '#c8b88a' : '#b07af0', 4, 40); continue; }
    if (p.k === 'orb' && Math.random() < .5) part(p.x, p.y, p.h, 0, 0, 0, p.fxn === 'plant' ? '#7ae07a' : p.fxn === 'waterorb' ? '#bfefff' : '#c060ff', .3, 1, 0, 1);
    if (p.k === 'bolt' && Math.random() < .4) part(p.x, p.y, p.h, 0, 0, 0, '#c8a0ff', .25, 1, 0, 1);
    if ((p.k === 'arrow' || p.k === 'knife') && p.w && p.w.burn && Math.random() < .3) part(p.x, p.y, p.h, 0, 0, 0, '#ff8a3a', .2, 1, 0, 1);
    if (p.from === 'p') {
      for (const e of enemies) {
        if (e.st === 'spawn' || e.dead || p.hit.has(e) || e.under > 0 || e.fade > .6) continue;
        if (Math.hypot(e.x - p.x, e.y - p.y) < e.r * e.sc + p.r + 2 && !(e.ai === 'swoop' && e.z > 18 && p.k !== 'arrow')) {
          p.hit.add(e); const n = Math.hypot(p.vx, p.vy) || 1;
          if (p.k === 'fireball') { p.life = 0; projHitEnd(p); break; }
          weaponHit(e, p.w, p.mul, p.vx / n, p.vy / n, 1);
          if (p.k === 'bolt') fxAnim('splash', p.x, p.y - p.h, { sc: .5, dur: .25 });
          if (!p.pierce) { p.life = 0; break; }
        }
      }
    } else if (state === 'play' && Math.hypot(P.x - p.x, P.y - p.y) < P.r + p.r) {
      if (P.wall > 0 && mod('k3Reflect') && p.k !== 'fire') { p.from = 'p'; p.vx *= -1.2; p.vy *= -1.2; p.life = 1.5; p.hit = new Set(); p.w = P.wallW || playerW(); p.mul = 1.5; sfx('deflect'); continue; }
      hurtPlayer(p.dmg, p.src || p); if (p.slow) P.slowT = 1.5; p.life = 0; burst(p.x, p.y, p.h, p.k === 'fire' ? '#ff8a3a' : '#b07af0', 6, 40, 1);
    }
  }
  projs = projs.filter(p => p.life > 0);
}
function projHitEnd(p) {
  if (p.k !== 'fireball' || p.ended) return; p.ended = true;
  const R = 26 * (1 + mod('m1Rad'));
  explode(p.x, p.y, R, p.w.dmg * p.mul, 'p', { burn: mod('m1Burn') > 0 || Math.random() < .3 + mod('burn'), sk: p.w.sk, w: p.w });
  if (p.split) for (let k = 0; k < 3; k++) { const a = k / 3 * 6.283 + rnd(0, 1); projs.push({ k: 'fireball', fxn: 'fireball', x: p.x, y: p.y, h: 8, vx: Math.cos(a) * 150, vy: Math.sin(a) * 150, life: .35, max: .35, from: 'p', r: 4, pierce: false, hit: new Set(), w: p.w, mul: p.mul * .45, split: false }); }
}
function spikeUp(s) { if (G && G.spikeRush > 0) return true; const c = (T + s.ph) % 3; return c > 2.15; }
function spikeFrame(s) { if (G && G.spikeRush > 0) return 3; const c = (T + s.ph) % 3; return c < 2 ? 0 : c < 2.08 ? 1 : c < 2.15 ? 2 : 3; }
function updSpikes() {
  for (const s of spikes) {
    const cyc = G.spikeRush > 0 ? -2 : Math.floor((T + s.ph) / 3); if (cyc !== s.cyc) { s.cyc = cyc; s.hit = new Set(); s.snd = false; }
    if (!spikeUp(s)) continue;
    if (!s.snd) { s.snd = true; if (Math.abs(s.x + 8 - P.x) < VW && Math.abs(s.y - P.y) < VH) sfx('spike'); }
    const inside = (x, y) => x > s.x + 1 && x < s.x + 15 && y > s.y + 2 && y < s.y + 16;
    if (state === 'play' && !s.hit.has(P) && P.z < 2 && inside(P.x, P.y)) { s.hit.add(P); hurtPlayer(6 + stageNum() * 2, null); }
    for (const e of enemies) if (!e.dead && e.st !== 'spawn' && !s.hit.has(e) && e.z < 4 && inside(e.x, e.y)) { s.hit.add(e); hurtEnemy(e, Math.round(e.maxHp * (G.spikeRush > 0 ? .25 : .12) + 3), 0, 0, 0, false, true); }
  }
  for (const h of hazards) { h.life -= dt0; h.tick -= dt0; if (h.tick <= 0 && Math.hypot(P.x - h.x, (P.y - h.y) * 1.6) < h.r + P.r && P.z < 2) { h.tick = .5; hurtPlayer(h.dmg, null); if (h.k === 'gift') P.slowT = Math.max(P.slowT, .7); } }
  hazards = hazards.filter(h => h.life > 0);
}
let dt0 = 0;
function updPickups(dt) {
  for (const c of pickups) {
    c.t += dt; c.z += c.vz * dt; c.vz -= 260 * dt; if (c.z < 0) { c.z = 0; c.vz = Math.abs(c.vz) > 20 ? -c.vz * .4 : 0; c.vx *= .5; c.vy *= .5; }
    c.x += c.vx * dt; c.y += c.vy * dt; c.vx *= Math.pow(.05, dt); c.vy *= Math.pow(.05, dt);
    c.x = clamp(c.x, BD.x0, BD.x1); c.y = clamp(c.y, BD.y0, BD.y1);
    const dx = P.x - c.x, dy = P.y - c.y, d = Math.hypot(dx, dy) || 1;
    const magR = c.k === 'loot' ? 0 : 48;
    if (state === 'play' && (d < magR || c.mag) && c.t > .3) { const sp = c.mag ? 260 : 170; c.x += dx / d * sp * dt; c.y += dy / d * sp * dt; }
    if (state === 'play' && d < (c.k === 'loot' ? 10 : 8) && c.t > .4) {
      if (hookVal('collect', false, c)) continue; // ein System nimmt die Beute selbst (Verlorene Lande: in den Rucksack)
      c.got = true;
      if (c.k === 'coin') { P.gold += c.v; stat('goldTotal', c.v); sfx('coin'); part(c.x, c.y, 4, 0, 0, 40, '#e8b04a', .3, 1, 0, 1); }
      else if (c.k === 'heart') { const h = Math.round(P.st.hp * .15); P.hp = Math.min(P.st.hp, P.hp + h); txt(P.x, P.y - 24, '+' + h, '#79c24e'); sfx('heal'); }
      else if (c.k === 'flask') { P.potions = Math.min(potMax(), P.potions + 1); toast(_t('Heiltrank +1')); sfx('heal'); }
      else if (c.k === 'mat') { gainMat(c.m, c.n); txt(P.x, P.y - 22, '+' + c.n + ' ' + MATS[c.m].n, MATS[c.m].c); sfx('coin'); }
      else if (c.k === 'gem') { gainGem(c.g); const [id, gr] = c.g.split(':'); toast(_t('{grade} {gem}', { grade: GEMGRADE[+gr], gem: GEMS[id].n }) + '!', GEMS[id].c); sfx('loot'); }
      else if (c.k === 'loot') pickItem(c.it);
    }
  }
  pickups = pickups.filter(c => !c.got);
}
function pickItem(it) {
  hook('pickup', it);
  sfx(it.rar === 6 ? 'myth' : 'loot'); if (it.rar === 4) stat('legs'); if (it.rar === 6) { statMax('myths', 1); banner(_t('MYTHISCH!'), _t(it.name)); }
  const cur = P.gear[it.slot];
  if (canEquip(it) && (!cur || itemScore(it) > itemScore(cur) * 1.05) && (!cur || !cur.set || it.set)) {
    P.gear[it.slot] = it; if (cur) addToBag(cur); computeStats(); P.hp = Math.min(P.hp, P.st.hp);
    toast(_t('{rar}: {item} angelegt', { rar: RAR[it.rar].n.toLocaleUpperCase(LOCALE), item: itemName(it) }), RAR[it.rar].c);
    if (it.set && setCount(it.set) >= 3) stat('fullset');
  } else {
    const g = addToBag(it);
    toast(g ? _t('Beutel voll – für {gold} Gold verkauft', { gold: g }) : _t('{rar}: {item} (Beutel)', { rar: RAR[it.rar].n.toLocaleUpperCase(LOCALE), item: itemName(it) }), RAR[it.rar].c);
  }
  for (let i = 0; i < 20; i++) part(P.x, P.y, rnd(0, 16), rnd(-30, 30), rnd(-15, 15), rnd(30, 80), RAR[it.rar].c, rnd(.4, .8), 1, 80, 1);
  updWeaponUI();
}
function updParts(dt) {
  for (const p of parts) { p.life -= dt; p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt; p.vz -= p.g * dt; if (p.z < 0 && p.g > 0) { p.z = 0; p.vz *= -.3; p.vx *= .5; p.vy *= .5; } }
  parts = parts.filter(p => p.life > 0); if (parts.length > 900) parts.splice(0, parts.length - 900);
  for (const t of texts) { t.life -= dt; t.y -= (t.big ? 22 : 16) * dt; }
  texts = texts.filter(t => t.life > 0);
  for (const r of rings) { r.life -= dt; r.r = lerp(r.max, 4, r.life / r.max2); }
  rings = rings.filter(r => r.life > 0);
  for (const f of fx) { f.life -= dt; if (f.follow) { f.x = P.x; f.y = P.y - 8; } }
  fx = fx.filter(f => f.life > 0);
  for (const g of ghosts) g.life -= dt; ghosts = ghosts.filter(g => g.life > 0);
  for (const c of corpses) {
    c.life -= dt; c.x += c.vx * dt; c.y += c.vy * dt; c.z += c.vz * dt; c.vz -= 320 * dt; if (c.z < 0) { c.z = 0; c.vz = 0; c.vx *= .6; c.vy *= .6; } c.rot += c.vr * dt * (c.z > 0 ? 1 : .2);
    if (c.life <= 0) { burst(c.x, c.y, 4, c.blood || '#b8302a', 8, 40); burst(c.x, c.y, 4, '#4a4058', 6, 30); if (c.boss) for (let i = 0; i < 5; i++) setTimeout(() => { if (G && state === 'play') explode(c.x + rnd(-20, 20), c.y + rnd(-12, 12), 24, 0, 'p'); }, i * 120); }
  }
  corpses = corpses.filter(c => c.life > 0);
}
function ambient(dt) {
  if (!G || !bg) return; G.ambT -= dt; if (G.ambT > 0) return; G.ambT = .14;
  const k = bg.b.key, x = cam.x + rnd(0, VW), y = cam.y + rnd(WALL, VH);
  if (k === 'moss') parts.push({ x, y, z: rnd(6, 24), vx: rnd(-6, 6), vy: rnd(-4, 4), vz: rnd(-2, 2), g: 0, col: '#c8f06a', life: 3, max: 3, s: 1, glow: 1, blink: 1 });
  else if (k === 'gruft') parts.push({ x, y, z: rnd(4, 30), vx: rnd(-3, 3), vy: rnd(-2, 2), vz: rnd(-1, 1), g: 0, col: '#9a94a6', life: 3, max: 3, s: 1 });
  else if (k === 'glut') parts.push({ x, y: cam.y + VH + 4, z: 0, vx: rnd(-5, 5), vy: rnd(-40, -25), vz: rnd(0, 4), g: 0, col: Math.random() < .5 ? '#ff8a3a' : '#ffd24a', life: 4, max: 4, s: 1, glow: 1 });
  else parts.push({ x, y, z: rnd(4, 30), vx: rnd(-3, 3), vy: rnd(-2, 2), vz: rnd(-1, 1), g: 0, col: '#8a7a6a', life: 3, max: 3, s: 1 });
}
