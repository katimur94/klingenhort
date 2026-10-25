'use strict';
/* =========================================================
   KLINGENHORT – Elemente – Feuer, Frost, Blitz, Gift, Licht, Schatten: Schwächen, Resistenzen, Effekte
   Hängt sich über HOOK/ACTS (js/core.js) ins Spiel ein.
   Gegensätze ×1,5 („SCHWÄCHE!“), gleiches Element ×0,5 („RESISTENT“).
   Waffe it.el = Element der Treffer, Rüstung/Helm it.el = Schutz vor diesem Element.
   ========================================================= */

/* n = Name, g = Zeichen, opp = Gegensatz, c = Farbe in 4 Stufen (dunkel → hell) */
const ELEM = {
  feuer: { n: _t('Feuer'), g: '✹', opp: 'frost', c: ['#7a1e10', '#d8401e', '#ff8a3a', '#ffd27a'] },
  frost: { n: _t('Frost'), g: '❅', opp: 'feuer', c: ['#1e4a7a', '#3a8ad8', '#8ad8ff', '#e8faff'] },
  blitz: { n: _t('Blitz'), g: 'ϟ', opp: 'gift', c: ['#6a5a10', '#c8a81e', '#ffe04a', '#fffbd0'] },
  gift: { n: _t('Gift'), g: '☣', opp: 'blitz', c: ['#1e4a1a', '#3a8a2a', '#79e04a', '#d8ffb0'] },
  licht: { n: _t('Licht'), g: '☼', opp: 'schatten', c: ['#8a6a2a', '#e8c860', '#fff2b0', '#ffffff'] },
  schatten: { n: _t('Schatten'), g: '☾', opp: 'licht', c: ['#1e1030', '#5a3a9a', '#a87af0', '#e0ccff'] }
};
const ELORDER = Object.keys(ELEM);
const elCol = el => ELEM[el] ? ELEM[el].c[2] : '#c8c8c8';
// Was ein Element beim Treffer bewirkt (für Gegenstandszeilen)
const ELFX_D = {
  feuer: _t('setzt in Brand'), frost: _t('verlangsamt'), blitz: _t('springt auf einen Nachbarn über'),
  gift: _t('vergiftet'), licht: _t('heilt dich'), schatten: _t('Schattenstoß mit Zusatzschaden')
};

/* Element jeder Gegnerart (fehlt = neutral). Untote/Geister Schatten, Feuerwesen Feuer, Eis Frost,
   Sumpf/Gift Gift, Golems/Sprengmeister Blitz, Heiliges/Gold Licht. Bosse haben immer eins. */
const EN_EL = {
  skeleton: 'schatten', skelarcher: 'schatten', mage: 'schatten', geist: 'schatten', skelmage: 'schatten', zombie: 'schatten', todesritter: 'schatten', schattenimp: 'schatten', varkas: 'schatten',
  imp: 'feuer', chort: 'feuer', pyro: 'feuer', glutschleim: 'feuer', lavadaemon: 'feuer', jungdrache: 'feuer', demon: 'feuer', pyraxis: 'feuer',
  icez: 'frost', eisgeist: 'frost', frostoger: 'frost', frostra: 'frost',
  slime: 'gift', toxslime: 'gift', seuche: 'gift', hexe: 'gift', shaman: 'gift', morbus: 'gift',
  golem: 'blitz', zwerg: 'blitz', bomber: 'blitz',
  engel: 'licht', lizshaman: 'licht', goldgob: 'licht', goldmimik: 'licht'
};
const BOSS_EL = 'blitz'; // Bosse ohne eigenes Element (Ogerhäuptling): Donnerhammer
/* Natürliches Element mancher Fähigkeiten (sonst das der Waffe) */
const SKILL_EL = { m1: 'feuer', m2: 'frost', m3: 'blitz', mu: 'feuer', r2: 'gift' };
/* Runen-Bonus je Element (pro Runen-Stufe) */
const RUNE_BONUS = {
  feuer: { k: 'dmg', v: .01, s: v => _t('Schaden +{v}', { v: pc1(v) }) },
  frost: { k: 'def', v: 1, s: v => _t('VER +{v}', { v: Math.round(v) }) },
  blitz: { k: 'aspd', v: .008, s: v => _t('Tempo +{v}', { v: pc1(v) }) },
  gift: { k: 'regen', v: .15, s: v => _t('Regeneration +{v}', { v: v.toLocaleString(LOCALE, { maximumFractionDigits: 1 }) }) },
  licht: { k: 'hp', v: .012, s: v => _t('LP +{v}', { v: pc1(v) }) },
  schatten: { k: 'critdmg', v: .025, s: v => _t('Krit-Schaden +{v}', { v: pc1(v) }) }
};
// Prozent mit einer Nachkommastelle
function pc1(v) { return _t('{n} %', { n: (v * 100).toLocaleString(LOCALE, { maximumFractionDigits: 1 }) }); }

/* ---------- Werte ---------- */
// Elementstärke eines Gegenstands (wie eine Bauteil-Stufe 1–10): Meisterwerk = Kern/Rune, sonst nach Seltenheit
function elPow(it) {
  if (!it || !it.el) return 0;
  if (it.mw) return it.mw[it.slot === 'weapon' ? 'kern' : 'rune'] || 1;
  return [1, 1, 3, 4, 5, 5, 7][it.rar] || 1;
}
const elProc = g => .1 + g * .02;            // Waffe: Chance auf den Element-Effekt je Treffer
const elRes = g => .12 + g * .016;           // Rüstung/Helm: weniger Schaden von diesem Element
// Element für erbeutete Gegenstände: ~25 % der seltenen Waffen, ~18 % der seltenen Rüstungen (Meisterwerke bekommen es vom Bauteil)
function elRoll(it) {
  if (it.mw || it.el) return;
  if (it.rar >= 2 && Math.random() < (it.slot === 'weapon' ? .25 : .18)) it.el = pick(ELORDER); else delete it.el;
}
// Element eines Gegners (beim ersten Blick festgelegt): Art, Bosse immer, Elite manchmal, Champions immer
function enemyEl(e) {
  if (e.el !== undefined) return e.el;
  let el = EN_EL[e.t] || null;
  if (!el && e.ai !== 'dummy') { if (e.boss) el = BOSS_EL; else if (e.champ || (e.elite && Math.random() < .35)) el = pick(ELORDER); }
  return e.el = el;
}
// Element und Stärke eines Treffers (w = Waffen-/Schadensobjekt)
function hitEl(w) { return w && 'el' in w ? w.el : ((P && P.gear.weapon && P.gear.weapon.el) || null); }
function hitPow(w, el) { if (w && w.elp != null) return w.elp; const it = P.gear.weapon; return it && it.el === el ? elPow(it) : 3; }
// Element eines Angreifers (Gegner, Geschoss, Schlag)
function srcEl(src) {
  if (!src) return null;
  if (src.def && src.t) return enemyEl(src);
  if (src.src && src.src.t) return enemyEl(src.src);
  if (src.t) return EN_EL[src.t] || null;
  if (src.k === 'fire') return 'feuer';
  if (src.k === 'flask') return 'gift';
  return null;
}
// Schutz der angelegten Rüstung gegen ein Element (0 … 0,6)
function elGuard(el) { let r = 0; for (const s of ['armor', 'helm']) { const it = P.gear[s]; if (it && it.el === el) r += elRes(elPow(it)); } return Math.min(.6, r); }

/* ---------- Kampf ---------- */
let elTxtT = 0, elHealT = 0, elGuardT = 0;
function elWeakTxt(e, weak, el) {
  if (T < elTxtT || (e.wkT || 0) > T) return;
  elTxtT = T + .35; e.wkT = T + 1.6;
  txt(e.x, e.y - 24 * (e.sc || 1) - (e.z || 0), weak ? _t('SCHWÄCHE!') : _t('RESISTENT'), weak ? elCol(el) : '#a8a4b4', weak);
}
HOOK.hit.push((d, e, w) => {
  const el = hitEl(w); if (!el || !ELEM[el]) return d;
  const ee = enemyEl(e); if (!ee) return d;
  if (ELEM[el].opp === ee) { elWeakTxt(e, true, el); return d * 1.5; }
  if (el === ee) { elWeakTxt(e, false, el); return d * .5; }
  return d;
});
HOOK.afterHit.push((e, w, dmg) => {
  const el = hitEl(w); if (!el || !ELEM[el] || dmg <= 0 || state !== 'play') return;
  if ((e.elT || 0) > T) return;
  const g = hitPow(w, el); if (Math.random() >= elProc(g)) return;
  e.elT = T + .3; elProcFx(el, e, w, dmg, g);
});
function elProcFx(el, e, w, dmg, g) {
  const k = 1 + g * .08, C = ELEM[el].c, base = (w && w.dmg) || dmg, h = 10 * (e.sc || 1) + (e.z || 0);
  for (let i = 0; i < 6; i++) part(e.x + rnd(-4, 4), e.y, h + rnd(-3, 5), rnd(-30, 30), rnd(-12, 12), rnd(20, 60), pick(C.slice(1)), rnd(.3, .6), 1, 60, 1);
  if (el === 'feuer') { if (!e.dead) { e.burn = Math.max(e.burn || 0, 3); e.burnDmg = Math.max(e.burnDmg || 0, Math.max(1, Math.round(base * .15 * k))); } }
  else if (el === 'frost') { if (!e.dead) e.chill = Math.max(e.chill || 0, 1.5 + g * .12); }
  else if (el === 'gift') { if (!e.dead) { e.poison = Math.max(e.poison || 0, 4); e.poisonDmg = Math.max(e.poisonDmg || 0, Math.max(1, Math.round(base * .12 * k))); } }
  else if (el === 'blitz') {
    let t = null, b = 70; for (const o of enemies) { if (o === e || o.dead || o.st === 'spawn' || o.under > 0) continue; const d = Math.hypot(o.x - e.x, o.y - e.y); if (d < b) { b = d; t = o; } }
    if (t) { fx.push({ k: 'zap', pts: [[e.x, e.y - 8 * (e.sc || 1)], [t.x, t.y - 8 * (t.sc || 1)]], life: .2, max: .2 }); sfx('zap'); hurtEnemy(t, Math.max(1, Math.round(dmg * .4 * k)), (t.x - e.x) / (b || 1), (t.y - e.y) / (b || 1), 30, false, true); }
  }
  else if (el === 'licht') {
    if (T >= elHealT && P.hp > 0) { elHealT = T + .8; const hv = Math.max(1, Math.round(P.st.hp * .012 * k + dmg * .02)); P.hp = Math.min(P.st.hp, P.hp + hv); txt(P.x, P.y - 22, '+' + hv, C[2]); for (let i = 0; i < 5; i++) part(P.x + rnd(-5, 5), P.y, rnd(2, 14), 0, 0, rnd(20, 40), C[3], rnd(.4, .7), 1, -10, 1); }
  }
  else if (el === 'schatten') { if (!e.dead) { spark(e.x, e.y - 8 * (e.sc || 1), rnd(0, 6.28), C[2]); hurtEnemy(e, Math.max(1, Math.round(dmg * .3 * k)), 0, 0, 0, false, true); } }
}
// Natürliches Element der Fähigkeit oder das der Waffe
HOOK.skill.push((id, w) => {
  const it = P.gear.weapon, wel = (it && it.el) || null, sel = SKILL_EL[id];
  w.el = sel || wel; w.elp = sel && sel !== wel ? 3 : Math.max(sel ? 3 : 0, elPow(it));
});
// Eingehender Schaden: Elementschutz von Rüstung und Helm
HOOK.hurt.push((d, src) => {
  const el = srcEl(src); if (!el) return d;
  const r = elGuard(el); if (!r) return d;
  if (T >= elGuardT) { elGuardT = T + 2.5; txt(P.x, P.y - 34, _t('GESCHÜTZT'), elCol(el)); }
  return d * (1 - r);
});
// Runen-Boni von Rüstung und Helm
HOOK.stats.push(add => {
  for (const s of ['armor', 'helm']) { const it = P.gear[s]; if (it && it.mw && it.el && it.mw.rune && RUNE_BONUS[it.el]) { const B = RUNE_BONUS[it.el]; add(B.k, B.v * it.mw.rune); } }
});
// Leuchten der Elementwaffe: Funken an der Hand, beim Angriff mehr
HOOK.update.push(() => {
  if (!P || !G || state !== 'play' || !P.hand || P.roll > 0) return;
  const it = P.gear.weapon; if (!it || !it.el || !ELEM[it.el]) return;
  if (Math.random() < (P.atkT > 0 || P.spin > 0 ? .45 : .07)) { const C = ELEM[it.el].c; part(P.hand.x + CX + rnd(-3, 3), P.y + rnd(-1, 1), (P.y - CY) - P.hand.y + rnd(-6, 2), rnd(-8, 8), rnd(-4, 4), rnd(4, 18), Math.random() < .5 ? C[2] : C[3], rnd(.25, .5), 1, -8, 1); }
});

/* ---------- Grafik: Element-Zeichen (5×5, mit Umriss) ---------- */
const ELBITS = {
  feuer: ['..#..', '.##..', '.###.', '#####', '.###.'],
  frost: ['#.#.#', '.###.', '##.##', '.###.', '#.#.#'],
  blitz: ['..##.', '.##..', '#####', '..##.', '.##..'],
  gift: ['..#..', '.###.', '#####', '#####', '.###.'],
  licht: ['..#..', '.###.', '#####', '.###.', '..#..'],
  schatten: ['.###.', '##...', '##...', '##...', '.###.']
};
function elBits(b, el, x0, y0, C) {
  const rows = ELBITS[el];
  for (let y = 0; y < 5; y++) for (let x = 0; x < 5; x++) if (rows[y][x] === '#') b.set(x0 + x, y0 + y, y === 0 || (x === 0 && y < 3) ? C[3] : y >= 4 ? C[1] : C[2]);
}
const ELPIP = {};
function elPip(el) {
  if (ELPIP[el]) return ELPIP[el];
  const b = PB(7, 7); elBits(b, el, 1, 1, ELEM[el].c);
  return ELPIP[el] = pbCanvas(pbOutline(b));
}
const ELICON = {};
function elIconURL(el) { return ELICON[el] || (ELICON[el] = mk(9, 9, g => g.drawImage(elPip(el), 1, 1)).toDataURL()); }
// kleines Element-Schild für Menüs: Zeichen + Name in Elementfarbe
function elTag(el, txt_) { if (!el || !ELEM[el]) return ''; return `<span class="eltag" style="color:${elCol(el)}"><img src="${elIconURL(el)}" alt="">${txt_ != null ? txt_ : ELEM[el].n}</span>`; }

// Punkt in Elementfarbe neben dem Gegner (links über dem Kopf, neben dem Lebensbalken)
HOOK.drawEnemy.push(e => {
  if (e.st === 'spawn' || e.under > 0 || e.fade > .6 || e.ai === 'dummy') return;
  const el = enemyEl(e); if (!el) return;
  const s = SP[e.sp]; if (!s) return;
  const sc = (e.sc || 1) * depthScale(e.y), sx = Math.round(e.x - CX), sy = Math.round(e.y - CY);
  const top = sy - Math.round(e.z || 0) - Math.round((s.h - 2) * sc), w = Math.round(14 * (e.sc || 1)), c = elPip(el);
  if (e.alpha != null) ctx.globalAlpha = Math.max(.35, e.alpha);
  ctx.drawImage(c, sx - Math.round(w / 2) - c.width, top - 7);
  ctx.globalAlpha = 1;
});

/* ---------- Texte ---------- */
// Zeile im Bestiarium
function elBestiaryHTML(k) {
  const el = EN_EL[k] || (EN[k] && EN[k].boss ? BOSS_EL : null);
  if (!el) return `<div class="st">${_t('Kein Element')}</div>`;
  return `<div class="st">${elTag(el)} · ${_t('anfällig für {el}', { el: elTag(ELEM[el].opp) })} · ${_t('widersteht {el}', { el: ELEM[el].n })}</div>`;
}
// Zeilen für Gegenstände
HOOK.itemLines.push((it, L) => {
  if (!it.el || !ELEM[it.el]) return;
  const E = ELEM[it.el], g = elPow(it);
  if (it.slot === 'weapon') L.push(_t('{g} {el}: {p} Chance je Treffer – {fx} · ×1,5 gegen {weak}', { g: E.g, el: E.n, p: pct(elProc(g)), fx: ELFX_D[it.el], weak: ELEM[E.opp].n }));
  else L.push(_t('{g} {el}-Schutz: −{p} Schaden von {el}-Gegnern', { g: E.g, el: E.n, p: pct(elRes(g)) }));
});

document.head.insertAdjacentHTML('beforeend', '<style>.eltag{display:inline-flex;align-items:center;gap:3px;white-space:nowrap}.eltag img{width:14px;height:14px;image-rendering:pixelated}'
  + ELORDER.map(k => `.slot[aria-label*="${ELEM[k].g}"]::before{content:"";position:absolute;right:3px;top:3px;width:7px;height:7px;background:${ELEM[k].c[2]};box-shadow:0 0 0 1px #000,inset -1px -1px 0 ${ELEM[k].c[1]}}`).join('') + '</style>');
