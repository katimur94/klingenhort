'use strict';
/* =========================================================
   KLINGENHORT – Charaktere, Gegenstände, Werte, Werkbank
   ========================================================= */

let P = null; // aktiver Charakter (gespeicherte Felder + Laufzeit-Felder)
// lvr = höchstes belohntes Level (6.4, Level-Belohnungen in js/aufstieg.js)
const PERSIST = ['id', 'name', 'cls', 'diff', 'hc', 'lv', 'xp', 'gold', 'potions', 'sp', 'talents', 'paragon', 'pxp', 'pp', 'gear', 'bag', 'mats', 'gems', 'dyes', 'dye', 'act', 'map', 'rebirths', 'buffs', 'stats', 'created', 'dead', 'maxAct', 'res', 'rage', 'look', 'fate', 'story', 'parts', 'mastery', 'birds', 'lvr'];

function newChar(cls, name, diff, hc, look) {
  const C = CLASSES[cls];
  return {
    id: uid(), name: name || C.name, cls, diff: diff || 'normal', hc: !!hc,
    lv: 1, xp: 0, gold: 40, potions: 3, sp: 0, talents: {}, paragon: 0, pxp: 0, pp: { dmg: 0, hp: 0, def: 0, crit: 0 },
    gear: { weapon: makeItem({ slot: 'weapon', base: C.start, tier: 0, rar: 0, std: true }), armor: makeItem({ slot: 'armor', base: 'armor', tier: 0, rar: 0 }), helm: makeItem({ slot: 'helm', base: 'helm', tier: 0, rar: 0 }) },
    bag: [], mats: {}, gems: {}, dyes: ['natur'], dye: 'natur', act: 1, map: null, rebirths: 0, buffs: [],
    stats: { kills: 0, deaths: 0, rooms: 0, playtime: 0 }, created: Date.now(), dead: false, maxAct: 1, res: 100, rage: 0,
    look: look || { body: C.body, hair: -1, skin: -1, accent: -1, cape: -1 }, fate: 0, story: {}, parts: {}, mastery: {}, lvr: 1
  };
}
function activateChar(i) {
  SAVE.active = i; const c = SAVE.chars[i];
  P = Object.assign(newRuntime(), JSON.parse(JSON.stringify(c)));
  for (const k of ['talents', 'pp', 'mats', 'gems', 'stats', 'story', 'parts', 'mastery']) if (!P[k]) P[k] = {};
  if (!P.pp.dmg && P.pp.dmg !== 0) P.pp = { dmg: 0, hp: 0, def: 0, crit: 0 };
  if (!Array.isArray(P.buffs)) P.buffs = [];
  if (!Array.isArray(P.dyes)) P.dyes = ['natur'];
  P.look = lookOf(P); P.fate = P.fate || 0;
  const old = lvFix(P); if (typeof lvrFix === 'function') lvrFix(P, old);   // Level, Talente, Erfahrung (6.4) · Level-Belohnungen (js/aufstieg.js)
  hook('activate', P);
  computeStats(); P.hp = P.st.hp; P.res = P.st.resMax;
}
function newRuntime() { return { x: 0, y: 0, z: 0, vx: 0, vy: 0, r: 5, turn: 1, face: 1, aim: 0, phase: 0, squash: 0, flash: 0, lean: 0, moving: false, hp: 1, atkT: 0, atkDur: 1, atkCd: 0, hitSet: null, struck: false, inv: 0, roll: 0, rollCd: 0, rdx: 1, rdy: 0, rollA: 0, hand: null, combo: 0, comboT: 0, chain: 0, chainT: 0, spin: 0, spinA: 0, spinTick: 0, leap: null, dash: null, volley: 0, volleyT: 0, ghostT: 0, cds: [0, 0, 0], potCd: 0, wall: 0, stealth: 0, poisonT: 0, slowT: 0, st: null, manAim: null, poolT: 0 }; }
/* Versteck-Stufe eines Gebäudes (gilt für alle Helden) */
function hideLv(k) { return (SAVE && SAVE.meta.hide && SAVE.meta.hide.b[k]) || 0; }
function potMax() { return [9, 10, 10, 12, 14, 15, 15, 16, 16, 18, 20][Math.min(10, hideLv('alchemie'))]; }
function potHeal() { return [.45, .45, .55, .55, .65, .65, .68, .68, .7, .7, .75][Math.min(10, hideLv('alchemie'))]; }
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
  hook('itemGen', it);
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
  if (typeof elRoll === 'function') elRoll(it); // Element für seltene Beute (js/elements.js)
}
function itemName(it, cls) {
  cls = cls || (P && P.cls) || 'knight';
  let base = _t(it.name);
  if (!base) base = it.slot === 'weapon' ? _t('{mat}-{form}', { mat: MAT[it.tier].n, form: wform(it).n }) : CLASSES[cls].names[it.tier][it.slot === 'armor' ? 0 : 1];
  if (!it.name && it.suf) base = _t('{name} {suf}', { name: base, suf: _t(it.suf) });
  // ⚒ = Meisterwerk, dazu das Zeichen des Elements (js/forge.js, js/elements.js)
  const pre = (it.mw ? '⚒' : '') + (it.el && typeof ELEM !== 'undefined' && ELEM[it.el] ? ELEM[it.el].g : '');
  return (pre ? pre + ' ' : '') + base + (it.fz ? ' ' + '★'.repeat(it.fz) : '') + (it.up ? ' +' + it.up : '');
}
function itemColor(it) { return RAR[it.rar].c; }
// Meisterwerk (it.mw): Klinge +6 % Schaden, Panzerplatte +6 % Verteidigung, Polsterung +6 % LP (und etwas fest) je Stufe
function weaponDmg(it) { return WT[it.base].dmg * TMUL[it.tier] * RAR[it.rar].m * (1 + it.up * .08) * (wform(it).dm || 1) * (1 + (it.fz || 0) * .06) * (1 + (it.mw ? it.mw.klinge || 0 : 0) * .06); }
function armorDef(it) { return AR[it.slot].def[it.tier] * RAR[it.rar].m * (1 + it.up * .1) * (1 + (it.fz || 0) * .06) * (1 + (it.mw ? it.mw.platte || 0 : 0) * .06); }
function armorHp(it) { const p = it.mw ? it.mw.polster || 0 : 0; return (AR[it.slot].hp[it.tier] + p * (it.slot === 'armor' ? 3 : 2)) * (1 + it.up * .1) * (1 + (it.fz || 0) * .06) * (1 + p * .06); }
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
  hook('itemLines', it, L);
  return L;
}
// Verkaufspreis beim Händler; itemPrice0 = ohne Vorteile (Grundlage für Händler-Ware), itemPrice mit Ruf der Handelsgilde (perk 'sell')
function itemPrice0(it) { return Math.max(8, Math.round(PRICE[it.tier] * .22 * (1 + Math.min(it.rar, 5) * .6 + (it.rar === 6 ? 3 : 0)) * (1 + it.up * .3) * (1 + (it.fz || 0) * .2))); }
function itemPrice(it) { return Math.max(8, Math.round(itemPrice0(it) * perk('sell', 1))); }
function itemScore(it) {
  const gr = it.mw ? it.mw.griff || 0 : 0, ms = typeof modScore === 'function' ? 1 + modScore(it) : 1;   // Mods zählen mit (js/mods.js)
  if (it.slot === 'weapon') return ms * weaponDmg(it) / (wform(it).sp || 1) * (1 + (it.aff.wucht || 0)) * (1 + (it.aff.krit || 0) + (wform(it).crit || 0) + gr * .006) * (1 + (it.aff.tempo || 0) + gr * .015) * (1 + it.gems.length * .05) * (it.myth ? 1.3 : 1) * (it.el ? 1.06 : 1);
  return ms * (armorDef(it) * 2 + armorHp(it) * .5 + (it.aff.leben || 0) * 120 + (it.aff.panzer || 0) * 2 + (it.aff.schutz || 0) * 200 + it.gems.length * 6 + (it.myth ? 40 : 0) + (it.el ? 8 : 0) + (it.mw ? (it.mw.rune || 0) * 4 : 0));
}
function randomItem(stage, minRar, o) {
  o = o || {};
  const C = CLASSES[P.cls];
  const slot = o.slot || wpick({ weapon: .45, armor: .3, helm: .25 });
  let tier = clamp(Math.floor((stage - 1) / 6) + (Math.random() < .3 ? 1 : 0) - (Math.random() < .25 ? 1 : 0), 0, TIERS - 1);
  if (o.tier != null) tier = o.tier;
  const lootMul = DIFFS[P.diff].loot * (1 + ((P.st && P.st.m.loot) || 0));
  const r = Math.random() / Math.sqrt(lootMul);
  const wl = typeof landeLuck === 'function' ? landeLuck() : 0; // Verlorene Lande (js/lande.js): eigene, bessere Seltenheiten – auch Mythisch
  let rar = wl ? landeRar(r, wl) : r < .008 ? 4 : r < .048 ? 3 : r < .188 ? 2 : r < .548 ? 1 : 0; // Kampagne: Legendär 0,8 %, Episch 4 %, Selten 14 %, Magisch 36 %
  rar = Math.max(rar, minRar || 0);
  if (rar === 6) return makeMythic(o.slot);
  const setChance = (o.setChance || 0) * lootMul + (wl ? .003 * wl : 0);
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
// Schnell-Ausrüsten (6.3): je Platz das Beste aus dem Beutel anlegen (itemScore zählt Mods mit), nie etwas Schlechteres; nur was die Klasse tragen kann.
// Ein Set mit aktivem Bonus (2+ Teile) bleibt, außer das Neue gehört zum selben Set. → [{ slot, it, old, d }] (d = besser um, 0,12 = +12 %)
function equipBest() {
  const ch = [];
  for (const s of ['weapon', 'armor', 'helm']) {
    const cur = P.gear[s], cs = cur ? itemScore(cur) : 0, keep = cur && cur.set && setCount(cur.set) >= 2; let best = null, bs = cs;
    for (const it of P.bag) if (it.slot === s && canEquip(it) && !(keep && it.set !== cur.set)) { const v = itemScore(it); if (v > bs * 1.001 + 1e-9) { best = it; bs = v; } }
    if (best && equipFromBag(P.bag.indexOf(best))) ch.push({ slot: s, it: best, old: cur, d: cs > 0 ? bs / cs - 1 : 1 });
  }
  return ch;
}
// Beute-Filter (6.3, Einstellungen; 6.3.1 mehr Auswahl): je Seltenheit Gewöhnlich (c), Magisch (m), Selten (s), Episch (e) aufheben, gleich verkaufen,
// liegen lassen oder wegwerfen → 'take' | 'sell' | 'leave' | 'trash'. Dazu die Wertgrenze: unter v Gold Marktwert gilt va (nur wo die Seltenheit „Aufheben“ hat).
// Nie: Legendär, Set, Mythisch, Gegenstände mit Mods, Sockelsteinen, Aufwertung, Verschmelzung – und was besser ist als das Angelegte.
// Lande: kein Verkaufen (kein Händler – kommt in den Rucksack).
const LOOT_K = ['c', 'm', 's', 'e'], LOOT_ACT = ['take', 'sell', 'leave', 'trash'];
const LOOT_V = [0, 50, 100, 250, 500, 1000, 2500, 5000, 10000, 25000, 50000, 100000, 250000, 500000];   // Stufen der Wertgrenze (0 = aus)
function lootPlain(it) { return it.rar <= 3 && !it.gems.length && !it.up && !it.fz && !it.mw && !it.skin && !it.set && !it.myth && !(Array.isArray(it.mods) && it.mods.length); }
// Marktwert wie am Gegenstand angezeigt (Basar, js/market.js), sonst grob aus dem Händlerpreis
function lootVal(it) { return typeof itemValue === 'function' ? itemValue(it) : itemPrice(it) * 3; }
function lootRule(it, lande) {
  const L = SAVE && SAVE.meta.settings.loot; if (!L || !it || !lootPlain(it)) return 'take';
  let r = L[LOOT_K[it.rar]] || 'take';
  if (r === 'take' && L.v > 0 && lootVal(it) < L.v) r = L.va || 'trash';
  if (r === 'take' || !LOOT_ACT.includes(r)) return 'take';
  const cur = P.gear[it.slot]; if (canEquip(it) && (!cur || itemScore(it) > itemScore(cur) * 1.05)) return 'take';
  return lande && r === 'sell' ? 'take' : r;
}
function addToBag(it) { hook('pickup', it); if (it.rar === 6) statMax('myths', 1); if (P.bag.length >= bagCap()) { const g = itemPrice(it); P.gold += g; return g; } P.bag.push(it); return 0; }
/* ---------- Taschen (6.2): die Sattlerei (Versteck, Stufe 0–10) macht Beutel, Rucksack der Lande und Begleiter-Taschen größer ---------- */
function sattlerLv() { return clamp(Math.floor(hideLv('sattler')) || 0, 0, 10); }
function bagCap() { return 30 + 6 * sattlerLv(); }   // Beutel des Helden: 30 … 90
/* Lager (Schatzkammer, gemeinsam für alle Helden): Gegenstände dort lassen sich auch beim Händler, im Basar und an der Werkbank
   verkaufen und bearbeiten – sie bleiben dabei im Lager. Neues kommt in den Beutel, ist er voll, ins Lager. */
function stashItems() { return SAVE && SAVE.meta.hide && Array.isArray(SAVE.meta.hide.stash) ? SAVE.meta.hide.stash : []; }
function stashOn() { return hideLv('lager') > 0 || stashItems().length > 0; }
function inStash(it) { return !!it && stashItems().includes(it); }
// Liste, in der ein loser Gegenstand liegt (Beutel oder Lager), sonst null (angelegt oder fremd)
function itemList(it) { return !it ? null : P.bag.includes(it) ? P.bag : inStash(it) ? stashItems() : null; }
function itemTake(it) { const L = itemList(it); if (!L) return false; L.splice(L.indexOf(it), 1); return true; }
// Neues von der Werkbank: in den Beutel, ist er voll, ins Lager → 'bag' | 'stash' | null (kein Platz)
function roomFor() { return P.bag.length < bagCap() || (typeof stashCap === 'function' && stashItems().length < stashCap()); }
function itemPut(it) {
  if (P.bag.length < bagCap()) { addToBag(it); return 'bag'; }
  if (typeof stashCap === 'function' && SAVE && stashItems().length < stashCap()) { hook('pickup', it); if (it.rar === 6) statMax('myths', 1); stashItems().push(it); return 'stash'; }
  return null;
}
// Anlegen aus Beutel oder Lager: was vorher angelegt war, liegt danach an derselben Stelle
function equipItem(it) {
  const L = itemList(it); if (!L || !canEquip(it)) return false;
  if (L === P.bag) return equipFromBag(P.bag.indexOf(it));
  const old = P.gear[it.slot], i = L.indexOf(it); P.gear[it.slot] = it; if (old) L[i] = old; else L.splice(i, 1);
  computeStats(); P.hp = Math.min(P.hp, P.st.hp); if (setCount(it.set) >= 3) stat('fullset');
  return true;
}
// Sammel-Verkauf und -Zerlegen lassen Wertvolles aus: Sockelsteine, Aufwertung, Verschmelzung, Meisterwerk, Aussehen, Mods
function plainItem(it) { return it.rar <= 1 && !it.gems.length && !it.up && !it.fz && !it.mw && !it.skin && !it.set && !it.myth && !(Array.isArray(it.mods) && it.mods.length); }
// Reihenfolge für „Sortieren“: Art, Seltenheit, Stufe, Aufwertung
function itemSortKey(a, b) { const o = { weapon: 0, armor: 1, helm: 2 }; return (o[a.slot] - o[b.slot]) || (b.rar - a.rar) || (b.tier - a.tier) || (b.up - a.up) || (itemScore(b) - itemScore(a)); }

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
  hook('stats', add, m);
  const w = P.gear.weapon, W = WT[w.base], F = wform(w);
  const st = { m };
  st.wbase = weaponDmg(w) * (1 + (m.wdmg || 0)) + (lvPow(P.lv) + 1) * 1.4;
  st.dmgMul = 1 + (m.dmg || 0);
  st.cd = W.cd * (F.sp || 1) / (1 + (m.aspd || 0));
  st.crit = W.crit + (F.crit || 0) + (m.crit || 0);
  st.range = W.range + (F.range || 0); st.kb = W.kb * (F.kb || 1);
  st.critdmg = 1.8 + (m.critdmg || 0);
  st.def = def + (m.def || 0);
  st.hp = Math.round((C.hp + lvPow(P.lv) * C.hpLv + armHp) * (1 + (m.hp || 0)));
  st.spd = C.spd * (1 + (m.spd || 0));
  st.resMax = C.res.max; st.resRegen = C.res.regen * (1 + (m.resreg || 0));
  st.cdr = Math.min(.6, m.cdr || 0); st.dr = Math.min(.6, m.dr || 0); st.dodge = Math.min(.4, m.dodge || 0);
  st.regen = m.regen || 0; st.leech = m.leech || 0; st.gold = (m.gold || 0) + weekFx('gold'); st.rage = m.rage || 0;
  hook('statsPost', st, m);
  P.st = st;
  return st;
}
const mod = k => (P.st && P.st.m[k]) || 0;
const mod2 = (m, k) => m[k] || 0;
/* ---------- Level (6.4 „Aufstieg“): bis Level 100, danach Paragon ----------
   Erfahrung je Level: bis 30 wie bisher (50·l^2,2), danach Stützpunkte XP_AT, dazwischen geometrisch – keine Wand mehr bei 35, die letzten Level sehr schwer.
   Gemessen im Spiel (tools/test/aufstieg.js): echte Wellen aus Kampagne und Endlosen Landen (je halb) an der Stufe, die das Spiel für dieses Level
   „passend“ nennt (0,9 × lHeroSt; Geschichte nach dem Kampagnen-Lauf, danach Qual 1), 30 Kills je Minute, ohne EP-Boni (Bibliothek bis +50 % spart ein Drittel).
   Minuten je Level: 10: 3,3 · 20: 8 · 30: 14,5 · 35: 14,5 (vorher 20) · 40: 16 (27) · 50: 20 · 60: 27 · 70: 35 · 80: 55 · 90: 175 (2,9 h) · 95: 260 (4,3 h)
   · 99: 350 (5,8 h) – Level 50 nach 8 h (vorher 12 h), Level 100 nach etwa 79 h Kampf; ein Paragonpunkt danach ≈ 30 min */
const LVMAX = 100, REBIRTH_LV = 50;
const XP_AT = [[30, 88845], [35, 91000], [40, 100000], [50, 125000], [60, 165000], [70, 225000], [79, 290000], [80, 360000], [85, 580000], [89, 830000], [90, 1250000], [95, 1850000], [99, 2800000]];
function xpOld(l) { return Math.floor(50 * Math.pow(l, 2.2)); }   // Kurve bis 6.3 (Umrechnung alter Spielstände)
function xpNext(l) {
  if (l <= 30) return xpOld(l);
  for (let i = 1; i < XP_AT.length; i++) { const [l1, v1] = XP_AT[i]; if (l <= l1) { const [l0, v0] = XP_AT[i - 1]; return Math.round(v0 * Math.pow(v1 / v0, (l - l0) / (l1 - l0)) / 100) * 100; } }
  return XP_AT[XP_AT.length - 1][1];
}
// Stärke aus dem Level: die ersten 25 Level bringen mehr, danach weniger – Level 50 ist so stark wie bisher, Level 100 nur gut 20 % stärker als 50
function lvPow(l) { return 1.6 * Math.min(l - 1, 24) + .42 * clamp(l - 25, 0, 25) + .24 * Math.max(0, l - 50); }
// Stufe, der ein Held dieses Levels gewachsen ist (Endlose Lande „passend“): über 50 wächst sie langsamer, wie die Stärke
function lvEff(l) { return l <= 50 ? l : 50 + (l - 50) * .4; }
// Paragon ab Level 100: etwa eine halbe Stunde je Punkt (Paragonpunkte von früher bleiben)
const PARAGON_XP = 250000;

/* ---------- Talente ----------
   Grund-Talente und Meister-Stufe (6.4, node.lv = ab diesem Level): ein Talent wird frei, wenn das darüber einen Punkt hat und das Level reicht */
function talentState(cls, bi, ni) {
  const node = TALENTS[cls][bi][1][ni], r = P.talents[node.id] || 0;
  const prevOk = ni === 0 || (P.talents[TALENTS[cls][bi][1][ni - 1].id] || 0) >= 1, lvOk = !node.lv || P.lv >= node.lv;
  return { node, r, can: prevOk && lvOk && r < node.max && P.sp > 0, locked: !prevOk || !lvOk, lvLock: !lvOk };
}
function learnTalent(bi, ni) { const s = talentState(P.cls, bi, ni); if (!s.can) return false; P.talents[s.node.id] = s.r + 1; P.sp--; computeStats(); return true; }
function spentPoints() { let n = 0; for (const k in P.talents) n += P.talents[k]; return n; }
// Punkte im ganzen Baum einer Klasse (99 = ein Punkt je Level bis 100)
function talentTotal(cls) { let n = 0; for (const [, nodes] of TALENTS[cls]) for (const t of nodes) n += t.max; return n; }
/* Held reparieren (beim Laden): nur gültige Talente mit erlaubtem Rang; zu hohe Stufe (Level reicht nicht) → Punkte zurück.
   Freie Punkte mindestens (Level − 1) − verteilt (Blutaltar-Punkte bleiben). Alte Spielstände (ohne P.lvr): Level ≤ 100, Erfahrung anteilig auf die neue Kurve */
function lvFix(c) {
  c.lv = clamp(Math.floor(+c.lv) || 1, 1, LVMAX);
  const T0 = c.talents && typeof c.talents === 'object' ? c.talents : {}, t = {}; let back = 0;
  for (const [, nodes] of TALENTS[c.cls] || []) nodes.forEach((n, i) => {
    const r = clamp(Math.floor(+T0[n.id]) || 0, 0, n.max), prev = i === 0 || (t[nodes[i - 1].id] || 0) >= 1;
    if (!r) return; if ((n.lv && c.lv < n.lv) || !prev) { back += r; return; } t[n.id] = r;
  });
  c.talents = t; let spent = 0; for (const k in t) spent += t[k];
  c.sp = Math.max(0, Math.floor(+c.sp) || 0) + back; c.sp = Math.max(c.sp, c.lv - 1 - spent);
  const old = c.lvr == null || !isFinite(+c.lvr);
  if (old) { const x = Math.max(0, +c.xp || 0); c.xp = c.lv >= LVMAX ? 0 : Math.floor(Math.min(1, x / xpOld(c.lv)) * xpNext(c.lv)); c.lvr = c.lv; }   // erreichte Level gelten als belohnt
  c.lvr = clamp(Math.max(Math.floor(+c.lvr) || 1, c.lv), 1, LVMAX);
  c.xp = c.lv >= LVMAX ? 0 : clamp(Math.floor(+c.xp) || 0, 0, xpNext(c.lv) - 1);
  c.paragon = Math.max(0, Math.floor(+c.paragon) || 0); c.pxp = clamp(Math.floor(+c.pxp) || 0, 0, PARAGON_XP - 1);
  return old;
}
function respecCost() { return 50 + P.lv * 25; }
function respec() { const c = respecCost(); if (P.gold < c) return false; P.gold -= c; P.sp += spentPoints(); P.talents = {}; computeStats(); return true; }

/* ---------- Werkbank ---------- */
function upCost(it, k) {
  const w = it.slot === 'weapon', c = {};
  if (w) { c.erz = 2 + k; if (k >= 4) c.zahn = k - 2; if (k >= 7) c.kristall = k - 5; } else { c.leder = 2 + k; if (k >= 4) c.knochen = k - 2; if (k >= 7) c.horn = k - 5; }
  if (k >= 9) c.glut = k - 7; if (k === 10) c.schuppe = 2;
  const sl = hideLv('schmiede'), bonus = (sl >= 2 ? .05 : 0) + (sl >= 3 ? .05 : 0) + (sl >= 4 ? .05 : 0) + Math.max(0, sl - 4) * .01 + (wbFreeBonus() || 0);
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
  stat('upTry');
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
  const F = FORGE[tier], c = Object.assign({}, slot === 'weapon' ? F.w : F.a), disc = smithDisc();
  return { mats: c, gold: Math.round(PRICE[tier] * .3 * disc + 30) };
}
function forgeOk(tier) { return P.lv >= REQ[tier]; }
function forgeItem(tier, slot) {
  const c = forgeCost(tier, slot); if (!forgeOk(tier) || !canAfford(c.mats, c.gold)) return null;
  payMats(c.mats); P.gold -= c.gold;
  const it = randomItem(stageNum(), 1, { slot, tier, setChance: .03 });
  if (hideLv('schmiede') >= 4 && Math.random() < .2 && it.rar < 4) { it.rar++; rollAffixes(it); if (it.rar === 4 && !it.name) it.name = pick(LEGEND[slot === 'weapon' ? it.base : slot]); }
  if (!itemPut(it)) addToBag(it); if (it.rar === 4) stat('legs'); stat('forged');
  return it;
}

/* ---------- Verschmelzen ----------
   Hauptgegenstand a bleibt (Form, Name, Set), Opfer b geht verloren.
   Ergebnis: höhere Stufe und Aufwertung, beste Zusatzwerte beider, ein Zusatzwert mehr, +6 % Grundwerte */
// Schmiede-Rabatt aufs Schmieden: ab Stufe 2 20 %, 6/8/10: 25/30/35 %
function smithDisc() { const sl = hideLv('schmiede'); return sl >= 10 ? .65 : sl >= 8 ? .7 : sl >= 6 ? .75 : sl >= 2 ? .8 : 1; }
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
  if (!itemList(b)) return { r: 'err', msg: _t('Das Opfer muss im Beutel liegen.') };   // Beutel oder Lager
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
  if (typeof modTakeBack === 'function') modTakeBack(b);   // Mods des Opfers zurück in den Vorrat (js/mods.js)
  itemTake(b); Object.assign(a, res); stat('fusions'); computeStats();
  return { r: 'ok', up: lucky, it: a };
}
/* ---------- Zusatzwerte einzeln (6.1, Oberfläche in js/mods.js): Stufe, Umschmieden, Veredeln, Affix-Essenz ----------
   Stufe eines Zusatzwerts = die Seltenheit, zu der sein Wert gehört (pool[k].f(Stufe)): Magisch 1 … Mythisch 6.
   Veredeln hebt einen Wert um eine Stufe – höchstens Seltenheit + 2 (Set wie Episch + 2, Meisterwerk +1), nie über AFF_MAX. */
const AFF_MAX = 8;
function affPool(it) { return it.slot === 'weapon' ? AFFW : AFFA; }
function affVal(pool, k, s) { return +pool[k].f(s).toFixed(3); }
function affStufe(it, k) { const A = affPool(it)[k]; if (!A || typeof it.aff[k] !== 'number') return 0; const a = A.f(0), b = A.f(1) - a; return clamp(Math.round((it.aff[k] - a) / b), 1, AFF_MAX); }
function affCap(it) { return Math.min(AFF_MAX, (it.rar === 5 ? 5 : it.rar) + 2 + (it.mw ? 1 : 0)); }
// Umschmieden: jedes Mal teurer (it.rr = so oft umgeschmiedet)
function affRerollCost(it) {
  const n = Math.min(20, it.rr || 0), wk = 1 - weekFx('smith'), c = { kristall: 1 + Math.floor(n / 3) };
  if (n >= 6) c.stern = Math.floor((n - 3) / 3);
  for (const m in c) c[m] = Math.max(1, Math.ceil(c[m] * wk));
  return { mats: c, gold: Math.round((60 + PRICE[it.tier] * .05) * Math.pow(1.35, n) * wk), n };
}
// mögliche neue Werte für k: alle, die der Gegenstand noch nicht hat
function affRerollOpts(it, k) { return Object.keys(affPool(it)).filter(x => x !== k && !(x in it.aff)); }
// Wert k an derselben Stelle gegen nk tauschen (Stufe s); der Namenszusatz wandert mit
function affSwap(it, k, nk, s) {
  const pool = affPool(it), o = {};
  for (const x in it.aff) { if (x === k) o[nk] = affVal(pool, nk, s); else if (x !== nk) o[x] = it.aff[x]; }
  if (it.suf && pool[k] && it.suf === pool[k].suf) it.suf = pool[nk].suf;
  it.aff = o;
}
function affReroll(it, k) {
  if (!it || !(k in it.aff)) return null;
  const opts = affRerollOpts(it, k); if (!opts.length) return null;
  const c = affRerollCost(it); if (!canAfford(c.mats, c.gold)) return 'poor';
  payMats(c.mats); P.gold -= c.gold;
  const nk = pick(opts); affSwap(it, k, nk, affStufe(it, k)); it.rr = (it.rr || 0) + 1; computeStats();
  return nk;
}
// Veredeln: eine Stufe mehr – Material nach Stufe, Gold steigt quadratisch
function affRefineCost(it, k) {
  const s = affStufe(it, k) + 1, wk = 1 - weekFx('smith');
  const c = s <= 3 ? { kristall: s } : s <= 5 ? { glut: s - 2, kristall: 2 } : s <= 7 ? { stern: s - 4, glut: 2 } : { aether: 2, stern: 3 };
  for (const m in c) c[m] = Math.max(1, Math.ceil(c[m] * wk));
  return { mats: c, gold: Math.round(70 * s * s * (1 + it.tier * .15) * wk), s };
}
function affRefine(it, k) {
  if (!it || !(k in it.aff)) return null;
  const s = affStufe(it, k); if (s >= affCap(it)) return 'max';
  const c = affRefineCost(it, k); if (!canAfford(c.mats, c.gold)) return 'poor';
  payMats(c.mats); P.gold -= c.gold; it.aff[k] = affVal(affPool(it), k, s + 1); computeStats();
  return 'ok';
}
// Affix-Essenz einsetzen: ersetzt den Wert rk (oder füllt einen freien Platz), Stufe höchstens bis affCap
function affPut(it, k, s, rk) {
  const pool = affPool(it); if (!pool[k]) return false;
  const s2 = Math.min(s, affCap(it));
  if (rk && rk in it.aff) affSwap(it, rk, k, s2);
  else if (Object.keys(it.aff).length < RAR[it.rar].aff && !(k in it.aff)) it.aff[k] = affVal(pool, k, s2);
  else return false;
  return true;
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
