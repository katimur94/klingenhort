'use strict';
/* =========================================================
   KLINGENHORT – Welt: Arenen, Räume, Weltkarte
   ========================================================= */

let AW = 528, AH = 352, BD = { x0: 22, x1: 506, y0: WALL + 8, y1: 332 };
let bg = null, vig = null, dark = null, G = null;
let enemies = [], projs = [], parts = [], pickups = [], texts = [], rings = [], obs = [], spikes = [], corpses = [], ghosts = [], fx = [], hazards = [], allies = [], traps = [];
const cam = { x: 0, y: 0 }, shk = { m: 0, x: 0, y: 0 };

function biomeOf(act) { return BIOMES[(act - 1) % 4]; }
function qualOf(act) { return Math.max(0, act - 4); }
function stageNum() { if (G && G.daily) return G.dstage; const row = (G && G.row != null) ? G.row : (P.map && P.map.pos ? Math.max(0, P.map.pos.r) : 0); return (P.act - 1) * 7 + row + 1; }

/* ---------- Arena-Grafik ---------- */
const FLOORS = [[16, 64], [32, 64], [48, 64], [16, 80], [32, 80], [48, 80], [16, 96], [32, 96]];
function genBg(act, seed) {
  const b = biomeOf(act), c = mk(AW, AH), g = c.getContext('2d'), R = mulberry(seed);
  const fountains = [], torches = [];
  for (let y = WALL; y < AH; y += 16) for (let x = 0; x < AW; x += 16) { const r0 = R(), f = r0 < .84 ? FLOORS[0] : r0 < .96 ? FLOORS[1 + Math.floor(R() * 4)] : FLOORS[5 + Math.floor(R() * 3)]; g.drawImage(SHEET, f[0], f[1], 16, 16, x, y, 16, 16); }
  for (let x = 0; x < AW; x += 16) { g.drawImage(SHEET, 32, 0, 16, 16, x, 0, 16, 16); g.drawImage(SHEET, 32, 16, 16, 16, x, 16, 16, 16); }
  for (let x = 32; x < AW - 32; x += 16) {
    const r = R();
    if (r < .07) { const bn = [[16, 32], [32, 32], [16, 48], [32, 48]][Math.floor(R() * 4)]; g.drawImage(SHEET, bn[0], bn[1], 16, 16, x, 16, 16, 16); }
    else if (r < .11) g.drawImage(SHEET, 48, R() < .5 ? 32 : 48, 16, 16, x, 16, 16, 16);
    else if (r < .15 && b.key === 'moss') { g.drawImage(SHEET, 64, 80, 16, 16, x, 16, 16, 16); g.drawImage(SHEET, 64, 96, 16, 16, x, 32, 16, 16); }
    else if (r < .18) { g.drawImage(SHEET, 64, 0, 16, 16, x, 0, 16, 16); fountains.push({ x, red: b.key === 'glut' || (b.key === 'kerker' && R() < .5) }); }
    else if (r < .3) torches.push(x + 8);
  }
  for (let x = 0; x < AW; x += 16) g.drawImage(SHEET, 32, 0, 16, 16, x, AH - 16, 16, 16);
  for (let y = 0; y < AH; y += 16) { g.drawImage(SHEET, 16, 0, 16, 16, 0, y, 16, 16); g.drawImage(SHEET, 48, 0, 16, 16, AW - 16, y, 16, 16); }
  const N = Math.floor(AW * AH / 2600);
  for (let i = 0; i < N; i++) {
    const x = Math.floor(16 + R() * (AW - 40)), y = Math.floor(WALL + 8 + R() * (AH - WALL - 32)), r = R();
    if (b.key === 'gruft' && r < .35) g.drawImage(SHEET, 288, 432, 16, 16, x, y, 16, 16);
    else if (b.key === 'moss' && r < .4) { g.fillStyle = 'rgba(60,140,50,.35)'; g.beginPath(); g.ellipse(x, y, 6 + R() * 8, 2 + R() * 3, 0, 0, 7); g.fill(); }
    else if (b.key === 'glut' && r < .4) { let cx = x, cy = y; for (let k = 0; k < 12; k++) { px(g, cx, cy, 2, 1, '#1a0e0c'); px(g, cx, cy, 1, 1, '#ff6a2a'); cx += Math.floor(R() * 3 - 1); cy += Math.floor(R() * 2); } }
    else if (r < .1) g.drawImage(SHEET, 288, 432, 16, 16, x, y, 16, 16);
  }
  const d = g.getImageData(0, 0, AW, AH), p = d.data, [tr, tg, tb] = b.tint;
  if (tr !== 1 || tg !== 1 || tb !== 1) for (let i = 0; i < p.length; i += 4) { if (p[i] === 255 && p[i + 1] > 100 && p[i + 2] < 80) continue; p[i] = Math.min(255, p[i] * tr); p[i + 1] = Math.min(255, p[i + 1] * tg); p[i + 2] = Math.min(255, p[i + 2] * tb); }
  g.putImageData(d, 0, 0);
  g.fillStyle = 'rgba(0,0,0,.35)'; g.fillRect(16, WALL, AW - 32, 4);
  return { c, b, fountains, torches };
}
function makeVig() { vig = mk(VW, VH, g => { const gr = g.createRadialGradient(VW / 2, VH / 2, Math.min(VW, VH) * .35, VW / 2, VH / 2, Math.max(VW, VH) * .75); gr.addColorStop(0, 'rgba(8,6,12,0)'); gr.addColorStop(1, 'rgba(8,6,12,.55)'); g.fillStyle = gr; g.fillRect(0, 0, VW, VH); }); dark = mk(VW, VH); }
function prepArena(act, seed) {
  AW = Math.ceil(Math.max(528, VW + 64) / 16) * 16; AH = Math.ceil(Math.max(352, VH + 64) / 16) * 16;
  BD = { x0: 22, x1: AW - 22, y0: WALL + 8, y1: AH - 20 };
  bg = genBg(act, seed); obs = []; spikes = []; hazards = []; traps = [];
}
function freeSpot(r, avoidCenter) {
  for (let k = 0; k < 40; k++) {
    const x = rnd(BD.x0 + 20, BD.x1 - 20), y = rnd(BD.y0 + 16, BD.y1 - 10);
    if (avoidCenter && Math.hypot(x - AW / 2, y - (BD.y0 + BD.y1) / 2) < 60) continue;
    if (obs.some(o => Math.hypot(o.x - x, o.y - y) < o.r + r + 14)) continue;
    return { x, y };
  }
  return null;
}
function placeProps(type, stage, R) {
  const cols = 2 + Math.floor(R() * 3);
  for (let i = 0; i < cols; i++) { const s = freeSpot(8, true); if (s) obs.push({ k: 'col', x: s.x, y: s.y, r: 7, solid: true }); }
  const crates = type === 'schatz' ? 6 : 3 + Math.floor(R() * 4);
  for (let i = 0; i < crates; i++) { const s = freeSpot(6, true); if (s) obs.push({ k: R() < .3 ? 'xcrate' : 'crate', x: s.x, y: s.y, r: 6, hp: 1, solid: true, flash: 0, vx: 0, vy: 0 }); }
  const chests = type === 'schatz' ? 3 : (R() < .4 ? 1 : 0);
  for (let i = 0; i < chests; i++) { const s = freeSpot(6, true); if (s) obs.push({ k: 'chest', x: s.x, y: s.y, r: 6, solid: true, mimic: stage >= 3 && R() < (type === 'schatz' ? .3 : .18), open: 0 }); }
  const veins = type === 'schatz' ? 3 : (R() < .7 ? 1 + Math.floor(R() * 2) : 0);
  for (let i = 0; i < veins; i++) { const s = freeSpot(7, true); if (s) obs.push({ k: 'vein', mat: bg.b.vein, x: s.x, y: s.y, r: 7, hp: 3, solid: true, flash: 0 }); }
  if (stage >= 2) {
    const cnt = 2 + Math.floor(R() * Math.min(8, stage / 2));
    for (let i = 0; i < cnt; i++) { const s = freeSpot(8, true); if (s) spikes.push({ x: Math.floor(s.x / 16) * 16, y: Math.floor(s.y / 16) * 16, ph: R() * 3, hit: new Set(), cyc: -1 }); }
    if (cnt >= 3 && R() < .6) obs.push({ k: 'lever', x: Math.floor(rnd(60, AW - 60)), y: BD.y0 + 2, r: 6, solid: false, on: false, cd: 0 });
  }
}

/* ---------- Gegner erzeugen ---------- */
function placeFar(e) {
  for (let k = 0; k < 40; k++) { const x = rnd(BD.x0 + 20, BD.x1 - 20), y = rnd(BD.y0 + 10, BD.y1 - 10); if (Math.hypot(x - P.x, y - P.y) > 110 && !obs.some(o => o.solid && !o.dead && Math.hypot(o.x - x, o.y - y) < o.r + 12)) { e.x = x; e.y = y; return; } }
  e.x = rnd(BD.x0 + 20, BD.x1 - 20); e.y = BD.y0 + 12;
}
function scaleOf(stage) {
  const D = DIFFS[P.diff], q = qualOf(P.act), qm = Math.pow(1.3, q);
  const curse = mod('curse') ? 1.5 : 1;
  return { hm: (1 + (stage - 1) * .36) * D.hp * qm * curse, am: (1.25 + (stage - 1) * .2) * D.dmg * Math.pow(qm, .8), rm: 1 + (stage - 1) * .16 };
}
function spawnEnemy(type, o) {
  o = o || {}; const D = EN[type], stage = stageNum(), S = scaleOf(stage);
  const e = { t: type, def: D, sp: D.sp, ai: D.ai, x: 0, y: 0, z: 0, kbx: 0, kby: 0, r: D.r, sc: o.sc || 1, mass: D.mass || 1, st: o.instant ? 'move' : 'spawn', stT: .7, cd: rnd(.4, 1.3), turn: 1, face: 1, phase: rnd(0, 6), squash: 0, flash: 0, stun: 0, freeze: 0, seed: rnd(0, 9), spd: D.spd * rnd(.9, 1.1), reach: D.reach || 14, strafe: Math.random() < .5 ? 1 : -1, orb: rnd(0, 6.28), tcd: 0, sum: 0, casts: 0, elite: !!o.elite, boss: !!o.boss, name: o.name || D.name, alpha: o.instant ? null : 0, lean: 0, aim: 0, windDur: .5, moving: false, tint: o.tint || null, burn: 0, burnT: 0, burnDmg: 0, poison: 0, poisonT: 0, poisonDmg: 0, affixes: [], armor: 0, armorMax: 0, armorT: 0, healT: 2, telT: 3, trailT: 0, cdMul: 1, life: 0 };
  let hp = D.hp * S.hm, atk = D.atk * S.am;
  if (e.elite) {
    hp *= 2.2; atk *= 1.35; e.sc *= 1.15;
    const [a, b] = DIFFS[P.diff].affix, n = ri(a, b) + (qualOf(P.act) >= 3 ? 1 : 0);
    e.affixes = Object.keys(AFFIX).sort(() => Math.random() - .5).slice(0, n);
    if (G && G.daily && G.dmod) e.affixes = [...new Set(e.affixes.concat(G.dmod))];
  } else if (G && G.daily && G.dmod && Math.random() < .3) e.affixes = G.dmod.slice();
  if (e.boss) { hp *= o.hpMul || 1; atk *= 1.15; e.mass = Math.max(e.mass, 6); }
  for (const a of e.affixes) {
    if (a === 'schnell') { e.spd *= 1.6; e.cdMul = .7; }
    if (a === 'riese') { e.sc *= 1.3; hp *= 1.6; e.mass *= 2; }
    if (a === 'gepanzert') { e.armorMax = e.armor = hp * .6; }
  }
  e.hp = e.maxHp = Math.round(hp); e.atk = atk;
  e.xp = Math.round(D.xp * S.rm * (e.elite ? 2.5 : 1) * (e.boss ? 8 : 1));
  e.gold = Math.round(D.gold * S.rm * (e.elite ? 2.2 : 1) * (e.boss ? 6 : 1));
  if (D.ai === 'swoop') e.z = 14;
  if (o.x != null) { e.x = o.x; e.y = o.y; } else placeFar(e);
  e.face = P.x >= e.x ? 1 : -1; e.turn = e.face;
  if (!o.instant) { burst(e.x, e.y, 4, '#6a5a7a', 10, 30); fx.push({ k: 'portal', x: e.x, y: e.y, life: .7, max: .7 }); }
  enemies.push(e); return e;
}
function poolFor(stage) { return Object.keys(EN).filter(k => !EN[k].boss && EN[k].from <= Math.max(stage, 1)); }
function buildWave(stage, budget) {
  const pool = poolFor(stage), list = [];
  while (budget > .9 && list.length < 18) { const opts = pool.filter(k => EN[k].cost <= budget + .5); if (!opts.length) break; const k = pick(opts); list.push(k); budget -= EN[k].cost; }
  return list;
}

/* ---------- Räume ---------- */
function startRoom(type, row, extra) {
  extra = extra || {};
  const stage = extra.daily ? extra.dstage : (P.act - 1) * 7 + row + 1;
  G = { type, row, stage, waves: [], wi: -1, pending: [], phase: 'gap', t: 1.6, ambT: 0, timer: 0, dark: 0, lootMul: 1, spawnT: 0, spikeRush: 0, goldgob: null, startTime: T, kills: 0, extra, daily: extra.daily || null, dstage: extra.dstage || 0, dmod: extra.dmod || null };
  const seed = (P.created % 100000) + P.act * 977 + row * 131 + Math.floor(Math.random() * 9999);
  enemies = []; projs = []; parts = []; pickups = []; texts = []; rings = []; corpses = []; ghosts = []; fx = []; allies = [];
  prepArena(P.act, seed); placeProps(type, stage, mulberry(seed + 7));
  P.x = AW / 2; P.y = (BD.y0 + BD.y1) / 2; P.vx = P.vy = 0; P.atkT = 0; P.roll = 0; P.rollA = 0; P.inv = 1.2; P.spin = 0; P.leap = null; P.dash = null; P.volley = 0; P.z = 0; P.chain = 0; P.wall = 0; P.stealth = 0; P.cds = [0, 0, 0];
  const st = stageNum(), base = 4 + st * 1.4;
  if (type === 'kampf' || type === 'dunkel') { const n = Math.min(4, 2 + Math.floor(st / 6)); for (let w = 0; w < n; w++) G.waves.push({ list: buildWave(st, base + w * 1.3) }); }
  if (type === 'dunkel') { G.dark = .9; G.lootMul = 1.6; }
  if (type === 'elite') { G.waves.push({ list: buildWave(st, base * .6), elites: 1 + (st >= 10 ? 1 : 0) + (P.diff === 'hell' ? 1 : 0) }); G.lootMul = 1.5; }
  if (type === 'ueberleben') { G.timer = 45; G.waves.push({ list: buildWave(st, base * .5) }); }
  if (type === 'goblin') { G.waves.push({ list: buildWave(st, base * .4), goblin: 1 }); }
  if (type === 'schatz') { G.waves.push({ list: [] }); G.t = .8; }
  if (type === 'rescue') { G.waves.push({ list: buildWave(st, base) }); G.waves.push({ list: buildWave(st, base * .8), elites: 1 }); }
  if (type === 'cursed') { G.waves.push({ list: buildWave(st, base * .5), elites: 2 }); G.lootMul = 2; }
  if (type === 'boss') { G.waves.push({ list: buildWave(st, base) }); const B = BOSSES[(P.act - 1) % 4]; const minions = []; for (let i = 0; i < Math.min(6, 1 + Math.floor(st / 6)); i++) minions.push(pick(poolFor(st).slice(0, 4))); G.waves.push({ boss: B, list: minions }); }
  if (G.daily) G.lootMul = 1.5;
  cam.x = clamp(P.x - VW / 2, 0, Math.max(0, AW - VW)); cam.y = clamp(P.y - VH / 2, 0, Math.max(0, AH - VH));
  const b = biomeOf(P.act); setMusic(b.root, false);
  const label = G.daily ? 'TAGES-HERAUSFORDERUNG' : NODE[type] ? NODE[type].n.toUpperCase() : type === 'rescue' ? 'BEFREIUNG' : 'VERFLUCHTE TRUHE';
  banner(label, (G.daily ? 'Raum ' + (G.daily.i + 1) + ' / ' + G.daily.rooms.length : 'Akt ' + P.act + (qualOf(P.act) ? ' · Qual ' + qualOf(P.act) : '') + ' · ' + b.name + ' · Stufe ' + st) + (type === 'ueberleben' ? ' · Überlebe 45 s' : type === 'goblin' ? ' · Schnapp den Schatzgoblin!' : ''));
  $('bossbar').hidden = true; $('objective').textContent = '';
  setState('play'); showHud(true); hideOverlay();
  for (const bf of P.buffs) bf.rooms--;
}
function queueWave() {
  const W = G.waves[G.wi]; let d = .2;
  if (W.boss) { G.pending.push({ t: .6, type: W.boss.type, boss: W.boss }); banner('BOSS', W.boss.name); d = 1.4; $('bossName').textContent = W.boss.name.toUpperCase(); setMusic(biomeOf(P.act).root + 5, true); }
  if (W.goblin) G.pending.push({ t: .5, type: 'goldgob', goblin: true });
  for (let i = 0; i < (W.elites || 0); i++) G.pending.push({ t: d + i * .5, type: pick(poolFor(G.stage).slice(-4)), elite: true });
  const eliteP = DIFFS[P.diff].elite * (G.stage >= 3 ? 1 : 0);
  W.list.forEach((k, i) => G.pending.push({ t: d + .3 + i * .33, type: k, elite: Math.random() < eliteP }));
}
function updRoom(dt) {
  if (G.spikeRush > 0) G.spikeRush -= dt;
  if (G.phase === 'gap') { G.t -= dt; if (G.t <= 0) { G.wi++; queueWave(); G.phase = 'fight'; } return; }
  if (G.phase === 'fight') {
    for (const p of G.pending) {
      p.t -= dt;
      if (p.t <= 0 && !p.done) {
        p.done = true;
        if (p.boss) { const B = p.boss; spawnEnemy(B.type, { boss: true, sc: B.sc, hpMul: B.hpMul, name: B.name, tint: B.tint, x: AW / 2, y: BD.y0 + 34 }); shake(7); sfx('boom'); $('bossbar').hidden = false; }
        else if (p.goblin) { const e = spawnEnemy('goldgob', { tint: 'rgba(255,210,60,.45)' }); e.escape = 20; G.goldgob = e; }
        else spawnEnemy(p.type, { elite: p.elite });
      }
    }
    G.pending = G.pending.filter(p => !p.done);
    if (G.type === 'ueberleben') {
      G.timer -= dt; G.spawnT -= dt;
      $('objective').textContent = 'Überlebe ' + Math.max(0, Math.ceil(G.timer)) + ' s';
      if (G.spawnT <= 0 && enemies.length < 16 && G.timer > 3) { G.spawnT = Math.max(.7, 1.8 - G.stage * .03); const pool = poolFor(G.stage); spawnEnemy(pick(pool), { elite: Math.random() < .06 }); }
      if (G.timer <= 0) { for (const e of enemies.slice()) { burst(e.x, e.y, 6, '#6a5a7a', 10, 40); e.dead = true; } enemies = []; G.pending = []; roomClear(); }
      return;
    }
    if (G.goldgob && !G.goldgob.dead) { $('objective').textContent = 'Schatzgoblin: ' + Math.max(0, Math.ceil(G.goldgob.escape)) + ' s'; }
    else if (G.type === 'goblin') $('objective').textContent = '';
    const chestsLeft = G.type === 'schatz' && obs.some(o => o.k === 'chest' && !o.open && !o.dead);
    if (G.type === 'schatz') $('objective').textContent = chestsLeft ? 'Öffne alle Truhen' : '';
    if (!G.pending.length && !enemies.length && !chestsLeft) {
      if (G.wi < G.waves.length - 1) { G.phase = 'gap'; G.t = 1.4; banner('WELLE ' + (G.wi + 2) + ' / ' + G.waves.length, 'Neue Gegner nahen'); }
      else roomClear();
    }
  } else if (G.phase === 'clear') { G.t -= dt; for (const c of pickups) c.mag = 1; if (G.t <= 0) { G.phase = 'done'; afterRoom(); } }
}
function roomClear() {
  G.phase = 'clear'; G.t = 2.6; $('objective').textContent = '';
  const st = G.stage, bonus = Math.round((12 + st * 9) * (1 + P.st.gold) * (G.daily ? 1.5 : 1));
  P.gold += bonus; stat('goldTotal', bonus); P.stats.rooms++;
  txt(P.x, P.y - 30, '+' + bonus + ' GOLD', '#e8b04a', true);
  if (G.type === 'elite' || G.type === 'cursed') dropLoot(P.x + rnd(-20, 20), P.y + 10, G.type === 'cursed' ? 3 : 2);
  if (G.type === 'rescue') { dropLoot(P.x, P.y + 10, 2); gainGem(randomGem(st)); toast('Der Händler schenkt dir einen Edelstein!'); }
  banner('RAUM GESCHAFFT', 'Bonus: ' + bonus + ' Gold'); sfx('clear');
  P.buffs = P.buffs.filter(b => b.rooms > 0); computeStats();
  setMusic(biomeOf(P.act).root, false);
  saveChar();
}
function afterRoom() {
  if (G.daily) { dailyNext(); return; }
  const heal = DIFFS[P.diff].heal; P.hp = Math.min(P.st.hp, P.hp + P.st.hp * heal);
  if (G.type === 'boss') { actComplete(); return; }
  markNodeDone(); saveChar(); openMap();
}
function actComplete() {
  const B = BOSSES[(P.act - 1) % 4]; stat('boss_' + B.type);
  P.act++; P.maxAct = Math.max(P.maxAct, P.act); statMax('maxAct', P.act);
  P.map = null; P.hp = P.st.hp;
  saveChar(); checkAch();
  openActScreen();
}

/* ---------- Weltkarte ---------- */
function genMap(act) {
  const R = mulberry((P.created % 100000) + act * 7919 + P.rebirths * 31);
  const rows = [];
  const counts = [2 + (R() < .5 ? 1 : 0), 3, 3 + (R() < .4 ? 1 : 0), 3, 3 + (R() < .4 ? 1 : 0), 2 + (R() < .5 ? 1 : 0), 1];
  const W = { kampf: 30, elite: 13, ueberleben: 9, schatz: 7, goblin: 7, dunkel: 7, haendler: 9, schrein: 8, werkbank: 8, event: 10 };
  for (let r = 0; r < 7; r++) {
    const row = [];
    for (let i = 0; i < counts[r]; i++) {
      let t = r === 0 ? (i === 0 ? 'kampf' : wpick({ kampf: 3, schatz: 1, event: 1 }, R)) : r === 6 ? 'boss' : wpick(W, R);
      row.push({ t, links: [], done: false });
    }
    if (r === 3 && !row.some(n => n.t === 'werkbank')) row[Math.floor(R() * row.length)].t = 'werkbank';
    if (r === 5 && !row.some(n => n.t === 'haendler' || n.t === 'werkbank')) row[Math.floor(R() * row.length)].t = R() < .5 ? 'haendler' : 'werkbank';
    if (r === 2 && !row.some(n => n.t === 'haendler')) row[Math.floor(R() * row.length)].t = 'haendler';
    rows.push(row);
  }
  for (let r = 0; r < 6; r++) {
    const a = rows[r], b = rows[r + 1];
    a.forEach((n, i) => { const pos = (i + .5) / a.length * b.length - .5; const j = clamp(Math.round(pos), 0, b.length - 1); n.links.push(j); if (R() < .45) { const j2 = clamp(j + (pos > j ? 1 : -1), 0, b.length - 1); if (j2 !== j) n.links.push(j2); } });
    b.forEach((n, j) => { if (!a.some(m => m.links.includes(j))) { const i = clamp(Math.round((j + .5) / b.length * a.length - .5), 0, a.length - 1); a[i].links.push(j); } });
  }
  return { act, rows, pos: { r: -1, i: -1 } };
}
function availableNodes() {
  const M = P.map; if (M.pos.r < 0) return M.rows[0].map((n, i) => i);
  if (M.pos.r >= 6) return [];
  return M.rows[M.pos.r][M.pos.i].links;
}
function enterNode(i) {
  const M = P.map, r = M.pos.r + 1, n = M.rows[r][i];
  M.pos = { r, i }; M.cur = { r, i };
  saveChar();
  switch (n.t) {
    case 'haendler': openMerchant(); break;
    case 'schrein': openShrine(); break;
    case 'werkbank': P.hp = Math.min(P.st.hp, P.hp + P.st.hp * .5); openWorkbench(true); break;
    case 'event': openEvent(); break;
    default: startRoom(n.t, r);
  }
}
function resumeNode() {
  const n = P.map.rows[P.map.pos.r][P.map.pos.i];
  if (n.t === 'haendler') openMerchant(); else if (n.t === 'schrein') openShrine(); else if (n.t === 'werkbank') openWorkbench(true); else if (n.t === 'event') openEvent(); else openMap();
}
function markNodeDone() { const M = P.map; if (M && M.pos.r >= 0) M.rows[M.pos.r][M.pos.i].done = true; }
function nodeLeave() { markNodeDone(); saveChar(); openMap(); }

/* ---------- Tages-Herausforderung ---------- */
function dailySeed() { const d = new Date(); return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate(); }
function startDaily() {
  const seed = dailySeed(), R = mulberry(seed);
  const types = ['kampf', 'ueberleben', 'elite', 'goblin', 'boss'];
  const mods = Object.keys(AFFIX).sort(() => R() - .5).slice(0, 2);
  const dstage = Math.max(3, Math.min(40, P.lv + 2));
  P._dailyBackup = { act: P.act, map: JSON.parse(JSON.stringify(P.map)) };
  P.act = 1 + (seed % 4);
  const d = { seed, rooms: types, i: 0, mods, kills0: P.stats.kills, t0: T, dstage };
  startRoom(types[0], 0, { daily: d, dstage, dmod: mods });
}
function dailyNext() {
  const d = G.daily; d.i++;
  if (d.i >= d.rooms.length) {
    const time = T - d.t0, kills = P.stats.kills - d.kills0, score = Math.round(kills * 10 + Math.max(0, 600 - time) * 5 + d.dstage * 50);
    const key = String(d.seed), best = SAVE.meta.daily[key] || 0;
    if (score > best) SAVE.meta.daily[key] = score;
    stat('dailies'); P.gold += 300; gainGem(randomGem(d.dstage + 8));
    restoreFromDaily(); saveChar(); checkAch();
    openDailyResult(score, best, kills, time);
    return;
  }
  P.hp = Math.min(P.st.hp, P.hp + P.st.hp * .35);
  startRoom(d.rooms[d.i], 0, { daily: d, dstage: d.dstage + d.i, dmod: d.mods });
}
function restoreFromDaily() { if (P._dailyBackup) { P.act = P._dailyBackup.act; P.map = P._dailyBackup.map; delete P._dailyBackup; } }
