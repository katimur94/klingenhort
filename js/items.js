'use strict';
/* =========================================================
   KLINGENHORT – Charaktere, Gegenstände, Werte, Werkbank
   ========================================================= */

let P = null; // aktiver Charakter (gespeicherte Felder + Laufzeit-Felder)
const PERSIST = ['id', 'name', 'cls', 'diff', 'hc', 'lv', 'xp', 'gold', 'potions', 'sp', 'talents', 'paragon', 'pxp', 'pp', 'gear', 'bag', 'mats', 'gems', 'dyes', 'dye', 'act', 'map', 'rebirths', 'buffs', 'stats', 'created', 'dead', 'maxAct', 'res', 'rage', 'look', 'fate', 'story'];

function newChar(cls, name, diff, hc, look) {
  const C = CLASSES[cls];
  return {
    id: uid(), name: name || C.name, cls, diff: diff || 'normal', hc: !!hc,
    lv: 1, xp: 0, gold: 40, potions: 3, sp: 0, talents: {}, paragon: 0, pxp: 0, pp: { dmg: 0, hp: 0, def: 0, crit: 0 },
    gear: { weapon: makeItem({ slot: 'weapon', base: C.start, tier: 0, rar: 0, std: true }), armor: makeItem({ slot: 'armor', base: 'armor', tier: 0, rar: 0 }), helm: makeItem({ slot: 'helm', base: 'helm', tier: 0, rar: 0 }) },
    bag: [], mats: {}, gems: {}, dyes: ['natur'], dye: 'natur', act: 1, map: null, rebirths: 0, buffs: [],
    stats: { kills: 0, deaths: 0, rooms: 0, playtime: 0 }, created: Date.now(), dead: false, maxAct: 1, res: 100, rage: 0,
    look: look || { body: C.body, hair: -1, skin: -1, accent: -1, cape: -1 }, fate: 0, story: {}
  };
}
function activateChar(i) {
  SAVE.active = i; const c = SAVE.chars[i];
  P = Object.assign(newRuntime(), JSON.parse(JSON.stringify(c)));
  for (const k of ['talents', 'pp', 'mats', 'gems', 'stats', 'story']) if (!P[k]) P[k] = {};
  if (!P.pp.dmg && P.pp.dmg !== 0) P.pp = { dmg: 0, hp: 0, def: 0, crit: 0 };
  if (!Array.isArray(P.buffs)) P.buffs = [];
  if (!Array.isArray(P.dyes)) P.dyes = ['natur'];
  P.look = lookOf(P); P.fate = P.fate || 0;
  computeStats(); P.hp = P.st.hp; P.res = P.st.resMax;
}
function newRuntime() { return { x: 0, y: 0, z: 0, vx: 0, vy: 0, r: 5, turn: 1, face: 1, aim: 0, phase: 0, squash: 0, flash: 0, lean: 0, moving: false, hp: 1, atkT: 0, atkDur: 1, atkCd: 0, hitSet: null, struck: false, inv: 0, roll: 0, rollCd: 0, rdx: 1, rdy: 0, rollA: 0, hand: null, combo: 0, comboT: 0, chain: 0, chainT: 0, spin: 0, spinA: 0, spinTick: 0, leap: null, dash: null, volley: 0, volleyT: 0, ghostT: 0, cds: [0, 0, 0], potCd: 0, wall: 0, stealth: 0, poisonT: 0, slowT: 0, st: null, manAim: null, poolT: 0 }; }
/* Versteck-Stufe eines Gebäudes (gilt für alle Helden) */
function hideLv(k) { return (SAVE && SAVE.meta.hide && SAVE.meta.hide.b[k]) || 0; }
function potMax() { return [9, 10, 10, 12, 14][hideLv('alchemie')]; }
function potHeal() { return [.45, .45, .55, .55, .65][hideLv('alchemie')]; }
function saveChar() {
  if (!P || SAVE.active < 0) return;
  const o = {}; for (const k of PERSIST) o[k] = P[k];
  SAVE.chars[SAVE.active] = JSON.parse(JSON.stringify(o));
  persist();
}

/* ---------- Gegenstände ---------- */
function makeItem(o) {
  const rar = o.rar || 0, isW = o.slot === 'weapon';
  const it = { uid: uid(), slot: o.slot, base: isW ? o.base : o.slot, tier: clamp(o.tier || 0, 0, TIERS - 1), rar, up: 0, aff: {}, sockets: 0, gems: [], set: o.set || null, name: null, suf: null, fz: 0 };
  if (isW) { const F = WFORM[it.base]; it.form = o.form || (rar === 0 && o.std ? F.find(f => f.std).id : pick(F).id); }
  if (o.myth) it.myth = o.myth;
  rollAffixes(it);
  const sk = RAR[rar].sock; it.sockets = ri(sk[0], sk[1]);
  if (o.myth) it.name = MYTHIC[o.myth].n;
  else if (o.set) it.name = SETS[o.set].pieces[o.slot];
  else if (rar === 4) it.name = pick(LEGEND[isW ? it.base : it.slot]);
  return it;
}
/* Mythischer Gegenstand für einen Platz (zufällig, wenn kein Platz angegeben) */
function makeMythic(slot) {
  const ks = Object.keys(MYTHIC).filter(k => !slot || MYTHIC[k].slot === slot), k = pick(ks), S = MYTHIC[k].slot, C = CLASSES[P.cls];
  const tier = clamp(Math.max(3, Math.floor((stageNum() - 1) / 6) + 1), 0, TIERS - 1);
  return makeItem({ slot: S, base: S === 'weapon' ? pick(C.weapons) : S, tier, rar: 6, myth: k });
}
function rollAffixes(it) {
  const pool = it.slot === 'weapon' ? AFFW : AFFA, n = RAR[it.rar].aff;
  const keys = Object.keys(pool).sort(() => Math.random() - .5).slice(0, n);
  it.aff = {}; for (const k of keys) it.aff[k] = +pool[k].f(it.rar).toFixed(3);
  it.suf = keys.length && it.rar < 4 && !it.set ? pool[keys[0]].suf : null;
}
function itemName(it, cls) {
  cls = cls || (P && P.cls) || 'knight';
  let base = _t(it.name);
  if (!base) base = it.slot === 'weapon' ? _t('{mat}-{form}', { mat: MAT[it.tier].n, form: wform(it).n }) : CLASSES[cls].names[it.tier][it.slot === 'armor' ? 0 : 1];
  if (!it.name && it.suf) base = _t('{name} {suf}', { name: base, suf: _t(it.suf) });
  return base + (it.fz ? ' ' + '★'.repeat(it.fz) : '') + (it.up ? ' +' + it.up : '');
}
function itemColor(it) { return RAR[it.rar].c; }
function weaponDmg(it) { return WT[it.base].dmg * TMUL[it.tier] * RAR[it.rar].m * (1 + it.up * .08) * (wform(it).dm || 1) * (1 + (it.fz || 0) * .06); }
function armorDef(it) { return AR[it.slot].def[it.tier] * RAR[it.rar].m * (1 + it.up * .1) * (1 + (it.fz || 0) * .06); }
function armorHp(it) { return AR[it.slot].hp[it.tier] * (1 + it.up * .1) * (1 + (it.fz || 0) * .06); }
function itemLines(it) {
  const L = [];
  if (it.slot === 'weapon') {
    const F = wform(it); L.push(_t('Schaden {dmg} · {aps} Angriffe/s', { dmg: Math.round(weaponDmg(it) * (1 + (it.aff.wucht || 0))), aps: (1 / (WT[it.base].cd * (F.sp || 1))).toLocaleString(LOCALE, { minimumFractionDigits: 1, maximumFractionDigits: 1 }) }));
    const fx = []; if (F.crit) fx.push(_t('Krit +{v}', { v: pct(F.crit) })); if (F.range) fx.push(_t('Reichweite +{v}', { v: F.range })); if (F.kb) fx.push(_t('Wucht +{v}', { v: pct(F.kb - 1) })); if (fx.length) L.push(_t('{form}: {fx}', { form: F.n, fx: fx.join(', ') }));
  } else L.push(armorHp(it) ? _t('VER {def} · LP +{hp}', { def: Math.round(armorDef(it)), hp: Math.round(armorHp(it)) }) : _t('VER {def}', { def: Math.round(armorDef(it)) }));
  if (it.myth) L.push('✦ ' + MYTHIC[it.myth].d);
  const pool = it.slot === 'weapon' ? AFFW : AFFA;
  for (const k in it.aff) L.push(pool[k].s(it.aff[k]));
  for (const g of it.gems) { const [id, gr] = g.split(':'); L.push(_t('{grade} {gem}: {fx}', { grade: GEMGRADE[+gr], gem: GEMS[id].n, fx: GEMS[id].s(GEMS[id].v[+gr]) })); }
  if (it.sockets > it.gems.length) L.push(_t('{icons} freie Sockel', { icons: '◇'.repeat(it.sockets - it.gems.length) }));
  if (it.fz) L.push(_t('★ {n}× verschmolzen: +{p} % Grundwerte', { n: it.fz, p: it.fz * 6 }));
  if (it.set) { const S = SETS[it.set], have = setCount(it.set); L.push(_t('{set} ({n}/3): 2 – {d2}; 3 – {d3}', { set: S.n, n: have, d2: S.d2, d3: S.d3 })); }
  return L;
}
function itemPrice(it) { return Math.max(8, Math.round(PRICE[it.tier] * .22 * (1 + Math.min(it.rar, 5) * .6 + (it.rar === 6 ? 3 : 0)) * (1 + it.up * .3) * (1 + (it.fz || 0) * .2))); }
function itemScore(it) {
  if (it.slot === 'weapon') return weaponDmg(it) / (wform(it).sp || 1) * (1 + (it.aff.wucht || 0)) * (1 + (it.aff.krit || 0) + (wform(it).crit || 0)) * (1 + (it.aff.tempo || 0)) * (1 + it.gems.length * .05) * (it.myth ? 1.3 : 1);
  return armorDef(it) * 2 + armorHp(it) * .5 + (it.aff.leben || 0) * 120 + (it.aff.panzer || 0) * 2 + (it.aff.schutz || 0) * 200 + it.gems.length * 6 + (it.myth ? 40 : 0);
}
function randomItem(stage, minRar, o) {
  o = o || {};
  const C = CLASSES[P.cls];
  const slot = o.slot || wpick({ weapon: .45, armor: .3, helm: .25 });
  let tier = clamp(Math.floor((stage - 1) / 6) + (Math.random() < .3 ? 1 : 0) - (Math.random() < .25 ? 1 : 0), 0, TIERS - 1);
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
function addToBag(it) { if (it.rar === 6) statMax('myths', 1); if (P.bag.length >= 30) { const g = itemPrice(it); P.gold += g; return g; } P.bag.push(it); return 0; }

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
    if (it.myth) add('my_' + MYTHIC[it.myth].p, 1);
  }
  add('dmg', hideLv('training') * .03); add('hp', hideLv('training') * .03); add('xp', hideLv('bibliothek') * .05);
  if (mod2(m, 'my_midas')) add('gold', 1);
  const sets = {}; for (const s of ['weapon', 'armor', 'helm']) { const it = P.gear[s]; if (it && it.set) sets[it.set] = (sets[it.set] || 0) + 1; }
  for (const sid in sets) { if (sets[sid] >= 2) for (const k in SETS[sid].b2) add(k, SETS[sid].b2[k]); if (sets[sid] >= 3) for (const k in SETS[sid].b3) add(k, SETS[sid].b3[k]); }
  add('dmg', (P.pp.dmg || 0) * .01); add('hp', (P.pp.hp || 0) * .01); add('def', (P.pp.def || 0)); add('crit', (P.pp.crit || 0) * .002);
  add('dmg', P.rebirths * .1); add('hp', P.rebirths * .1);
  for (const b of P.buffs) for (const k in b.buff) add(k, b.buff[k]);
  const w = P.gear.weapon, W = WT[w.base], F = wform(w);
  const st = { m };
  st.wbase = weaponDmg(w) * (1 + (m.wdmg || 0)) + P.lv * 1.4;
  st.dmgMul = 1 + (m.dmg || 0);
  st.cd = W.cd * (F.sp || 1) / (1 + (m.aspd || 0));
  st.crit = W.crit + (F.crit || 0) + (m.crit || 0);
  st.range = W.range + (F.range || 0); st.kb = W.kb * (F.kb || 1);
  st.critdmg = 1.8 + (m.critdmg || 0);
  st.def = def + (m.def || 0);
  st.hp = Math.round((C.hp + (P.lv - 1) * C.hpLv + armHp) * (1 + (m.hp || 0)));
  st.spd = C.spd * (1 + (m.spd || 0));
  st.resMax = C.res.max; st.resRegen = C.res.regen * (1 + (m.resreg || 0));
  st.cdr = Math.min(.6, m.cdr || 0); st.dr = Math.min(.6, m.dr || 0); st.dodge = Math.min(.4, m.dodge || 0);
  st.regen = m.regen || 0; st.leech = m.leech || 0; st.gold = (m.gold || 0) + weekFx('gold'); st.rage = m.rage || 0;
  P.st = st;
  return st;
}
const mod = k => (P.st && P.st.m[k]) || 0;
const mod2 = (m, k) => m[k] || 0;
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
  const sl = hideLv('schmiede'), bonus = (sl >= 2 ? .05 : 0) + (sl >= 3 ? .05 : 0) + (sl >= 4 ? .05 : 0) + (wbFreeBonus() || 0);
  const wk = 1 - weekFx('smith'); for (const m in c) c[m] = Math.max(1, Math.ceil(c[m] * wk));
  return { mats: c, gold: Math.round((30 + PRICE[it.tier] * .08) * k * wk), chance: Math.min(1, UPCHANCE[k - 1] + (UPCHANCE[k - 1] < 1 ? bonus + weekFx('upChance') : 0)) };
}
function wbFreeBonus() { return typeof wbFree !== 'undefined' && wbFree ? .05 : 0; }
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
  switch (id) {
    case 'potion': P.potions = Math.min(P.potions + 2, potMax()); return { r: 'ok', msg: _t('Zwei Heiltränke gebraut') };
    case 'reroll': rollAffixes(it); computeStats(); return { r: 'ok', msg: _t('Neue Zusatzwerte') };
    case 'socket': if (Math.random() < .75) { it.sockets++; return { r: 'ok', msg: _t('Sockel gebohrt') }; } return { r: 'fail', msg: _t('Der Bohrer ist abgerutscht') };
    case 'gem': { const g = pick(GEMORDER) + ':0'; P.gems[g] = (P.gems[g] || 0) + 1; return { r: 'ok', msg: _t('Splitter hergestellt') }; }
  }
  return { r: 'ok' };
}
/* Schmieden nach Material: garantiert die gewählte Stufe */
function forgeCost(tier, slot) {
  const F = FORGE[tier], c = Object.assign({}, slot === 'weapon' ? F.w : F.a), disc = hideLv('schmiede') >= 2 ? .8 : 1;
  return { mats: c, gold: Math.round(PRICE[tier] * .3 * disc + 30) };
}
function forgeOk(tier) { return P.lv >= REQ[tier]; }
function forgeItem(tier, slot) {
  const c = forgeCost(tier, slot); if (!forgeOk(tier) || !canAfford(c.mats, c.gold)) return null;
  payMats(c.mats); P.gold -= c.gold;
  const it = randomItem(stageNum(), 1, { slot, tier, setChance: .03 });
  if (hideLv('schmiede') >= 4 && Math.random() < .2 && it.rar < 4) { it.rar++; rollAffixes(it); if (it.rar === 4 && !it.name) it.name = pick(LEGEND[slot === 'weapon' ? it.base : slot]); }
  addToBag(it); if (it.rar === 4) stat('legs');
  return it;
}

/* ---------- Verschmelzen ----------
   Hauptgegenstand a bleibt (Form, Name, Set), Opfer b geht verloren.
   Ergebnis: höhere Stufe und Aufwertung, beste Zusatzwerte beider, ein Zusatzwert mehr, +6 % Grundwerte */
function fuseMax() { return hideLv('schmiede') >= 4 ? 5 : 3; }
function fuseCheck(a, b) {
  if (!a) return _t('Wähle zuerst den Hauptgegenstand.');
  if ((a.fz || 0) >= fuseMax()) return _t('Dieser Gegenstand ist maximal verschmolzen ({n} ★).', { n: fuseMax() });
  if (!b) return _t('Wähle jetzt einen Gegenstand aus dem Beutel, der geopfert wird.');
  if (a === b) return _t('Ein Gegenstand kann nicht mit sich selbst verschmelzen.');
  if (a.slot !== b.slot) return _t('Nur gleiche Art: Waffe mit Waffe, Rüstung mit Rüstung, Helm mit Helm.');
  return null;
}
function fuseChance(a, b) {
  if (a.rar >= 5) return 0;
  const br = b.rar === 5 ? 3 : b.rar === 6 ? 4 : b.rar;
  if (br > a.rar) return 1;
  if (br < a.rar) return 0;
  return [.6, .5, .4, .25, .06][a.rar] + (hideLv('schmiede') >= 4 ? .1 : 0) * (a.rar < 4 ? 1 : .2);
}
function fuseCost(a, b) {
  const t = Math.max(a.tier, b ? b.tier : 0), fz = (a.fz || 0) + 1, c = { kristall: fz };
  if (a.rar >= 3) c.horn = 1; if (a.rar >= 4) c.schuppe = fz;
  const wk = 1 - weekFx('smith'); for (const m in c) c[m] = Math.max(1, Math.ceil(c[m] * wk));
  return { mats: c, gold: Math.round((60 + PRICE[t] * .1 * fz) * wk) };
}
function fusePreview(a, b) {
  const r = JSON.parse(JSON.stringify(a)), pool = a.slot === 'weapon' ? AFFW : AFFA, all = {};
  r.tier = Math.max(a.tier, b.tier); r.up = Math.max(a.up, b.up); r.sockets = Math.max(a.sockets, b.sockets); r.fz = (a.fz || 0) + 1;
  for (const it of [a, b]) for (const k in it.aff) all[k] = Math.max(all[k] || 0, it.aff[k]);
  const br = b.rar === 5 ? 3 : b.rar === 6 ? 4 : b.rar; if (a.rar < 5 && br > a.rar) r.rar = br;
  const n = RAR[r.rar].aff + 1, keys = Object.keys(all).sort((x, y) => all[y] / pool[y].f(4) - all[x] / pool[x].f(4)).slice(0, n);
  r.aff = {}; for (const k of keys) r.aff[k] = all[k];
  if (r.rar === 4 && !r.name) r.name = pick(LEGEND[r.slot === 'weapon' ? r.base : r.slot]);
  return r;
}
function fuseItems(a, b) {
  const err = fuseCheck(a, b); if (err) return { r: 'err', msg: err };
  const c = fuseCost(a, b); if (!canAfford(c.mats, c.gold)) return { r: 'poor' };
  const bi = P.bag.indexOf(b); if (bi < 0) return { r: 'err', msg: _t('Das Opfer muss im Beutel liegen.') };
  payMats(c.mats); P.gold -= c.gold;
  const ch = fuseChance(a, b), res = fusePreview(a, b), lucky = ch < 1 && ch > 0 && Math.random() < ch;
  if (lucky) {
    if (res.rar === 4) { res.rar = 6; const ks = Object.keys(MYTHIC).filter(k => MYTHIC[k].slot === res.slot); res.myth = pick(ks); res.name = MYTHIC[res.myth].n; statMax('myths', 1); }
    else { res.rar++; if (res.rar === 4 && !res.name) res.name = pick(LEGEND[res.slot === 'weapon' ? res.base : res.slot]); }
    const pool = res.slot === 'weapon' ? AFFW : AFFA, free = Object.keys(pool).filter(k => !(k in res.aff));
    if (free.length && Object.keys(res.aff).length < RAR[res.rar].aff + 1) { const k = pick(free); res.aff[k] = +pool[k].f(res.rar).toFixed(3); }
  }
  if (res.rar === 4) stat('legs');
  for (const g of b.gems) gainGem(g);
  P.bag.splice(bi, 1); Object.assign(a, res); stat('fusions'); computeStats();
  return { r: 'ok', up: lucky, it: a };
}
function transmute(i) {
  const [from, to, n, gold] = TRANSMUTE[i];
  if ((P.mats[from] || 0) < n || P.gold < gold) return false;
  P.mats[from] -= n; P.gold -= gold; gainMat(to, 1); return true;
}

function socketGem(it, gk) { if (it.gems.length >= it.sockets || !(P.gems[gk] > 0)) return false; it.gems.push(gk); P.gems[gk]--; computeStats(); return true; }
function unsocketAll(it) { const c = 40 + it.gems.length * 20; if (!it.gems.length || P.gold < c) return false; P.gold -= c; for (const g of it.gems) P.gems[g] = (P.gems[g] || 0) + 1; it.gems = []; computeStats(); return true; }
function gemCombineCost(gr) { return Math.round(20 * (gr + 1) * (gr + 1) * (hideLv('juwelier') >= 2 ? .5 : 1)); }
function combineGem(id, gr) { const k = id + ':' + gr, n = id + ':' + (gr + 1), cost = gemCombineCost(gr); if (gr >= 4 || (P.gems[k] || 0) < 3 || P.gold < cost) return false; P.gems[k] -= 3; P.gold -= cost; P.gems[n] = (P.gems[n] || 0) + 1; if (gr + 1 === 4) stat('royal'); return true; }
function unlockDye(id) { const D = DYES.find(d => d.id === id); if (P.dyes.includes(id)) { P.dye = id; return true; } if (!hasMats(D.cost)) return false; payMats(D.cost); P.dyes.push(id); P.dye = id; return true; }

/* ---------- Belohnungen ---------- */
function gainMat(k, n) { P.mats[k] = (P.mats[k] || 0) + n; }
function gainGem(gk) { P.gems[gk] = (P.gems[gk] || 0) + 1; }
function randomGem(stage) { const gr = clamp(Math.floor(Math.random() * Math.random() * (1 + stage / 8)), 0, 3); return pick(GEMORDER) + ':' + gr; }
