'use strict';
/* =========================================================
   KLINGENHORT – Charaktere, Gegenstände, Werte, Werkbank
   ========================================================= */

let P = null; // aktiver Charakter (gespeicherte Felder + Laufzeit-Felder)
const PERSIST = ['id', 'name', 'cls', 'diff', 'hc', 'lv', 'xp', 'gold', 'potions', 'sp', 'talents', 'paragon', 'pxp', 'pp', 'gear', 'bag', 'mats', 'gems', 'dyes', 'dye', 'act', 'map', 'rebirths', 'buffs', 'stats', 'created', 'dead', 'maxAct', 'res', 'rage'];

function newChar(cls, name, diff, hc) {
  const C = CLASSES[cls];
  return {
    id: uid(), name: name || C.name, cls, diff: diff || 'normal', hc: !!hc,
    lv: 1, xp: 0, gold: 40, potions: 3, sp: 0, talents: {}, paragon: 0, pxp: 0, pp: { dmg: 0, hp: 0, def: 0, crit: 0 },
    gear: { weapon: makeItem({ slot: 'weapon', base: C.start, tier: 0, rar: 0 }), armor: makeItem({ slot: 'armor', base: 'armor', tier: 0, rar: 0 }), helm: makeItem({ slot: 'helm', base: 'helm', tier: 0, rar: 0 }) },
    bag: [], mats: {}, gems: {}, dyes: ['natur'], dye: 'natur', act: 1, map: null, rebirths: 0, buffs: [],
    stats: { kills: 0, deaths: 0, rooms: 0, playtime: 0 }, created: Date.now(), dead: false, maxAct: 1, res: 100, rage: 0
  };
}
function activateChar(i) {
  SAVE.active = i; const c = SAVE.chars[i];
  P = Object.assign(newRuntime(), JSON.parse(JSON.stringify(c)));
  for (const k of ['talents', 'pp', 'mats', 'gems', 'stats']) if (!P[k]) P[k] = {};
  if (!P.pp.dmg && P.pp.dmg !== 0) P.pp = { dmg: 0, hp: 0, def: 0, crit: 0 };
  if (!Array.isArray(P.buffs)) P.buffs = [];
  computeStats(); P.hp = P.st.hp; P.res = P.st.resMax;
}
function newRuntime() { return { x: 0, y: 0, z: 0, vx: 0, vy: 0, r: 5, turn: 1, face: 1, aim: 0, phase: 0, squash: 0, flash: 0, lean: 0, moving: false, hp: 1, atkT: 0, atkDur: 1, atkCd: 0, hitSet: null, struck: false, inv: 0, roll: 0, rollCd: 0, rdx: 1, rdy: 0, rollA: 0, hand: null, combo: 0, comboT: 0, chain: 0, chainT: 0, spin: 0, spinA: 0, spinTick: 0, leap: null, dash: null, volley: 0, volleyT: 0, ghostT: 0, cds: [0, 0, 0], potCd: 0, wall: 0, stealth: 0, poisonT: 0, slowT: 0, st: null }; }
function saveChar() {
  if (!P || SAVE.active < 0) return;
  const o = {}; for (const k of PERSIST) o[k] = P[k];
  SAVE.chars[SAVE.active] = JSON.parse(JSON.stringify(o));
  persist();
}

/* ---------- Gegenstände ---------- */
function makeItem(o) {
  const rar = o.rar || 0, isW = o.slot === 'weapon';
  const it = { uid: uid(), slot: o.slot, base: isW ? o.base : o.slot, tier: clamp(o.tier || 0, 0, 4), rar, up: 0, aff: {}, sockets: 0, gems: [], set: o.set || null, name: null, suf: null };
  rollAffixes(it);
  const sk = RAR[rar].sock; it.sockets = ri(sk[0], sk[1]);
  if (o.set) it.name = SETS[o.set].pieces[o.slot];
  else if (rar === 4) it.name = pick(LEGEND[isW ? it.base : it.slot]);
  return it;
}
function rollAffixes(it) {
  const pool = it.slot === 'weapon' ? AFFW : AFFA, n = RAR[it.rar].aff;
  const keys = Object.keys(pool).sort(() => Math.random() - .5).slice(0, n);
  it.aff = {}; for (const k of keys) it.aff[k] = +pool[k].f(it.rar).toFixed(3);
  it.suf = keys.length && it.rar < 4 && !it.set ? pool[keys[0]].suf : null;
}
function itemName(it, cls) {
  cls = cls || (P && P.cls) || 'knight';
  let base = it.name;
  if (!base) base = it.slot === 'weapon' ? WT[it.base].names[it.tier] : CLASSES[cls].names[it.tier][it.slot === 'armor' ? 0 : 1];
  if (!it.name && it.suf) base += ' ' + it.suf;
  return base + (it.up ? ' +' + it.up : '');
}
function itemColor(it) { return RAR[it.rar].c; }
function weaponDmg(it) { return WT[it.base].dmg * TMUL[it.tier] * RAR[it.rar].m * (1 + it.up * .08); }
function armorDef(it) { return AR[it.slot].def[it.tier] * RAR[it.rar].m * (1 + it.up * .1); }
function armorHp(it) { return AR[it.slot].hp[it.tier] * (1 + it.up * .1); }
function itemLines(it) {
  const L = [];
  if (it.slot === 'weapon') L.push('Schaden ' + Math.round(weaponDmg(it) * (1 + (it.aff.wucht || 0))));
  else L.push('VER ' + Math.round(armorDef(it)) + (armorHp(it) ? ' · LP +' + Math.round(armorHp(it)) : ''));
  const pool = it.slot === 'weapon' ? AFFW : AFFA;
  for (const k in it.aff) L.push(pool[k].s(it.aff[k]));
  for (const g of it.gems) { const [id, gr] = g.split(':'); L.push(GEMGRADE[+gr] + ' ' + GEMS[id].n + ': ' + GEMS[id].s(GEMS[id].v[+gr])); }
  if (it.sockets > it.gems.length) L.push('◇'.repeat(it.sockets - it.gems.length) + ' freie Sockel');
  if (it.set) { const S = SETS[it.set], have = setCount(it.set); L.push(S.n + ' (' + have + '/3): 2 – ' + S.d2 + '; 3 – ' + S.d3); }
  return L;
}
function itemPrice(it) { return Math.max(8, Math.round(PRICE[it.tier] * .22 * (1 + it.rar * .6) * (1 + it.up * .3))); }
function itemScore(it) {
  if (it.slot === 'weapon') return weaponDmg(it) * (1 + (it.aff.wucht || 0)) * (1 + (it.aff.krit || 0)) * (1 + (it.aff.tempo || 0)) * (1 + it.gems.length * .05);
  return armorDef(it) * 2 + armorHp(it) * .5 + (it.aff.leben || 0) * 120 + (it.aff.panzer || 0) * 2 + (it.aff.schutz || 0) * 200 + it.gems.length * 6;
}
function randomItem(stage, minRar, o) {
  o = o || {};
  const C = CLASSES[P.cls];
  const slot = o.slot || wpick({ weapon: .45, armor: .3, helm: .25 });
  let tier = clamp(Math.floor((stage - 1) / 6) + (Math.random() < .3 ? 1 : 0) - (Math.random() < .25 ? 1 : 0), 0, 4);
  if (o.tier != null) tier = o.tier;
  const lootMul = DIFFS[P.diff].loot * (1 + ((P.st && P.st.m.loot) || 0));
  const r = Math.random() / Math.sqrt(lootMul);
  let rar = r < .03 ? 4 : r < .13 ? 3 : r < .38 ? 2 : r < .75 ? 1 : 0;
  rar = Math.max(rar, minRar || 0);
  const setChance = (o.setChance || 0) * lootMul;
  if (Math.random() < setChance) {
    const sid = Math.random() < .7 ? Object.keys(SETS).find(k => SETS[k].cls === P.cls) : 'drache';
    const S = SETS[sid], sslot = pick(['weapon', 'armor', 'helm']);
    return makeItem({ slot: sslot, base: sslot === 'weapon' ? (S.base || C.start) : sslot, tier: Math.max(tier, 2), rar: 5, set: sid });
  }
  return makeItem({ slot, base: slot === 'weapon' ? pick(C.weapons) : slot, tier, rar });
}
function setCount(sid) { let n = 0; for (const s of ['weapon', 'armor', 'helm']) if (P.gear[s] && P.gear[s].set === sid) n++; return n; }
function canEquip(it) { return it.slot !== 'weapon' || CLASSES[P.cls].weapons.includes(it.base); }
function equipFromBag(i) {
  const it = P.bag[i]; if (!it || !canEquip(it)) return false;
  const old = P.gear[it.slot]; P.gear[it.slot] = it; P.bag.splice(i, 1); if (old) P.bag.push(old);
  computeStats(); P.hp = Math.min(P.hp, P.st.hp);
  if (setCount(it.set) >= 3) stat('fullset');
  return true;
}
function addToBag(it) { if (P.bag.length >= 30) { const g = itemPrice(it); P.gold += g; return g; } P.bag.push(it); return 0; }

/* ---------- Werte berechnen ---------- */
const AFFKEY = { krit: 'crit', tempo: 'aspd', raub: 'leech', feuer: 'burnW', frost: 'frostW', wucht: 'wdmg', leben: 'hp', panzer: 'def', heil: 'regen', schutz: 'dr', eile: 'spd', glueck: 'gold' };
function computeStats() {
  const C = CLASSES[P.cls], m = {}; const add = (k, v) => m[k] = (m[k] || 0) + v;
  for (const [, nodes] of TALENTS[P.cls]) for (const n of nodes) { const r = P.talents[n.id] || 0; if (r) for (const k in n.e) add(k, n.e[k] * r); }
  let def = C.def, armHp = 0;
  for (const s of ['weapon', 'armor', 'helm']) {
    const it = P.gear[s]; if (!it) continue;
    for (const k in it.aff) add(AFFKEY[k], it.aff[k]);
    for (const g of it.gems) { const [id, gr] = g.split(':'); add(GEMS[id].eff, GEMS[id].v[+gr]); }
    if (s !== 'weapon') { def += armorDef(it); armHp += armorHp(it); }
  }
  const sets = {}; for (const s of ['weapon', 'armor', 'helm']) { const it = P.gear[s]; if (it && it.set) sets[it.set] = (sets[it.set] || 0) + 1; }
  for (const sid in sets) { if (sets[sid] >= 2) for (const k in SETS[sid].b2) add(k, SETS[sid].b2[k]); if (sets[sid] >= 3) for (const k in SETS[sid].b3) add(k, SETS[sid].b3[k]); }
  add('dmg', (P.pp.dmg || 0) * .01); add('hp', (P.pp.hp || 0) * .01); add('def', (P.pp.def || 0)); add('crit', (P.pp.crit || 0) * .002);
  add('dmg', P.rebirths * .1); add('hp', P.rebirths * .1);
  for (const b of P.buffs) for (const k in b.buff) add(k, b.buff[k]);
  const w = P.gear.weapon, W = WT[w.base];
  const st = { m };
  st.wbase = weaponDmg(w) * (1 + (m.wdmg || 0)) + P.lv * 1.4;
  st.dmgMul = 1 + (m.dmg || 0);
  st.cd = W.cd / (1 + (m.aspd || 0));
  st.crit = W.crit + (m.crit || 0);
  st.critdmg = 1.8 + (m.critdmg || 0);
  st.def = def + (m.def || 0);
  st.hp = Math.round((C.hp + (P.lv - 1) * C.hpLv + armHp) * (1 + (m.hp || 0)));
  st.spd = C.spd * (1 + (m.spd || 0));
  st.resMax = C.res.max; st.resRegen = C.res.regen * (1 + (m.resreg || 0));
  st.cdr = Math.min(.6, m.cdr || 0); st.dr = Math.min(.6, m.dr || 0); st.dodge = Math.min(.4, m.dodge || 0);
  st.regen = m.regen || 0; st.leech = m.leech || 0; st.gold = m.gold || 0; st.rage = m.rage || 0;
  P.st = st;
  return st;
}
const mod = k => (P.st && P.st.m[k]) || 0;
function xpNext(l) { return Math.floor(20 * Math.pow(l, 1.65)); }
const PARAGON_XP = 25000;

/* ---------- Talente ---------- */
function talentState(cls, bi, ni) {
  const node = TALENTS[cls][bi][1][ni], r = P.talents[node.id] || 0;
  const prevOk = ni === 0 || (P.talents[TALENTS[cls][bi][1][ni - 1].id] || 0) >= 1;
  return { node, r, can: prevOk && r < node.max && P.sp > 0, locked: !prevOk };
}
function learnTalent(bi, ni) { const s = talentState(P.cls, bi, ni); if (!s.can) return false; P.talents[s.node.id] = s.r + 1; P.sp--; computeStats(); return true; }
function spentPoints() { let n = 0; for (const k in P.talents) n += P.talents[k]; return n; }
function respecCost() { return 50 + P.lv * 25; }
function respec() { const c = respecCost(); if (P.gold < c) return false; P.gold -= c; P.sp += spentPoints(); P.talents = {}; computeStats(); return true; }

/* ---------- Werkbank ---------- */
function upCost(it, k) {
  const w = it.slot === 'weapon', c = {};
  if (w) { c.erz = 2 + k; if (k >= 4) c.zahn = k - 2; if (k >= 7) c.kristall = k - 5; } else { c.leder = 2 + k; if (k >= 4) c.knochen = k - 2; if (k >= 7) c.horn = k - 5; }
  if (k >= 9) c.glut = k - 7; if (k === 10) c.schuppe = 2;
  return { mats: c, gold: Math.round((30 + PRICE[it.tier] * .08) * k), chance: UPCHANCE[k - 1] };
}
function hasMats(c) { for (const k in c) if ((P.mats[k] || 0) < c[k]) return false; return true; }
function payMats(c) { for (const k in c) P.mats[k] -= c[k]; }
function canAfford(c, gold) { return hasMats(c) && P.gold >= (gold || 0); }
function upgradeItem(it) {
  if (it.up >= 10) return 'max';
  const k = it.up + 1, c = upCost(it, k);
  if (!canAfford(c.mats, c.gold)) return 'poor';
  payMats(c.mats); P.gold -= c.gold;
  if (Math.random() < c.chance) { it.up = k; statMax('maxUp', k); computeStats(); return 'ok'; }
  return 'fail';
}
function recipeById(id) { return RECIPES.find(r => r.id === id); }
function craft(id, it) {
  const R = recipeById(id); if (!canAfford(R.cost, R.gold)) return { r: 'poor' };
  if (R.needItem && !it) return { r: 'noitem' };
  if (id === 'socket' && it.sockets >= 3) return { r: 'max' };
  payMats(R.cost); P.gold -= R.gold;
  const stage = stageNum();
  switch (id) {
    case 'potion': P.potions = Math.min(P.potions + 2, 9); return { r: 'ok', msg: 'Zwei Heiltränke gebraut' };
    case 'forge_weapon': case 'forge_armor': case 'forge_helm': {
      const slot = id.split('_')[1]; const n = randomItem(stage, 1, { slot, setChance: .03 }); addToBag(n); if (n.rar === 4) stat('legs'); return { r: 'ok', item: n, msg: itemName(n) + ' geschmiedet' };
    }
    case 'reroll': rollAffixes(it); computeStats(); return { r: 'ok', msg: 'Neue Zusatzwerte' };
    case 'socket': if (Math.random() < .75) { it.sockets++; return { r: 'ok', msg: 'Sockel gebohrt' }; } return { r: 'fail', msg: 'Der Bohrer ist abgerutscht' };
    case 'gem': { const g = pick(GEMORDER) + ':0'; P.gems[g] = (P.gems[g] || 0) + 1; return { r: 'ok', msg: 'Splitter hergestellt' }; }
  }
  return { r: 'ok' };
}
function socketGem(it, gk) { if (it.gems.length >= it.sockets || !(P.gems[gk] > 0)) return false; it.gems.push(gk); P.gems[gk]--; computeStats(); return true; }
function unsocketAll(it) { const c = 40 + it.gems.length * 20; if (!it.gems.length || P.gold < c) return false; P.gold -= c; for (const g of it.gems) P.gems[g] = (P.gems[g] || 0) + 1; it.gems = []; computeStats(); return true; }
function combineGem(id, gr) { const k = id + ':' + gr, n = id + ':' + (gr + 1), cost = 20 * (gr + 1) * (gr + 1); if (gr >= 4 || (P.gems[k] || 0) < 3 || P.gold < cost) return false; P.gems[k] -= 3; P.gold -= cost; P.gems[n] = (P.gems[n] || 0) + 1; if (gr + 1 === 4) stat('royal'); return true; }
function unlockDye(id) { const D = DYES.find(d => d.id === id); if (P.dyes.includes(id)) { P.dye = id; return true; } if (!hasMats(D.cost)) return false; payMats(D.cost); P.dyes.push(id); P.dye = id; return true; }

/* ---------- Belohnungen ---------- */
function gainMat(k, n) { P.mats[k] = (P.mats[k] || 0) + n; }
function gainGem(gk) { P.gems[gk] = (P.gems[gk] || 0) + 1; }
function randomGem(stage) { const gr = clamp(Math.floor(Math.random() * Math.random() * (1 + stage / 8)), 0, 3); return pick(GEMORDER) + ':' + gr; }
