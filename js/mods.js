'use strict';
/* =========================================================
   KLINGENHORT – Gegenstände modifizieren: Mod-Plätze, Runen, Glyphen, Essenzen, Kerne, Prägungen, Resonanzen, Umschmieden
   Hängt sich über HOOK/ON (js/core.js) ins Spiel ein. Oberfläche unter VERBESSERN (js/forge.js), Zusatzwert-Helfer in js/items.js.
   Mods liegen pro Held in P.mods als Anzahl je Schlüssel: 'rune_kraft:3', 'glyphe_kette:7' (Stufe 1–10),
   Affix-Essenzen (vom Extrahieren) als 'aff_wucht:4' (Stufe des Zusatzwerts 1–8).
   Gegenstand: it.mods = ['glyphe_kette:3', …] (Plätze nach Seltenheit: modSlots), it.rr = so oft umgeschmiedet,
   it.el0 = ursprüngliches Element, solange eine Essenz es ersetzt. Jede Art nur einmal je Gegenstand, höchstens eine Essenz.
   Gleiche Glyphe/gleicher Kern auf mehreren angelegten Teilen: nur der stärkste wirkt. Runen und Prägungen zählen zusammen.
   Resonanzen: bestimmte Mods zusammen auf einem Gegenstand (oder über die ganze Ausrüstung) wecken eine neue Kraft.
   Kampf: Glyphen mit eigener Abklingzeit; was Glyphen treffen oder töten, löst keine weiteren Glyphen aus (keine Schleifen).
   Konto: SAVE.meta.mods = { book: { id: Tag der Entdeckung }, found, ins, rr, vd, ex }
   Schnittstelle (Welt, Bosse, Artefakte, Begleiter, Basar):
     modRoll(depth 0–1, luck ≥ 1, R?) → Schlüssel · modName(k) · modIconURL(k) · modValue(k) → Gold je Stück · modValid(k)
     modGive(k, n, zeigen?) → true/false · modLootHTML({ t: 'mod', k, n }, rechts?) · modDrop(x, y, k, n) legt Beute auf den Boden
     Beute-Eintrag: { t: 'mod', k, n }. Bodenbeute { k: 'mod', mk, n } – in den Landen über landePackAdd(eintrag), falls es das gibt.
   ========================================================= */

/* ---------- Familien und Arten ---------- */
const MOD_MAX = 10, MOD_GEAR = ['weapon', 'armor', 'helm'];
const MOD_FAM = {
  rune: { n: _t('Runen'), d: _t('Feste Werte wie Schaden, Leben oder Tempo.'), w: 30, ic: 'rune_kraft:5' },
  glyphe: { n: _t('Glyphen'), d: _t('Lösen bei Treffern, Kills oder Krits eigene Effekte aus.'), w: 18, ic: 'glyphe_kette:5' },
  essenz: { n: _t('Essenzen'), d: _t('Waffe: Element der Treffer. Rüstung und Helm: Schutz vor dem Element.'), w: 15, ic: 'essenz_feuer:5' },
  kern: { n: _t('Kerne'), d: _t('Verbessern eine Gruppe deiner Fähigkeiten.'), w: 15, ic: 'kern_salve:5' },
  praeg: { n: _t('Prägungen'), d: _t('Ein kleiner Wert und ein farbiges Leuchten an deinem Helden.'), w: 22, ic: 'praeg_gold:5' },
  aff: { n: _t('Affix-Essenzen'), d: _t('Ein Zusatzwert zum Mitnehmen – aus dem Extrahieren.'), w: 0, ic: 'aff_wucht:5' }
};
const MOD_FAMS = ['rune', 'glyphe', 'essenz', 'kern', 'praeg'];
const mn1 = v => (Math.round(v * 10) / 10).toLocaleString(LOCALE, { maximumFractionDigits: 1 });
const mHas = (o, k) => !!o && Object.prototype.hasOwnProperty.call(o, k);
// Runen: st = Wert, v = je Stufe
const MOD_RUNE = {
  kraft: { n: _t('Rune der Kraft'), c: '#e8402a', st: 'dmg', v: .012, s: v => _t('Schaden +{v}', { v: pc1(v) }) },
  schaerfe: { n: _t('Rune der Schärfe'), c: '#3ac87a', st: 'crit', v: .005, s: v => _t('Krit +{v}', { v: pc1(v) }) },
  eile: { n: _t('Rune der Eile'), c: '#ffe04a', st: 'aspd', v: .012, s: v => _t('Tempo +{v}', { v: pc1(v) }) },
  leben: { n: _t('Rune des Lebens'), c: '#ff6a8a', st: 'hp', v: .015, s: v => _t('LP +{v}', { v: pc1(v) }) },
  stein: { n: _t('Rune des Steins'), c: '#a8b2c2', st: 'def', v: 1.5, s: v => _t('VER +{v}', { v: Math.round(v) }) },
  heil: { n: _t('Rune der Heilung'), c: '#79e04a', st: 'regen', v: .15, s: v => _t('Regeneration +{v}', { v: mn1(v) }) },
  wind: { n: _t('Rune des Windes'), c: '#8ee6ea', st: 'spd', v: .006, s: v => _t('Lauftempo +{v}', { v: pc1(v) }) },
  zorn: { n: _t('Rune des Zorns'), c: '#ff8a3a', st: 'critdmg', v: .03, s: v => _t('Krit-Schaden +{v}', { v: pc1(v) }) },
  fokus: { n: _t('Rune des Fokus'), c: '#57a7d6', st: 'cdr', v: .006, s: v => _t('Abklingzeit −{v}', { v: pc1(v) }) },
  glueck: { n: _t('Rune des Glücks'), c: '#e8d04a', st: 'gold', v: .03, s: v => _t('Gold +{v}', { v: pc1(v) }) }
};
// Glyphen: on = Auslöser, ch = Chance, cd = eigene Abklingzeit (s), v = Anteil am Waffenschaden
const MOD_GLYPH = {
  kette: { n: _t('Kettenglyphe'), c: '#8ad8ff', on: 'hit', ch: t => .08 + .012 * t, cd: 1.2, v: t => .25 + .025 * t, j: t => 2 + (t >= 6 ? 1 : 0) },
  frost: { n: _t('Frostglyphe'), c: '#bfefff', on: 'hit', ch: t => .06 + .008 * t, cd: 3, v: t => .2 + .02 * t, r: t => 34 + 1.5 * t, fr: t => .5 + .05 * t },
  leben: { n: _t('Lebensglyphe'), c: '#79e04a', on: 'kill', ch: () => 1, cd: .3, v: t => .01 + .002 * t },
  geist: { n: _t('Geisterglyphe'), c: '#d8f4ff', on: 'kill', ch: t => .06 + .008 * t, cd: 4, v: t => .6 + .06 * t, s: t => 5 + .3 * t },
  blut: { n: _t('Blutglyphe'), c: '#e8402a', on: 'hit', ch: t => .1 + .015 * t, cd: .25, v: t => .05 + .007 * t },
  explosion: { n: _t('Sprengglyphe'), c: '#ffb03a', on: 'kill', ch: t => .15 + .025 * t, cd: .5, v: t => .4 + .05 * t, r: t => 26 + t },
  meteor: { n: _t('Sternglyphe'), c: '#ff8a3a', on: 'crit', ch: t => .15 + .02 * t, cd: 2.5, v: t => .8 + .08 * t },
  schatten: { n: _t('Schattenglyphe'), c: '#a87af0', on: 'hit', ch: t => .08 + .012 * t, cd: .4, v: t => .3 + .03 * t },
  vergeltung: { n: _t('Vergeltungsglyphe'), c: '#ff6a5a', on: 'hurt', ch: () => 1, cd: t => 5 - .2 * t, v: t => .5 + .06 * t },
  wirbel: { n: _t('Wirbelglyphe'), c: '#e8eef8', on: 'crit', ch: t => .08 + .01 * t, cd: 5, v: t => .12 + .015 * t }
};
const MOD_ESS = { feuer: _t('Feueressenz'), frost: _t('Frostessenz'), blitz: _t('Blitzessenz'), gift: _t('Giftessenz'), licht: _t('Lichtessenz'), schatten: _t('Schattenessenz') };
// Kerne: sk = Fähigkeiten der Gruppe (alle Klassen), g = Name der Gruppe
const MOD_KERN = {
  salve: { n: _t('Salvenkern'), c: '#ff9a5a', sk: ['m1', 'm3', 'r2', 'a1', 'au'], g: _t('Geschoss-Fähigkeiten') },
  weite: { n: _t('Weitenkern'), c: '#79e0c0', sk: ['k2', 'm1', 'm2', 'a2', 'ku', 'mu'], g: _t('Flächen-Fähigkeiten') },
  wucht: { n: _t('Wuchtkern'), c: '#e8402a', sk: ['k2', 'm1', 'm2', 'a2', 'ku', 'mu'], g: _t('Flächen-Fähigkeiten') },
  sprung: { n: _t('Sprungkern'), c: '#b892f4', sk: ['k1', 'r1'], g: _t('Bewegungs-Fähigkeiten') },
  bund: { n: _t('Bundkern'), c: '#9be070', sk: ['k3', 'r3', 'a3', 'ru'], g: _t('Schutz- und Helfer-Fähigkeiten') },
  fluss: { n: _t('Flusskern'), c: '#57a7d6', sk: ['k1', 'k2', 'k3', 'm1', 'm2', 'm3', 'r1', 'r2', 'r3', 'a1', 'a2', 'a3'], g: _t('alle Fähigkeiten') },
  zorn: { n: _t('Zornkern'), c: '#ffd24a', sk: ['ku', 'mu', 'ru', 'au'], g: _t('Ultimative') }
};
const KERN_BUND = { k3: .15, r3: .1, a3: .6, ru: .3 };
const kernSalve = t => t >= 9 ? 3 : t >= 5 ? 2 : 1, kernAu = t => (t >= 5 ? 1 : 0) + (t >= 9 ? 1 : 0);
// Prägungen: kleiner Wert und Leuchten (c, c2)
const MOD_PRAEG = {
  gold: { n: _t('Goldprägung'), c: '#ffd24a', c2: '#fff3c0', st: 'gold', v: .02, s: v => _t('Gold +{v}', { v: pc1(v) }) },
  glut: { n: _t('Glutprägung'), c: '#ff7a2a', c2: '#ffd27a', st: 'dmg', v: .005, s: v => _t('Schaden +{v}', { v: pc1(v) }) },
  eis: { n: _t('Eisprägung'), c: '#8ad8ff', c2: '#e8faff', st: 'def', v: .8, s: v => _t('VER +{v}', { v: mn1(v) }) },
  smaragd: { n: _t('Smaragdprägung'), c: '#4ade80', c2: '#c8f0a0', st: 'hp', v: .007, s: v => _t('LP +{v}', { v: pc1(v) }) },
  nacht: { n: _t('Nachtprägung'), c: '#b07ae8', c2: '#e0ccff', st: 'crit', v: .0025, s: v => _t('Krit +{v}', { v: pc1(v) }) },
  stern: { n: _t('Sternprägung'), c: '#e8eef8', c2: '#ffffff', st: 'xp', v: .015, s: v => _t('EP +{v}', { v: pc1(v) }) }
};
const MODK = {};
for (const id in MOD_RUNE) MODK['rune_' + id] = Object.assign({ f: 'rune', id }, MOD_RUNE[id]);
for (const id in MOD_GLYPH) MODK['glyphe_' + id] = Object.assign({ f: 'glyphe', id }, MOD_GLYPH[id]);
for (const el of ELORDER) MODK['essenz_' + el] = { f: 'essenz', id: el, n: MOD_ESS[el], c: ELEM[el].c[2] };
for (const id in MOD_KERN) MODK['kern_' + id] = Object.assign({ f: 'kern', id }, MOD_KERN[id]);
for (const id in MOD_PRAEG) MODK['praeg_' + id] = Object.assign({ f: 'praeg', id }, MOD_PRAEG[id]);
const MOD_KINDS = Object.keys(MODK);
const MOD_VB = { rune: 50, glyphe: 75, essenz: 60, kern: 70, praeg: 40 };   // Gold je Stück auf Stufe 1, ×2,4 je Stufe
if (!PERSIST.includes('mods')) PERSIST.push('mods');

/* ---------- Schlüssel, Name, Wert ---------- */
const MODP = new Map();
function modParse(k) {
  if (typeof k !== 'string' || k.length > 24) return null;
  if (MODP.has(k)) return MODP.get(k);
  const m = /^([a-z]{3,7})_([a-z]{3,12}):(\d{1,2})$/.exec(k); if (!m) return null;
  const f = m[1], id = m[2], t = +m[3]; let r = null;
  if (f === 'aff') { const w = mHas(AFFW, id), a = mHas(AFFA, id); if ((w || a) && t >= 1 && t <= AFF_MAX) r = { k: 'aff_' + id, f, id, t, w }; }
  else if (mHas(MODK, f + '_' + id) && MODK[f + '_' + id].f === f && t >= 1 && t <= MOD_MAX) r = { k: f + '_' + id, f, id, t, D: MODK[f + '_' + id] };
  if (r) MODP.set(k, r);
  return r;
}
function modValid(k) { return !!modParse(k); }
const mKey = (kind, t) => kind + ':' + t;
function modName(k) {
  const p = modParse(k); if (!p) return '?';
  if (p.f === 'aff') { const pool = p.w ? AFFW : AFFA; return _t('Affix-Essenz {t}: {aff}', { t: ROMAN[p.t], aff: pool[p.id].s(affVal(pool, p.id, p.t)) }); }
  return _t('{mod} {t}', { mod: p.D.n, t: ROMAN[p.t] });
}
const modCol = k => { const p = modParse(k); return p ? gradeCol(Math.min(10, p.t)) : '#c8c8c8'; };
function modValue(k) {
  const p = modParse(k); if (!p) return 0;
  return p.f === 'aff' ? Math.round(70 * Math.pow(2.2, p.t - 1)) : Math.round(MOD_VB[p.f] * Math.pow(2.4, p.t - 1));
}
function modHave(k) { return (P && P.mods && P.mods[k]) || 0; }
function modAdd(k, n) { if (!P.mods) P.mods = {}; const v = Math.min(9999, (P.mods[k] || 0) + n); if (v > 0) P.mods[k] = v; else delete P.mods[k]; }
// Mod in den Vorrat (Beute, Belohnung); zeigen = Meldung
function modGive(k, n, show) {
  n = Math.max(1, Math.floor(+n) || 1);
  if (!P || !modParse(k)) return false;
  const M = SAVE.meta.mods, first = !M.found; modAdd(k, n); M.found += n;
  if (show) { toast(_t('Mod gefunden: {mod}', { mod: modName(k) }) + (n > 1 ? ' ×' + n : ''), modCol(k)); sfx('loot'); }
  if (first) setTimeout(() => toast(_t('Dein erster Mod! Setz ihn an einer Werkbank oder in der Schmiede ein: VERBESSERN → MODS.'), '#ffd24a'), 2400);   // erst die eigentliche Meldung (z. B. „Gekauft!“) zeigen
  return true;
}
function modDrop(x, y, k, n) { if (!modParse(k)) return; pickups.push({ k: 'mod', mk: k, n: n || 1, x, y, z: 8, vz: 120, vx: rnd(-30, 30), vy: rnd(-15, 15), t: 0 }); }
// zufälliger Mod nach Tiefe der Welt (0 am Weltentor, 1 am Rand) und Glück; R = Zufallsquelle (für feste Welt-Inhalte)
function modRoll(depth, luck, R) {
  R = R || Math.random; depth = clamp(+depth || 0, 0, 1); luck = Math.max(1, +luck || 1);
  let t = Math.floor(1 + depth * 9 + R() * 1.5 - .5);
  if (R() < .04 * Math.min(4, luck)) t++; if (R() < .15) t--;
  const W = {}; for (const f of MOD_FAMS) W[f] = MOD_FAM[f].w;
  const f = wpick(W, R), ks = MOD_KINDS.filter(k => MODK[k].f === f);
  return mKey(ks[Math.floor(R() * ks.length)], clamp(t, 1, MOD_MAX));
}
// Kampagne: niedrige Stufen (1–5) nach Gebiet
function modRollCamp(st) {
  const t = 1 + (st >= 22 ? 1 : 0) + (st >= 50 ? 1 : 0) + (qualOf(P.act) >= 4 ? 1 : 0) + (Math.random() < .08 ? 1 : 0);
  const k = modRoll(0, 1); return k.split(':')[0] + ':' + clamp(t, 1, 5);
}
// Zeile für Beutelisten (Rucksack, Begleiter-Tasche, Belohnungen)
function modLootHTML(e, right) {
  if (!e || e.t !== 'mod' || !modParse(e.k)) return '';
  const p = modParse(e.k), n = Math.max(1, Math.floor(+e.n) || 1), c = modCol(e.k);
  return `<div class="row" style="cursor:default"><div class="ic" style="box-shadow:inset 0 0 0 2px ${c}"><img src="${modIconURL(e.k)}" alt=""></div><div><div class="nm" style="color:${c}">${esc(modName(e.k))}${n > 1 ? ' ×' + n : ''}</div><div class="st">${esc(MOD_FAM[p.f].n)} · ${esc(modDesc(e.k))}</div></div>${right != null ? right : `<span class="pill dim">${_t('{n} G', { n: fmt(modValue(e.k) * n) })}</span>`}</div>`;
}

/* ---------- Wirkung als Text ---------- */
function glyphDesc(id, t) {
  const G = MOD_GLYPH[id], p = pct(G.ch(t)), v = pct(G.v(t));
  switch (id) {
    case 'kette': return _t('{p} je Treffer: Kettenblitz auf {n} Gegner, je {v} Waffenschaden', { p, n: G.j(t), v });
    case 'frost': return _t('{p} je Treffer: Frostnova um das Ziel ({v} Waffenschaden), friert {s} s ein', { p, v, s: mn1(G.fr(t)) });
    case 'leben': return _t('Jeder Kill heilt {v} deiner LP', { v: pc1(G.v(t)) });
    case 'geist': return _t('{p} je Kill: ein Geist kämpft {s} s mit', { p, s: Math.round(G.s(t)) });
    case 'blut': return _t('{p} je Treffer: Blutung, 4 s lang je Sekunde {v} Waffenschaden', { p, v: pct(G.v(t) * 2) });
    case 'explosion': return _t('{p} je Kill: der Gegner explodiert ({v} Waffenschaden ringsum)', { p, v });
    case 'meteor': return _t('{p} je kritischem Treffer: ein Meteor schlägt ein ({v} Waffenschaden)', { p, v });
    case 'schatten': return _t('{p} je Treffer: eine Schattenklinge trifft noch einmal ({v} Waffenschaden)', { p, v });
    case 'vergeltung': return _t('Wirst du getroffen: Druckwelle mit {v} Waffenschaden, höchstens alle {s} s', { v, s: mn1(G.cd(t)) });
    case 'wirbel': return _t('{p} je kritischem Treffer: Klingenwirbel um dich, 1,4 s lang je {v} Waffenschaden', { p, v });
  }
  return '';
}
function kernDesc(id, t) {
  const K = MOD_KERN[id], C = P && CLASSES[P.cls], mine = C ? C.skills.concat([C.ult]).filter(s => K.sk.includes(s)) : [], nm = s => SKILLS[s].n, list = mine.map(nm).join(', ');
  let fx = '';
  switch (id) {
    case 'salve': { const n = kernSalve(t), A = []; for (const s of mine) { if (s === 'a1') A.push(_t('Fächerschuss: Pfeile +{n}', { n })); else if (s === 'r2') A.push(_t('Giftklingen: Messer +{n}', { n })); else if (s === 'm3') A.push(_t('Kettenblitz: Sprünge +{n}', { n })); else if (s === 'm1') A.push(t >= 10 ? _t('Feuerball +{v} Schaden und ein zweiter Feuerball', { v: pct(.03 * t) }) : _t('Feuerball +{v} Schaden', { v: pct(.03 * t) })); else if (s === 'au' && kernAu(t)) A.push(_t('Pfeilsturm: Pfeile je Salve +{n}', { n: 2 * kernAu(t) })); } fx = A.join(' · '); break; }
    case 'weite': fx = list ? _t('{skills}: Radius +{v}', { skills: list, v: pct(.03 * t) }) : ''; break;
    case 'wucht': fx = list ? _t('{skills}: Schaden +{v}', { skills: list, v: pct(.03 * t) }) : ''; break;
    case 'sprung': fx = list ? _t('{skills}: Abklingzeit −{c}, Schaden +{v}', { skills: list, c: pct(Math.min(.4, .04 * t)), v: pct(.03 * t) }) : ''; break;
    case 'bund': fx = mine.map(s => _t('{skill} +{n} s', { skill: nm(s), n: mn1(KERN_BUND[s] * t) })).join(' · '); break;
    case 'fluss': fx = _t('Fähigkeiten kosten {v} weniger', { v: pct(Math.min(.2, .02 * t)) }); break;
    case 'zorn': fx = _t('Wut-Aufbau +{v}, Ultimative +{w} Schaden', { v: pct(.04 * t), w: pct(.03 * t) }); break;
  }
  if (!C) return K.g;
  return fx || _t('{group} – wirkt nicht für {cls}', { group: K.g, cls: C.name });
}
function modDesc(k, it) {
  const p = modParse(k); if (!p) return '';
  const t = p.t;
  switch (p.f) {
    case 'rune': case 'praeg': return p.D.s(p.D.v * t);
    case 'glyphe': return glyphDesc(p.id, t);
    case 'kern': return kernDesc(p.id, t);
    case 'essenz': {
      const el = ELEM[p.id].n, v = pct(.015 * t);
      const w = _t('Waffe: Element {el} für alle Treffer, +{v} Schaden und Effekt-Chance', { el, v }), a = _t('Rüstung/Helm: {el}-Schutz, −{v} Schaden von {el}-Gegnern', { el, v });
      return !it ? w + ' · ' + a : it.slot === 'weapon' ? w : a;
    }
    case 'aff': return p.w ? _t('Für Waffen – unter UMSCHMIEDEN einsetzen') : _t('Für Rüstung und Helm – unter UMSCHMIEDEN einsetzen');
  }
  return '';
}

/* ---------- Resonanzen ----------
   need = Arten auf EINEM Gegenstand (slot: w = Waffe, a = Rüstung/Helm), test = über die ganze Ausrüstung (→ Stufe q oder 0).
   q = kleinste Stufe der beteiligten Mods; v(q) = Stärke. h = Hinweis im Buch, solange unentdeckt. */
const maxT = L => L.reduce((m, p) => Math.max(m, p.t), 0);
const RESO = [
  { id: 'flammenregen', n: _t('Flammenregen'), need: ['glyphe_meteor', 'essenz_feuer'], d: () => _t('Die Sternglyphe ruft drei brennende Meteore statt einem.'), h: _t('Ein fallender Stern trifft auf Feuer …') },
  { id: 'frostfessel', n: _t('Frostfessel'), need: ['glyphe_frost', 'essenz_frost'], v: q => .1 + .005 * q, d: q => _t('Frostnova +50 % Radius, hält auch Bosse kurz fest. Gefrorene und gekühlte Gegner erleiden +{v} Schaden.', { v: pct(.1 + .005 * q) }), h: _t('Kälte, die nicht mehr loslässt.') },
  { id: 'gewitter', n: _t('Gewitterklinge'), need: ['glyphe_kette', 'essenz_blitz'], slot: 'w', d: () => _t('Der Kettenblitz springt 2 Mal weiter und lädt 40 % schneller.'), h: _t('Blitz in der Klinge, Blitz in der Kette.') },
  { id: 'seelenernte', n: _t('Seelenernte'), need: ['glyphe_leben', 'glyphe_geist'], v: q => .06 + .004 * q, d: q => _t('Alle 12 Kills ein Seelenstoß: heilt {v} LP und ruft einen Geist.', { v: pct(.06 + .004 * q) }), h: _t('Leben und Geister im selben Stück.') },
  { id: 'blutmond', n: _t('Blutmond'), need: ['glyphe_blut', 'rune_zorn'], v: q => .01 + .0005 * q, d: q => _t('Blutungen machen 50 % mehr Schaden. Kritische Treffer gegen Blutende heilen {v} LP.', { v: pc1(.01 + .0005 * q) }), h: _t('Blut und Zorn unter rotem Mond.') },
  { id: 'giftnebel', n: _t('Giftnebel'), need: ['glyphe_explosion', 'essenz_gift'], d: () => _t('Gesprengte Gegner hinterlassen 3 s eine Giftwolke.'), h: _t('Wenn Gift auf eine Explosion trifft …') },
  { id: 'schattentanz', n: _t('Schattentanz'), need: ['glyphe_schatten', 'rune_eile'], v: q => .12 + .008 * q, d: q => _t('Jede Schattenklinge gibt dir 2 s lang +{v} Tempo.', { v: pct(.12 + .008 * q) }), h: _t('Schatten, die schnell tanzen.') },
  { id: 'lichtschild', n: _t('Lichtschild'), need: ['essenz_licht', 'rune_stein'], slot: 'a', v: q => .06 + .004 * q, d: q => _t('Alle 10 s ein Lichtschild, der {v} deiner LP an Schaden schluckt.', { v: pct(.06 + .004 * q) }), h: _t('Licht und Stein schützen den Leib.') },
  { id: 'dornenhaut', n: _t('Dornenhaut'), need: ['glyphe_vergeltung', 'rune_stein'], slot: 'a', d: () => _t('Vergeltung trifft den Angreifer zusätzlich mit dem doppelten Schaden und lädt 1,5 s schneller.'), h: _t('Wer zurückschlägt, braucht eine harte Haut.') },
  { id: 'sturmlauf', n: _t('Sturmlauf'), need: ['rune_wind', 'kern_sprung'], v: q => .08 + .004 * q, d: q => _t('Nach jeder Rolle und Bewegungs-Fähigkeit 3 s lang +25 % Lauftempo und +{v} Schaden.', { v: pct(.08 + .004 * q) }), h: _t('Wind unter den Füßen eines Springers.') },
  { id: 'phoenixfunke', n: _t('Phönixfunke'), need: ['essenz_feuer', 'glyphe_leben'], v: q => .2 + .01 * q, d: q => _t('Fällst du unter 30 % LP: Feuerstoß und {v} LP zurück – einmal pro Minute.', { v: pct(.2 + .01 * q) }), h: _t('Feuer, das Leben zurückgibt.') },
  { id: 'eisenwacht', n: _t('Eiserne Wacht'), need: ['rune_stein', 'rune_leben'], slot: 'a', v: q => .04 + .004 * q, d: q => _t('Du erleidest {v} weniger Schaden.', { v: pc1(.04 + .004 * q) }), h: _t('Stein und Leben in einem Panzer.') },
  { id: 'arkaneflut', n: _t('Arkane Flut'), need: ['kern_fluss', 'rune_fokus'], d: () => _t('Jede 4. Fähigkeit kostet nichts und lädt doppelt so schnell.'), h: _t('Fluss und Fokus vereint.') },
  { id: 'kettenreaktion', n: _t('Kettenreaktion'), need: ['glyphe_explosion', 'glyphe_kette'], d: () => _t('Jede Leichensprengung entfesselt einen Kettenblitz.'), h: _t('Eine Explosion, die weiterspringt.') },
  { id: 'geisterheer', n: _t('Geisterheer'), need: ['glyphe_geist', 'kern_bund'], d: () => _t('Bis zu 4 Geister statt 2, doppelte Chance, sie bleiben 50 % länger.'), h: _t('Geister, durch einen Bund vereint.') },
  { id: 'klingensturm', n: _t('Klingensturm'), need: ['glyphe_wirbel', 'rune_schaerfe'], slot: 'w', d: () => _t('Der Klingenwirbel hält doppelt so lange und reicht 30 % weiter.'), h: _t('Ein Wirbel aus scharfen Klingen.') },
  { id: 'zornesfeuer', n: _t('Zornesfeuer'), need: ['kern_zorn', 'essenz_feuer'], v: q => .2 + .02 * q, d: q => _t('Deine Ultimative hinterlässt 4 s einen Feuerkreis ({v} Waffenschaden je halbe Sekunde).', { v: pct(.2 + .02 * q) }), h: _t('Zorn, der brennt.') },
  { id: 'salvensturm', n: _t('Salvensturm'), need: ['kern_salve', 'rune_eile'], slot: 'w', v: q => .1 + .005 * q, d: q => _t('Geschoss-Fähigkeiten: ein Geschoss mehr und +{v} Schaden.', { v: pct(.1 + .005 * q) }), h: _t('Eine Salve in Eile.') },
  { id: 'bebenerde', n: _t('Bebende Erde'), need: ['kern_weite', 'kern_wucht'], v: q => .4 + .03 * q, d: q => _t('Flächen-Fähigkeiten lösen nach 0,5 s ein Nachbeben aus ({v} Waffenschaden).', { v: pct(.4 + .03 * q) }), h: _t('Weite und Wucht lassen die Erde beben.') },
  { id: 'vampirkuss', n: _t('Vampirkuss'), need: ['glyphe_blut', 'essenz_schatten'], slot: 'w', v: q => .02 + .002 * q, d: q => _t('Treffer gegen blutende Gegner heilen dich um {v} des Schadens.', { v: pc1(.02 + .002 * q) }), h: _t('Blut und Schatten in einer Klinge.') },
  { id: 'heiligeslicht', n: _t('Heiliges Licht'), need: ['essenz_licht', 'glyphe_leben'], v: q => .015 + .001 * q, d: q => _t('Kills senden Licht aus: es heilt {v} LP und trifft Gegner ringsum.', { v: pc1(.015 + .001 * q) }), h: _t('Licht, das Leben schenkt.') },
  { id: 'frostpanzer', n: _t('Frostpanzer'), need: ['essenz_frost', 'rune_stein'], slot: 'a', v: q => .08 + .005 * q, d: q => _t('Wer dich trifft, wird gekühlt. Gekühlte Gegner machen {v} weniger Schaden.', { v: pct(.08 + .005 * q) }), h: _t('Ein Panzer aus Frost und Stein.') },
  { id: 'giftklinge', n: _t('Giftklinge'), need: ['essenz_gift', 'glyphe_blut'], slot: 'w', d: () => _t('Deine Blutungen vergiften die Gegner auch.'), h: _t('Blut und Gift auf einer Klinge.') },
  { id: 'schattenschleier', n: _t('Schattenschleier'), need: ['essenz_schatten', 'rune_wind'], d: () => _t('Nach einer Rolle bist du 1 s unsichtbar – höchstens alle 8 s.'), h: _t('Schatten und Wind verbergen dich.') },
  { id: 'funkenflug', n: _t('Funkenflug'), need: ['essenz_blitz', 'rune_eile'], v: q => .35 + .03 * q, d: q => _t('Jeder 8. Treffer schickt einen Funken auf 3 Gegner ({v} Waffenschaden).', { v: pct(.35 + .03 * q) }), h: _t('Blitz und Eile.') },
  { id: 'waechterbund', n: _t('Wächterbund'), need: ['rune_fokus', 'kern_bund'], slot: 'a', v: q => .06 + .004 * q, d: q => _t('Schutz- und Helfer-Fähigkeiten heilen dich beim Wirken um {v} LP.', { v: pct(.06 + .004 * q) }), h: _t('Fokus und Bund wachen über dich.') },
  { id: 'schmiedeharmonie', n: _t('Schmiedeharmonie'), fam: ['rune', 'glyphe', 'kern', 'praeg'], fn: (it, L) => it.mw && new Set(L.map(p => p.f)).size >= 4 ? L.reduce((m, p) => Math.min(m, p.t), 99) : 0, v: q => .06 + .004 * q, d: q => _t('Ein Meisterwerk mit Mods aus vier Familien: +{v} Schaden und LP.', { v: pct(.06 + .004 * q) }), r: () => _t('Mods aus vier verschiedenen Familien in einem Meisterwerk'), h: _t('Ein Meisterwerk voller verschiedener Mods.') },
  { id: 'dreiklang', n: _t('Dreiklang'), on: 'set', fam: ['glyphe', 'rune', 'kern'], test: S => { const w = S[0].L.filter(p => p.f === 'glyphe'), a = S[1].L.filter(p => p.f === 'rune'), h = S[2].L.filter(p => p.f === 'kern'); return w.length && a.length && h.length ? Math.min(maxT(w), maxT(a), maxT(h)) : 0; }, v: q => .04 + .003 * q, d: q => _t('+{v} Schaden und LP.', { v: pct(.04 + .003 * q) }), r: () => _t('Glyphe in der Waffe, Rune in der Rüstung, Kern im Helm'), h: _t('Drei Teile, drei Familien: Glyphe, Rune, Kern.') },
  { id: 'elementarsturm', n: _t('Elementarsturm'), on: 'set', fam: ['essenz', 'essenz', 'essenz'], test: S => { const E = {}; for (const x of S) for (const p of x.L) if (p.f === 'essenz') E[p.id] = Math.max(E[p.id] || 0, p.t); const v = Object.values(E); return v.length >= 3 ? Math.min(...v) : 0; }, v: q => .06 + .004 * q, d: q => _t('Element-Effekte der Waffe +10 % Chance, +{v} Elementschaden.', { v: pct(.06 + .004 * q) }), r: () => _t('Drei verschiedene Essenzen in der Ausrüstung'), h: _t('Drei Elemente auf einmal.') },
  { id: 'vollmond', n: _t('Vollmond'), on: 'set', fam: ['praeg', 'praeg', 'praeg'], test: S => resAll(S, 'praeg_nacht'), v: q => .12 + .008 * q, d: q => _t('+{v} Krit-Schaden und violettes Mondlicht.', { v: pct(.12 + .008 * q) }), r: () => _t('Nachtprägung auf allen drei Teilen'), h: _t('Nachtprägungen bei Vollmond …') },
  { id: 'sternenstaub', n: _t('Sternenstaub'), on: 'set', fam: ['praeg', 'praeg', 'praeg'], test: S => resAll(S, 'praeg_stern'), v: q => .08 + .005 * q, d: q => _t('+{v} EP und Sternenglanz.', { v: pct(.08 + .005 * q) }), r: () => _t('Sternprägung auf allen drei Teilen'), h: _t('Sternprägungen von Kopf bis Fuß.') },
  { id: 'gluecksritter', n: _t('Glücksritter'), on: 'set', fam: ['praeg', 'praeg', 'rune'], test: S => { const g = [], r = []; for (const x of S) for (const p of x.L) { if (p.k === 'praeg_gold') g.push(p.t); if (p.k === 'rune_glueck') r.push(p.t); } return g.length >= 2 && r.length ? Math.min(Math.max(...r), ...g.sort((a, b) => b - a).slice(0, 2)) : 0; }, v: q => .1 + .01 * q, d: q => _t('+{v} Gold, Mods fallen 25 % öfter.', { v: pct(.1 + .01 * q) }), r: () => _t('Zwei Goldprägungen und eine Rune des Glücks'), h: _t('Gold zieht Gold an.') },
  { id: 'regenbogen', n: _t('Regenbogen'), on: 'set', fam: ['praeg', 'praeg', 'praeg', 'praeg', 'praeg'], test: S => { const E = {}; for (const x of S) for (const p of x.L) if (p.f === 'praeg') E[p.id] = Math.max(E[p.id] || 0, p.t); const v = Object.values(E); return v.length >= 5 ? Math.min(...v) : 0; }, v: q => .04 + .002 * q, d: q => _t('+{v} Schaden und LP, +{d} VER und ein Regenbogen.', { v: pct(.04 + .002 * q), d: 4 + q }), r: () => _t('Fünf verschiedene Prägungen in der Ausrüstung'), h: _t('Viele Farben, ein Leuchten.') },
  { id: 'ahnenzorn', n: _t('Ahnenzorn'), on: 'set', fam: ['kern', 'kern', 'kern'], test: S => S.every(x => x.L.some(p => p.f === 'kern')) ? Math.min(...S.map(x => maxT(x.L.filter(p => p.f === 'kern')))) : 0, v: q => .15 + .01 * q, d: q => _t('+{v} Wut-Aufbau, die Ultimative heilt 15 % LP.', { v: pct(.15 + .01 * q) }), r: () => _t('Ein Kern in jedem der drei Teile'), h: _t('Kerne überall.') },
  { id: 'runenkreis', n: _t('Runenkreis'), on: 'set', fam: ['rune', 'rune', 'rune'], test: S => { const L = S.flatMap(x => x.L.filter(p => p.f === 'rune')); return L.length >= 6 ? Math.min(...L.map(p => p.t)) : 0; }, d: () => _t('Alle Runen wirken 25 % stärker.'), r: () => _t('Sechs Runen in der Ausrüstung'), h: _t('Ein Kreis aus Runen.') },
  { id: 'glyphenchor', n: _t('Glyphenchor'), on: 'set', fam: ['glyphe', 'glyphe', 'glyphe', 'glyphe'], test: S => { const E = {}; for (const x of S) for (const p of x.L) if (p.f === 'glyphe') E[p.id] = Math.max(E[p.id] || 0, p.t); const v = Object.values(E); return v.length >= 4 ? Math.min(...v) : 0; }, d: () => _t('Alle Glyphen laden 25 % schneller.'), r: () => _t('Vier verschiedene Glyphen in der Ausrüstung'), h: _t('Ein Chor aus Glyphen.') }
];
const RESOI = {}; for (const R of RESO) { RESOI[R.id] = R; if (!R.on) R.on = 'item'; if (!R.fam) R.fam = R.need.map(k => MODK[k].f); }
function resAll(S, kind) { const v = S.map(x => maxT(x.L.filter(p => p.k === kind))); return v.every(t => t > 0) ? Math.min(...v) : 0; }
// Stufe einer Gegenstands-Resonanz auf diesem Gegenstand (0 = nicht erfüllt)
function resItemQ(R, it, L) {
  if (R.slot === 'w' && it.slot !== 'weapon') return 0; if (R.slot === 'a' && it.slot === 'weapon') return 0;
  if (R.fn) return R.fn(it, L) || 0;
  let q = 99; for (const k of R.need) { const p = L.find(x => x.k === k); if (!p) return 0; q = Math.min(q, p.t); }
  return q;
}
const mParsed = it => modsOf(it).map(modParse);
function resOfItem(it) { if (!it) return []; const L = mParsed(it); return RESO.filter(R => R.on === 'item' && resItemQ(R, it, L)).map(R => R.id); }
const RV = id => { const R = RESOI[id], q = MODS.act.res[id]; return q && R.v ? R.v(q) : 0; };

/* ---------- Plätze am Gegenstand ---------- */
function modSlots(it) { return it ? ([1, 1, 2, 3, 4, 4, 5][clamp(it.rar | 0, 0, 6)] || 1) + (it.mw ? 1 : 0) : 0; }
function modsOf(it) { return it && Array.isArray(it.mods) ? it.mods.filter(k => { const p = modParse(k); return p && p.f !== 'aff'; }) : []; }
// '' = passt, sonst Grund; stock = auch prüfen, ob man ihn hat
function modFitWhy(it, k, stock) {
  const p = modParse(k); if (!p) return _t('Unbekannter Mod.');
  if (p.f === 'aff') return _t('Affix-Essenzen setzt du unter UMSCHMIEDEN ein.');
  const L = mParsed(it);
  if (L.length >= modSlots(it)) return _t('Alle Plätze sind belegt – nimm erst einen Mod heraus.');
  if (L.some(x => x.k === p.k)) return _t('Diese Art steckt schon in diesem Gegenstand.');
  if (p.f === 'essenz' && L.some(x => x.f === 'essenz')) return _t('Nur eine Essenz je Gegenstand.');
  if (stock !== false && modHave(k) < 1) return _t('Davon hast du keinen mehr.');
  return '';
}
// Element der Essenz übernehmen bzw. das ursprüngliche zurückgeben
function modElSet(it) {
  const e = mParsed(it).find(p => p.f === 'essenz');
  if (e) { if (!('el0' in it)) it.el0 = it.el && it.el !== e.id ? it.el : null; if (it.el !== e.id) { if (it.el && it.el0 !== it.el) it.el0 = it.el; it.el = e.id; } }
  else if ('el0' in it) { if (it.el0 && ELEM[it.el0]) it.el = it.el0; else delete it.el; delete it.el0; }
}
function modPut(it, k) { it.mods = modsOf(it).concat([k]); modElSet(it); }
function modInsert(it, k) {
  const why = modFitWhy(it, k); if (why) return why;
  modAdd(k, -1); modPut(it, k); SAVE.meta.mods.ins++; stat('modIns');
  for (const id of resOfItem(it)) modDiscover(id);
  computeStats(); return '';
}
const modRemoveCost = k => { const p = modParse(k); return p ? Math.round((25 * p.t * p.t + 20) * (1 - weekFx('smith'))) : 0; };
function modRemove(it, i) {
  const ms = modsOf(it), k = ms[i]; if (!k) return 'none';
  const c = modRemoveCost(k); if (P.gold < c) return 'poor';
  P.gold -= c; ms.splice(i, 1); if (ms.length) it.mods = ms; else delete it.mods;
  modAdd(k, 1); modElSet(it); computeStats(); return 'ok';
}
// Gegenstand verlässt den Helden (Zerlegen, Verkaufen, Verschmelzen, Extrahieren): Mods zurück in den Vorrat
function modTakeBack(it) {
  const ms = modsOf(it); if (!ms.length) { if (it && 'el0' in it) modElSet(it); return 0; }
  for (const k of ms) modAdd(k, 1);
  delete it.mods; modElSet(it); return ms.length;
}
// Wert der Mods für Vergleiche (itemScore): je Stufe 2 %, höchstens +100 %
function modScore(it) { let v = 0; for (const p of mParsed(it)) v += .02 * p.t; return Math.min(1, v); }
function modPreview(it, k) { const x = JSON.parse(JSON.stringify(it)); modPut(x, k); return x; }
// Mods im Vorrat, die in diesen Gegenstand passen (beste zuerst)
function modStock(f) { return Object.keys((P && P.mods) || {}).filter(k => P.mods[k] > 0 && modParse(k) && (!f || modParse(k).f === f)).sort((a, b) => { const x = modParse(a), y = modParse(b); return MOD_FAMS.concat(['aff']).indexOf(x.f) - MOD_FAMS.concat(['aff']).indexOf(y.f) || MOD_KINDS.indexOf(x.k) - MOD_KINDS.indexOf(y.k) || y.t - x.t; }); }
// Spielstand eines Gegenstands reparieren; give(k) nimmt überzählige Mods zurück
function modFixItem(it, give) {
  if (!it || typeof it !== 'object') return;
  if (it.rr != null) { const n = Math.floor(+it.rr) || 0; if (n > 0) it.rr = Math.min(999, n); else delete it.rr; }
  if (it.mods == null) { if ('el0' in it) modElSet(it); return; }
  const out = [], seen = new Set(); let ess = false;
  for (const k of Array.isArray(it.mods) ? it.mods.slice(0, 12) : []) {
    const p = modParse(k); if (!p || p.f === 'aff') continue;
    if (out.length >= modSlots(it) || seen.has(p.k) || (p.f === 'essenz' && ess)) { if (give) give(k); continue; }
    seen.add(p.k); out.push(k); if (p.f === 'essenz') ess = true;
  }
  if (out.length) it.mods = out; else delete it.mods;
  if ('el0' in it && it.el0 !== null && !ELEM[it.el0]) it.el0 = null;
  modElSet(it);
}

/* ---------- Was die Ausrüstung gerade kann ---------- */
const MODS = { act: { g: {}, k: {}, ew: null, ea: {}, pr: [], res: {}, who: {} }, cd: {}, fired: {}, inProc: 0, q: [], fields: [], whirl: null, shield: 0, shieldT: 0, runT: 0, hasteT: 0, on: {}, phxT: -99, rollSeen: null, cdCut: null, sfxT: 0, healT: 0, se: 0, ff: 0, af: 0, emit: 0, bookFrom: 'wb', hits: 0, kills: 0 };
const mFire = k => { MODS.fired[k] = (MODS.fired[k] || 0) + 1; };
const mRes = id => MODS.act.res[id] || 0;
const mReady = (k, cd) => { if ((MODS.cd[k] || 0) > T) return false; MODS.cd[k] = T + cd; return true; };
function modScan() {
  const A = { g: {}, k: {}, ew: null, ea: {}, pr: [], res: {}, who: {} }, S = [];
  for (const s of MOD_GEAR) { const it = P.gear[s]; if (it && it.mods) modElSet(it); S.push({ s, it, L: it ? mParsed(it) : [] }); }
  for (const { s, L } of S) for (const p of L) {
    if (p.f === 'glyphe') A.g[p.id] = Math.max(A.g[p.id] || 0, p.t);
    else if (p.f === 'kern') A.k[p.id] = Math.max(A.k[p.id] || 0, p.t);
    else if (p.f === 'essenz') { if (s === 'weapon') A.ew = { el: p.id, t: p.t }; else A.ea[p.id] = (A.ea[p.id] || 0) + p.t; }
    else if (p.f === 'praeg') A.pr.push(MOD_PRAEG[p.id].c);
  }
  for (const R of RESO) {
    let q = 0; const who = [];
    if (R.on === 'item') { for (const x of S) if (x.it) { const v = resItemQ(R, x.it, x.L); if (v) { who.push(x.it.uid); q = Math.max(q, v); } } }
    else { q = R.test(S) || 0; if (q) for (const x of S) if (x.it && x.L.some(p => R.fam.includes(p.f))) who.push(x.it.uid); }
    if (q) { A.res[R.id] = q; A.who[R.id] = who; }
  }
  return MODS.act = A;
}
function modDiscover(id) {
  const B = SAVE.meta.mods.book; if (!RESOI[id] || B[id]) return false;
  B[id] = Math.max(1, Math.floor(Date.now() / 864e5)); stat('resonances');
  toast(_t('Resonanz entdeckt: {name}!', { name: RESOI[id].n }), '#ffd24a'); sfx('ach'); persist();
  return true;
}

/* ---------- Werte ---------- */
HOOK.stats.push(add => {
  if (!P || !P.gear) return;
  const A = modScan(), rk = A.res.runenkreis ? 1.25 : 1;
  for (const s of MOD_GEAR) { const it = P.gear[s]; if (!it) continue; for (const p of mParsed(it)) { if (p.f === 'rune') add(p.D.st, p.D.v * p.t * rk); else if (p.f === 'praeg') add(p.D.st, p.D.v * p.t); } }
  const k = A.k;
  if (k.salve) { const t = k.salve, n = kernSalve(t); add('a1Count', n); add('r2Knives', n); add('m3Chain', n); add('auArrows', kernAu(t)); add('m1Dmg', .03 * t); if (t >= 10) add('m1Twin', 1); }
  if (k.weite) for (const x of ['k2Rad', 'm1Rad', 'm2Rad', 'a2Rad', 'uRad', 'muRad']) add(x, .03 * k.weite);
  if (k.bund) { add('k3Dur', KERN_BUND.k3 * k.bund); add('r3Dur', KERN_BUND.r3 * k.bund); add('a3Dur', KERN_BUND.a3 * k.bund); add('ruDur', KERN_BUND.ru * k.bund); }
  if (k.zorn) add('rage', .04 * k.zorn);
  const r = A.res;
  if (r.eisenwacht) add('dr', RV('eisenwacht'));
  if (r.salvensturm) { add('a1Count', 1); add('r2Knives', 1); add('m3Chain', 1); add('auArrows', 1); }
  for (const id of ['schmiedeharmonie', 'dreiklang', 'regenbogen']) if (r[id]) { add('dmg', RV(id)); add('hp', RV(id)); }
  if (r.regenbogen) add('def', 4 + r.regenbogen);
  if (r.vollmond) add('critdmg', RV('vollmond'));
  if (r.sternenstaub) add('xp', RV('sternenstaub'));
  if (r.gluecksritter) add('gold', RV('gluecksritter'));
  if (r.ahnenzorn) add('rage', RV('ahnenzorn'));
  // kurze Schübe (Sturmlauf, Schattentanz)
  if (MODS.runT > T) { add('spd', .25); add('dmg', RV('sturmlauf')); }
  if (MODS.hasteT > T) add('aspd', RV('schattentanz'));
  if (SAVE && SAVE.meta.mods) for (const id in r) if (!SAVE.meta.mods.book[id]) modDiscover(id);
});
// kurzer Schub: Werte gleich neu, beim Ablaufen wieder (HOOK.update)
function mBuff(k, dur) { const was = MODS[k] > T; MODS[k] = T + dur; MODS.on[k] = 1; if (!was) computeStats(); }

/* ---------- Kampf: Helfer ---------- */
// Schadens-Objekt für Effekte: Anteil f am Waffenschaden, eigenes Element, löst keine Glyphen aus (modp)
function mW(w, f, el) { const base = (w && w.dmg) || (P.st ? P.st.wbase * P.st.dmgMul : 10); return { dmg: base * f, crit: 0, critdmg: 1, kb: 0, el: el !== undefined ? el : hitEl(w), modp: 1 }; }
function mHurt(e, v, w, nx, ny, kb) {
  if (!e || e.dead || e.st === 'spawn') return;
  MODS.inProc++;
  try { e.modHitT = T; const d = hookVal('hit', v, e, w, false); hurtEnemy(e, Math.max(1, Math.round(d)), nx || 0, ny || 0, kb || 0, false, true); }
  finally { MODS.inProc--; }
}
function mFoes(x, y, r, skip) { return enemies.filter(e => !e.dead && e.st !== 'spawn' && !(e.under > 0) && e.ai !== 'dummy' && e !== skip && Math.hypot(e.x - x, e.y - y) < r + e.r * (e.sc || 1)); }
function mNear(from, range) { let t = null, b = range; for (const o of enemies) { if (o === from || o.dead || o.st === 'spawn' || o.under > 0 || o.ai === 'dummy') continue; const d = Math.hypot(o.x - from.x, o.y - from.y); if (d < b) { b = d; t = o; } } return t; }
function mSnd(k, gap) { if (T > MODS.sfxT) { MODS.sfxT = T + (gap || .12); sfx(k); } }
function mBlast(x, y, r, w, col, o) {
  o = o || {};
  rings.push({ x, y, r: 4, max: r, life: .32, max2: .32, col }); burst(x, y, 6, col, 12, 70, 1);
  if (o.boom) fxAnim('boom', x, y - Math.min(r, 30) * .3, { sc: Math.min(1.6, r / 22), dur: .45 });
  mSnd(o.snd || 'boom'); if (o.shake !== 0) shake(o.shake || 2);
  for (const e of mFoes(x, y, r)) { const d = Math.hypot(e.x - x, e.y - y) || 1; mHurt(e, w.dmg, w, (e.x - x) / d, (e.y - y) / d, o.kb == null ? 120 : o.kb); if (o.fn && !e.dead) o.fn(e); }
}
// Kettenblitz von from aus auf n weitere Gegner
function mChain(from, n, w, range) {
  const hit = new Set([from]), pts = [[from.x, from.y - 8 * (from.sc || 1)]]; let cur = from;
  for (let k = 0; k < n; k++) {
    let nt = null, b = range; for (const o of enemies) { if (hit.has(o) || o.dead || o.st === 'spawn' || o.under > 0 || o.ai === 'dummy') continue; const d = Math.hypot(o.x - cur.x, o.y - cur.y); if (d < b) { b = d; nt = o; } }
    if (!nt) break; hit.add(nt); pts.push([nt.x, nt.y - 8 * (nt.sc || 1)]); mHurt(nt, w.dmg, w, 0, 0, 20); cur = nt;
  }
  if (pts.length > 1) { fx.push({ k: 'zap', pts, life: .22, max: .22 }); mSnd('zap', .1); }
  return pts.length - 1;
}
function mHeal(v, col) { if (!P || P.hp <= 0) return; const h = Math.max(1, Math.round(v)); P.hp = Math.min(P.st.hp, P.hp + h); if (T > MODS.healT) { MODS.healT = T + .25; txt(P.x, P.y - 22, '+' + h, col || '#79c24e'); } }
function mCd(id, t) {
  const G = MOD_GLYPH[id]; let c = typeof G.cd === 'function' ? G.cd(t) : G.cd;
  if (id === 'kette' && mRes('gewitter')) c *= .6; if (id === 'vergeltung' && mRes('dornenhaut')) c -= 1.5; if (mRes('glyphenchor')) c *= .75;
  return Math.max(.1, c);
}
const MOD_SK = { id: 'mgeist', key: 'mgeist', r: 2, hue: 195, gold: false, sc: 1, col: '#bfefff', col2: '#ffffff', pal: ['#ffffff', '#e0f6ff', '#9adcff', '#4a8ad8'], glow: '190,236,255' };
function mSpirit(t) {
  const max = mRes('geisterheer') ? 4 : 2; if (allies.filter(a => a.mod).length >= max) return false;
  const G = MOD_GLYPH.geist, w = mW(null, G.v(t), (P.gear.weapon && P.gear.weapon.el) || null);
  allies.push({ k: 'spirit', x: P.x, y: P.y, z: 14, ang: rnd(0, 6.283), life: G.s(t) * (mRes('geisterheer') ? 1.5 : 1), shotT: .5, healT: 3, seed: rnd(0, 9), w, sk: MOD_SK, mod: 1 });
  burst(P.x, P.y, 12, '#d8f4ff', 14, 50, 1); mSnd('heal'); return true;
}

/* ---------- Glyphen ---------- */
function mGlyph(id, t, e, w, dmg) {
  const G = MOD_GLYPH[id];
  if (id === 'kette' && !mNear(e, 80)) return false;
  if (Math.random() >= G.ch(t) * (id === 'geist' && mRes('geisterheer') ? 2 : 1)) return false;
  if (!mReady('g_' + id, mCd(id, t))) return false;
  mFire(id);
  switch (id) {
    case 'kette': mChain(e, G.j(t) + (mRes('gewitter') ? 2 : 0), mW(w, G.v(t)), 80); if (mRes('gewitter')) mFire('gewitter'); break;
    case 'frost': {
      const r = G.r(t) * (mRes('frostfessel') ? 1.5 : 1), x = e.x, y = e.y;
      fxAnim('ring', x, y - 4, { sc: r / 22, dur: .45, add: true }); for (let k = 0; k < 10; k++) fx.push({ k: 'shard', x, y, ang: k / 10 * 6.283, life: .35, max: .35, d: r * .95 }); mSnd('frost');
      const ww = mW(w, G.v(t), 'frost');
      for (const o of mFoes(x, y, r)) { mHurt(o, ww.dmg, ww, 0, 0, 0); if (o.dead) continue; if (!o.boss) o.freeze = Math.max(o.freeze || 0, G.fr(t)); else { o.chill = Math.max(o.chill || 0, 2.5); if (mRes('frostfessel')) o.freeze = Math.max(o.freeze || 0, .5); } }
      break;
    }
    case 'blut': {
      if (e.dead) break;
      e.mbleed = T + 4; e.mbT = .5; e.mbD = Math.max(1, Math.round(w.dmg * G.v(t) * (mRes('blutmond') ? 1.5 : 1)));
      if (mRes('giftklinge')) { e.poison = Math.max(e.poison || 0, 4); e.poisonDmg = Math.max(e.poisonDmg || 0, Math.round(e.mbD * 1.2)); mFire('giftklinge'); }
      for (let i = 0; i < 6; i++) part(e.x + rnd(-3, 3), e.y, 10 * (e.sc || 1), rnd(-30, 30), rnd(-10, 10), rnd(20, 50), '#c8201a', rnd(.3, .6), 1);
      break;
    }
    case 'schatten': if (!e.dead) { spark(e.x, e.y - 8 * (e.sc || 1), rnd(0, 6.28), '#c8a8ff'); mHurt(e, w.dmg * G.v(t), mW(w, 0, 'schatten'), 0, 0, 0); if (mRes('schattentanz')) { mBuff('hasteT', 2); mFire('schattentanz'); } } break;
    case 'meteor': {
      const fr = mRes('flammenregen'), n = fr ? 3 : 1, f = G.v(t) * (fr ? .7 : 1) / (2.4 * (1 + mod('muDmg'))), mw = mW(w, f, fr ? 'feuer' : undefined);
      for (let k = 0; k < n; k++) { const x = clamp(e.x + (k ? rnd(-26, 26) : 0), BD.x0, BD.x1), y = clamp(e.y + (k ? rnd(-16, 16) : 0), BD.y0, BD.y1); projs.push({ k: 'meteor', fxn: 'firebomb', x, y, tx: x, ty: y, h: 140, vx: 0, vy: 0, life: 9, max: 9, delay: k * .18, from: 'p', r: 0, w: mw, hit: new Set() }); }
      if (fr) mFire('flammenregen');
      break;
    }
    case 'wirbel': { const ks = mRes('klingensturm'); MODS.whirl = { end: T + 1.4 * (ks ? 2 : 1), tick: 0, r: 30 * (ks ? 1.3 : 1), w: mW(w, G.v(t)) }; if (ks) mFire('klingensturm'); mSnd('swing2'); break; }
  }
  return true;
}
HOOK.afterHit.push((e, w, dmg, crit) => {
  if (!P || !w || w.pet || w.modp || !(dmg > 0) || state !== 'play' || !e) return;
  const A = MODS.act, g = A.g; MODS.hits++;
  for (const id of ['kette', 'frost', 'blut', 'schatten']) if (g[id]) mGlyph(id, g[id], e, w, dmg);
  if (crit) for (const id of ['meteor', 'wirbel']) if (g[id]) mGlyph(id, g[id], e, w, dmg);
  // Essenz der Waffe: zusätzliche Element-Effekte (wie js/elements.js, eigene Chance)
  if (A.ew && hitEl(w) === A.ew.el && !e.dead && !((e.elT || 0) > T) && e.ai !== 'dummy' && Math.random() < .015 * A.ew.t + (mRes('elementarsturm') ? .1 : 0)) { e.elT = T + .3; elProcFx(A.ew.el, e, w, dmg, Math.max(3, A.ew.t)); mFire('essenz'); if (mRes('elementarsturm')) mFire('elementarsturm'); }
  const bleed = (e.mbleed || 0) > T;
  if (bleed && mRes('vampirkuss')) { mHeal(dmg * RV('vampirkuss'), '#c8201a'); mFire('vampirkuss'); }
  if (bleed && crit && mRes('blutmond') && mReady('r_blutmond', .3)) { mHeal(P.st.hp * RV('blutmond'), '#ff4a5a'); mFire('blutmond'); }
  if (mRes('funkenflug') && ++MODS.ff >= 8) { MODS.ff = 0; if (mChain(e, 3, mW(w, RV('funkenflug'), 'blitz'), 90)) mFire('funkenflug'); }
});
HOOK.kill.push(e => {
  if (!P || !P.st || !e || e.ai === 'dummy' || state !== 'play') return;
  const A = MODS.act, g = A.g, pk = MODS.inProc > 0 || e.modHitT === T, w = mW(null, 1); MODS.kills++;
  if (g.leben && mReady('g_leben', mCd('leben', g.leben))) { mFire('leben'); mHeal(P.st.hp * MOD_GLYPH.leben.v(g.leben)); }
  if (!pk && g.geist && Math.random() < MOD_GLYPH.geist.ch(g.geist) * (mRes('geisterheer') ? 2 : 1) && mReady('g_geist', mCd('geist', g.geist)) && mSpirit(g.geist)) { mFire('geist'); if (mRes('geisterheer')) mFire('geisterheer'); }
  if (!pk && g.explosion && Math.random() < MOD_GLYPH.explosion.ch(g.explosion) && mReady('g_explosion', mCd('explosion', g.explosion))) {
    const t = g.explosion, G = MOD_GLYPH.explosion, x = e.x, y = e.y; mFire('explosion');
    mBlast(x, y, G.r(t), mW(w, G.v(t)), '#ffb03a', { boom: 1, kb: 160 });
    if (mRes('giftnebel')) { MODS.fields.push({ k: 'gift', x, y, r: 30, end: T + 3, tick: .2, w: mW(w, G.v(t) * .2, 'gift') }); mFire('giftnebel'); }
    if (mRes('kettenreaktion')) { MODS.inProc++; try { if (mChain({ x, y, sc: 1 }, 3, mW(w, MOD_GLYPH.kette.v(g.kette || t), 'blitz'), 90)) mFire('kettenreaktion'); } finally { MODS.inProc--; } }
  }
  if (mRes('seelenernte') && ++MODS.se >= 12) { MODS.se = 0; mFire('seelenernte'); mHeal(P.st.hp * RV('seelenernte'), '#9affd8'); mSpirit(g.geist || 1); rings.push({ x: P.x, y: P.y, r: 4, max: 40, life: .5, max2: .5, col: '#9affd8' }); }
  if (!pk && mRes('heiligeslicht') && mReady('r_licht', 1)) { mFire('heiligeslicht'); mHeal(P.st.hp * RV('heiligeslicht'), '#fff2b0'); mBlast(e.x, e.y, 36, mW(w, .3 + .03 * mRes('heiligeslicht'), 'licht'), '#fff2b0', { snd: 'heal', shake: 0, kb: 60 }); }
});
HOOK.hit.push((d, e, w) => {
  if (!w || w.pet || !e) return d;
  if (w.modp) e.modHitT = T;
  const A = MODS.act; if (!A.ew && !A.res.elementarsturm && !A.res.frostfessel) return d;
  const el = hitEl(w);
  if (A.ew && el === A.ew.el) d *= 1 + .015 * A.ew.t;
  if (el && mRes('elementarsturm')) d *= 1 + RV('elementarsturm');
  if (mRes('frostfessel') && ((e.freeze || 0) > 0 || (e.chill || 0) > 0)) { d *= 1 + RV('frostfessel'); mFire('frostfessel'); }
  return d;
});
HOOK.hurt.push((d, src) => {
  if (!P || !P.st || state !== 'play' || !(d > 0)) return d;
  const A = MODS.act, d0 = d, foe = src && src.maxHp && !src.dead ? src : src && src.src && src.src.maxHp && !src.src.dead ? src.src : null;
  if (Object.keys(A.ea).length) { const el = srcEl(src); if (el && A.ea[el]) d *= 1 - Math.min(.3, .015 * A.ea[el]); }
  if (foe && mRes('frostpanzer')) { if ((foe.chill || 0) > 0) d *= 1 - RV('frostpanzer'); foe.chill = Math.max(foe.chill || 0, 2); mFire('frostpanzer'); }
  if (MODS.shield > 0) { const a = Math.min(MODS.shield, d); MODS.shield -= a; d -= a; mFire('lichtschild'); fxAnim('shield', P.x, P.y - 12, { dur: .25, alpha: .5 }); if (MODS.shield <= 0) { MODS.shieldT = T + 10; txt(P.x, P.y - 30, _t('Lichtschild gebrochen'), '#fff2b0'); } }
  const t = A.g.vergeltung;
  if (t && mReady('g_vergeltung', mCd('vergeltung', t))) {
    mFire('vergeltung'); mBlast(P.x, P.y, 40, mW(null, MOD_GLYPH.vergeltung.v(t)), '#ff6a5a', { kb: 220, fn: o => { if (!o.boss) o.stun = Math.max(o.stun || 0, .3); } });
    if (foe && !foe.dead && mRes('dornenhaut')) { mHurt(foe, d0 * 2, mW(null, 0, null), 0, 0, 80); mFire('dornenhaut'); }
  }
  if (mRes('phoenixfunke') && P.hp - d < P.st.hp * .3 && T > MODS.phxT + 60) {
    MODS.phxT = T; mFire('phoenixfunke'); mHeal(P.st.hp * RV('phoenixfunke'), '#ffd24a'); txt(P.x, P.y - 34, _t('PHÖNIXFUNKE'), '#ff8a3a', true);
    mBlast(P.x, P.y, 50, mW(null, 1.5, 'feuer'), '#ff8a3a', { boom: 1, kb: 200, fn: o => { o.burn = Math.max(o.burn || 0, 3); o.burnDmg = Math.max(o.burnDmg || 0, Math.round(P.st.wbase * .2)); } });
  }
  return d;
});
HOOK.skill.push((id, w) => {
  if (!P || !P.st || !SKILLS[id]) return;
  const A = MODS.act, k = A.k, S = SKILLS[id], C = CLASSES[P.cls], i = C.skills.indexOf(id), fam = f => MOD_KERN[f].sk.includes(id);
  let mul = 1, cut = 0;
  if (k.wucht && fam('wucht')) { mul *= 1 + .03 * k.wucht; mFire('kern_wucht'); }
  if (k.sprung && fam('sprung')) { mul *= 1 + .03 * k.sprung; cut = Math.min(.4, .04 * k.sprung); mFire('kern_sprung'); }
  if (k.zorn && S.ult) { mul *= 1 + .03 * k.zorn; mFire('kern_zorn'); }
  if (mRes('salvensturm') && fam('salve')) { mul *= 1 + RV('salvensturm'); mFire('salvensturm'); }
  if (w) w.dmg *= mul;
  if (!S.ult && i >= 0) {
    const cost = skillCost(i);
    if (k.fluss) { P.res += cost * Math.min(.2, .02 * k.fluss); mFire('kern_fluss'); }
    if (mRes('arkaneflut') && ++MODS.af >= 4) { MODS.af = 0; P.res += cost; cut = Math.max(cut, .5); mFire('arkaneflut'); txt(P.x, P.y - 40, _t('Arkane Flut'), '#57a7d6'); }
    if (cut) MODS.cdCut = { i, f: cut };
  }
  if (mRes('sturmlauf') && fam('sprung')) { mBuff('runT', 3); mFire('sturmlauf'); }
  if (mRes('waechterbund') && fam('bund')) { mHeal(P.st.hp * RV('waechterbund'), '#9be070'); mFire('waechterbund'); }
  if (S.ult && mRes('ahnenzorn')) { mHeal(P.st.hp * .15, '#ffd24a'); mFire('ahnenzorn'); }
  if (S.ult && mRes('zornesfeuer')) { MODS.fields.push({ k: 'feuer', x: P.x, y: P.y, r: 46, end: T + 4, tick: .3, w: mW(w, RV('zornesfeuer'), 'feuer') }); mFire('zornesfeuer'); }
  if (mRes('bebenerde') && fam('weite') && mReady('r_beben', 2)) { const t0 = nearestEnemy(140), x = t0 ? t0.x : P.x, y = t0 ? t0.y : P.y, bw = mW(w, RV('bebenerde')); MODS.q.push({ t: T + .5, fn: () => { mBlast(x, y, 50, bw, '#c8b88a', { boom: 1, kb: 160, shake: 4 }); dust(x, y, 10); mFire('bebenerde'); } }); }
});
// Blutung: eigene Schadenstick (wie Brand), stirbt der Gegner, ist er für diesen Takt fertig
HOOK.enemyUpd.push((e, dt) => {
  if (!(e.mbleed > T) || e.dead) return;
  if ((e.mbT -= dt) > 0) return;
  e.mbT = .5; e.hp -= e.mbD; txt(e.x, e.y - 14 * (e.sc || 1), String(e.mbD), '#ff4a4a'); if (Math.random() < .7) part(e.x + rnd(-3, 3), e.y, rnd(4, 12) * (e.sc || 1), rnd(-10, 10), rnd(-5, 5), rnd(5, 20), '#b8201a', .5, 1, 200);
  if (e.hp <= 0) { e.burn = 0; e.poison = 0; killEnemy(e, 0, 0); e.stun = 9; }
});
HOOK.update.push(dt => {
  if (!P || !G || state !== 'play') return;
  if (MODS.cdCut) { const c = MODS.cdCut; MODS.cdCut = null; if (P.cds[c.i] > 0) P.cds[c.i] *= 1 - c.f; }
  for (const k in MODS.on) if (MODS.on[k] && MODS[k] <= T) { MODS.on[k] = 0; computeStats(); }
  if (MODS.q.length) { const now = MODS.q.filter(x => x.t <= T); if (now.length) { MODS.q = MODS.q.filter(x => x.t > T); for (const x of now) x.fn(); } }
  if (MODS.fields.length) {
    for (const f of MODS.fields) {
      if (Math.random() < .5) part(f.x + rnd(-f.r, f.r) * .8, f.y + rnd(-f.r, f.r) * .4, rnd(0, 6), 0, 0, rnd(8, 20), f.k === 'gift' ? pick(['#79c24e', '#c8f06a']) : pick(['#ff6a2a', '#ffb03a']), rnd(.4, .8), 1, -10, 1);
      if ((f.tick -= dt) > 0) continue; f.tick = .5;
      for (const o of mFoes(f.x, f.y, f.r)) { if (f.k === 'gift') { o.poison = Math.max(o.poison || 0, 2); o.poisonDmg = Math.max(o.poisonDmg || 0, Math.max(1, Math.round(f.w.dmg))); } else { mHurt(o, f.w.dmg, f.w, 0, 0, 0); if (!o.dead) { o.burn = Math.max(o.burn || 0, 1.5); o.burnDmg = Math.max(o.burnDmg || 0, Math.max(1, Math.round(f.w.dmg * .3))); } } }
    }
    MODS.fields = MODS.fields.filter(f => f.end > T);
  }
  const W = MODS.whirl;
  if (W) {
    if (T >= W.end) MODS.whirl = null;
    else if ((W.tick -= dt) <= 0) {
      W.tick = .2; fx.push({ k: 'slash', x: P.x, y: P.y - 8, ang: T * 11, flip: Math.random() < .5, sc: .62 * W.r / 30, life: .2, max: .2, col: '#e8eef8', follow: true });
      for (const o of mFoes(P.x, P.y, W.r)) { const d = Math.hypot(o.x - P.x, o.y - P.y) || 1; mHurt(o, W.w.dmg, W.w, (o.x - P.x) / d, (o.y - P.y) / d, 50); }
      mSnd('swing', .18);
    }
  }
  if (mRes('lichtschild')) { if (MODS.shield <= 0 && T >= MODS.shieldT) { MODS.shield = P.st.hp * RV('lichtschild'); MODS.shieldT = T + 10; rings.push({ x: P.x, y: P.y, r: 4, max: 22, life: .4, max2: .4, col: '#fff2b0' }); } } else MODS.shield = 0;
  if (P.rollT && P.rollT !== MODS.rollSeen) {
    MODS.rollSeen = P.rollT;
    if (mRes('sturmlauf')) { mBuff('runT', 3); mFire('sturmlauf'); }
    if (mRes('schattenschleier') && mReady('r_schleier', 8)) { P.stealth = Math.max(P.stealth || 0, 1); burst(P.x, P.y, 8, '#3a3448', 12, 40); mFire('schattenschleier'); }
  }
  const pr = MODS.act.pr; if (pr.length && !P.leap) { MODS.emit += dt * (1.2 + pr.length * .8); while (MODS.emit >= 1) { MODS.emit--; part(P.x + rnd(-9, 9), P.y + rnd(-2, 2), rnd(0, 10), 0, 0, rnd(12, 24), pick(pr), rnd(.5, .9), 1, -4, 1); } }
});
HOOK.room.push(() => {
  const had = Object.keys(MODS.on).some(k => MODS.on[k]);
  Object.assign(MODS, { q: [], fields: [], whirl: null, shield: 0, shieldT: T + 1, cd: {}, runT: 0, hasteT: 0, on: {}, rollSeen: P ? P.rollT : null, cdCut: null, se: 0, ff: 0, af: 0 });
  if (had && P) computeStats();
});

/* ---------- Beute: Kampagne, Funde mit Mod, Bodenbeute ---------- */
HOOK.loot.push((e, lm) => {
  if (!P || !P.mods || !G || G.type === 'versteck' || e.ai === 'dummy') return;
  if (typeof landeActive === 'function' && landeActive()) return;   // die Welt würfelt ihre Mods selbst (modRoll)
  const M = SAVE.meta.mods, D = e.def || {};
  let ch = e.boss ? .35 : e.champ ? .22 : e.t === 'goldgob' || e.t === 'goldmimik' ? .2 : e.elite ? .03 : .0025;
  if (D.from >= 99 && e.t !== 'mimic') ch *= .2;   // Beschworenes gibt selten etwas
  ch *= (lm || 1) * (mRes('gluecksritter') ? 1.25 : 1);
  if (!M.found && (e.boss || e.champ || (e.elite && P.lv >= 6))) ch = 1;   // der erste Mod kommt sicher
  if (Math.random() < ch) modDrop(e.x, e.y, modRollCamp(stageNum()), 1);
});
// seltene Funde haben schon einen Mod drin (nur echte Beute im Kampf)
HOOK.itemGen.push(it => {
  if (!it || !P || !G || G.type === 'versteck' || state !== 'play' || it.rar < 2 || Math.random() >= (it.rar >= 4 ? .08 : .03)) return;
  const L = typeof landeActive === 'function' && landeActive(), k = L ? modRoll(typeof landeDepth === 'function' ? landeDepth() : .1, typeof landeLuck === 'function' ? landeLuck() : 1) : modRollCamp(stageNum());
  if (!modFitWhy(it, k, false)) modPut(it, k);
});
HOOK.collect.push((h, c) => {
  if (h || c.k !== 'mod') return h;
  c.got = true;
  if (typeof landeActive === 'function' && landeActive() && typeof landePackAdd === 'function') { if (!landePackAdd({ t: 'mod', k: c.mk, n: c.n || 1 })) { c.got = false; c.t = -.6; } return true; }
  modGive(c.mk, c.n || 1, true); txt(P.x, P.y - 22, '+ ' + modName(c.mk), modCol(c.mk));
  return true;
});

/* ---------- Bilder (16×16, prozedural wie js/forge.js) ---------- */
const MBITS = {
  kraft: ['..#..', '..#..', '#####', '..#..', '..#..'], schaerfe: ['....#', '...#.', '..#..', '.#...', '#....'], eile: ['#.#..', '.#.#.', '..#.#', '.#.#.', '#.#..'],
  leben: ['.#.#.', '#####', '#####', '.###.', '..#..'], stein: ['#####', '#...#', '#.#.#', '#...#', '#####'], heil: ['..#..', '.###.', '#####', '.###.', '..#..'],
  wind: ['##...', '..##.', '####.', '...##', '.###.'], zorn: ['..#..', '.##..', '.###.', '#####', '.###.'], fokus: ['.###.', '#...#', '#.#.#', '#...#', '.###.'], glueck: ['.#.#.', '#.#.#', '.#.#.', '#.#.#', '.#.#.'],
  kette: ['..##.', '.##..', '#####', '..##.', '.##..'], frost: ['#.#.#', '.###.', '##.##', '.###.', '#.#.#'], geist: ['.###.', '#.#.#', '#####', '#####', '#.#.#'],
  blut: ['..#..', '.###.', '.###.', '#####', '.###.'], explosion: ['#.#.#', '.###.', '##.##', '.###.', '#.#.#'], meteor: ['...##', '..###', '.###.', '###..', '.#...'],
  schatten: ['.###.', '##...', '##...', '##...', '.###.'], vergeltung: ['#...#', '##.##', '.###.', '##.##', '#...#'], wirbel: ['.##..', '#..#.', '#.#.#', '.#..#', '..##.']
};
MBITS.leben_g = ['..#..', '..#..', '#####', '..#..', '..#..'];
const MODART = {}, MODICON = {};
const AFF_COL = { krit: '#4ade80', tempo: '#ffe04a', raub: '#e8402a', feuer: '#ff8a3a', frost: '#8ad8ff', wucht: '#ff6a8a', leben: '#ff8ab0', panzer: '#a8b2c2', heil: '#79e04a', schutz: '#57a7d6', eile: '#8ee6ea', glueck: '#ffd24a' };
const mShade = c => [mixC(c, '#000000', .55), mixC(c, '#000000', .25), c, mixC(c, '#ffffff', .55)];
function mBits(b, rows, x0, y0, C) { for (let y = 0; y < 5; y++) for (let x = 0; x < 5; x++) if (rows[y][x] === '#') b.set(x0 + x, y0 + y, y === 0 || (x === 0 && y < 3) ? C[3] : y >= 4 ? C[1] : C[2]); }
function modArt(k) {
  const p = modParse(k); if (!p) return mk(16, 16);
  const key = p.k + ':' + p.t; if (MODART[key]) return MODART[key];
  const b = PB(16, 16), Gc = GRADE[clamp(p.t, 1, 10)].c, kc = p.f === 'aff' ? AFF_COL[p.id] || '#9affd8' : p.D.c, C = mShade(kc), R = mulberry(hashStr(key));
  switch (p.f) {
    case 'rune':
      b.disc(7.5, 7.5, 7, Gc[1]); b.disc(7.5, 7.5, 6, STONE[2]); b.disc(7.2, 7.2, 5.2, STONE[1]);
      for (const [x, y] of [[4, 3], [3, 4], [5, 2], [2, 6]]) b.set(x, y, STONE[3]);
      mBits(b, MBITS[p.id], 5, 5, C); break;
    case 'glyphe':
      for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) { const d = Math.abs(x - 7.5) + Math.abs(y - 7.5); if (d <= 7.6) b.set(x, y, d > 6.5 ? Gc[2] : d > 5.5 ? '#3a2a5a' : '#221a36'); }
      mBits(b, p.id === 'leben' ? MBITS.leben_g : MBITS[p.id], 5, 5, C);
      for (const [x, y] of [[7, 2], [8, 2], [2, 7], [13, 8], [7, 13], [8, 13]]) b.set(x, y, C[3]);
      break;
    case 'essenz': {
      const E = ELEM[p.id].c;
      b.rect(6, 1, 4, 2, '#8a5a32'); b.rect(6, 1, 4, 1, '#b07a48'); b.rect(6, 3, 4, 2, '#a8b8c8'); b.rect(5, 5, 6, 1, Gc[2]);
      b.disc(7.5, 10, 5.2, '#a8b8c8'); b.disc(7.5, 10.3, 4.3, E[1]); b.rect(4, 8, 8, 2, E[2]); b.set(5, 8, E[3]); b.set(6, 8, E[3]); b.set(9, 11, E[3]); b.set(6, 12, E[0]);
      break;
    }
    case 'kern':
      for (let i = 0; i < 8; i++) { const a = i / 8 * 6.283; b.rect(Math.round(7 + Math.cos(a) * 6), Math.round(7 + Math.sin(a) * 6), 2, 2, Gc[1]); }
      b.disc(7.5, 7.5, 5.6, Gc[2]); b.disc(7.5, 7.5, 4.6, Gc[1]); b.disc(7.5, 7.5, 3.5, C[1]); b.disc(7.1, 7.1, 2.4, C[2]); b.set(6, 6, C[3]); b.set(5, 7, C[3]);
      break;
    case 'praeg':
      b.rect(5, 0, 2, 5, C[1]); b.rect(9, 0, 2, 5, C[0]); b.disc(7.5, 9.5, 5.6, Gc[1]); b.disc(7.5, 9.5, 4.6, C[2]);
      pbStar(b, 7.5, 9.6, 3.6, 1.6, C[3], C[1]); break;
    case 'aff':
      for (let y = 1; y < 15; y++) { const hw = y < 4 ? y - 1 : y > 11 ? 15 - y - 1 : 3; for (let x = 8 - hw - 1; x <= 8 + hw - 1; x++) b.set(x, y, x < 7 ? C[3] : x < 8 ? C[2] : C[1]); }
      b.set(7, 1, Gc[3]); b.rect(6, 7, 3, 1, Gc[2]); break;
  }
  if (p.t >= 7) for (let i = 0; i < p.t - 5; i++) { const x = Math.floor(R() * 16), y = Math.floor(R() * 16); if (b.get(x, y) && b.get(x, y) !== OUT) b.set(x, y, '#ffffff'); }
  return MODART[key] = pbCanvas(pbOutline(b));
}
function modIconURL(k) { const p = modParse(k); if (!p) return iconURL(['pa', 'mdbook']); const key = p.k + ':' + p.t; return MODICON[key] || (MODICON[key] = mk(18, 18, g => g.drawImage(modArt(key), 1, 1)).toDataURL()); }
const modImg = (k, cls) => `<img${cls ? ` class="${cls}"` : ''} src="${modIconURL(k)}" alt="">`;
HOOK.artIcon.push((name, b) => {
  switch (name) {
    case 'mdbook':   // Buch mit Stern (Resonanz-Buch)
      b.rect(2, 2, 12, 12, '#3e2270'); b.rect(3, 2, 11, 11, '#6a40b0'); b.rect(3, 12, 11, 1, '#efe2bf'); b.rect(2, 2, 1, 12, '#221236');
      pbStar(b, 8.5, 7, 3.6, 1.5, '#ffe08a', '#e8a030'); break;
    case 'mdref':    // Kristall mit Pfeil nach oben (Veredeln)
      for (let y = 5; y < 15; y++) { const hw = y < 8 ? y - 4 : y > 12 ? 15 - y : 3; b.rect(7 - hw, y, hw * 2, 1, y < 9 ? '#c8ecff' : '#5aa8e8'); }
      for (let r = 0; r < 4; r++) b.rect(11 - r, 1 + r, 2 + r * 2, 1, '#5ac27a'); b.rect(12, 5, 2, 4, '#3a9a4a'); break;
    case 'mdext':    // Kristallsplitter über einem Tropfen (Extrahieren)
      for (let y = 1; y < 9; y++) { const hw = y < 3 ? y : y > 6 ? 9 - y : 2; b.rect(8 - hw, y, hw * 2, 1, y < 5 ? '#c8ffe8' : '#3ac8a0'); }
      b.disc(8, 12.5, 2.6, '#9affd8'); b.rect(7, 9, 2, 2, '#9affd8'); b.set(7, 11, '#ffffff'); break;
  }
});

/* ---------- Am Helden: Leuchten der Prägungen, Lichtschild, Felder, Bodenbeute ---------- */
function mGlowBack() {
  if (typeof auBlob !== 'function') return;
  const A = MODS.act, x = P.x - CX, y = P.y - CY, k = (P.stealth > 0 ? .25 : 1) * (typeof auCalm === 'function' && auCalm() ? .7 : 1), pr = A.pr;
  if (pr.length) { const c = pr[Math.floor(T * .7) % pr.length]; auBlob(c, x, y, 11 + pr.length, 4.5, (.16 + .05 * pr.length) * k * (.85 + .15 * Math.sin(T * 2))); }
  if (A.res.vollmond) { auBlob('#5a3a9a', x, y, 16, 6, .3 * k); auRing(x, y, 14, 5.5, 26, '#e0ccff', '#5a3a9a', .8 * k, T * .4, 3); }
  if (A.res.sternenstaub) for (let i = 0; i < 6; i++) { const ph = (T * .6 + i * .31) % 1, a = i * 1.05 + T * .3; if (ph < .5) auPx(x + Math.cos(a) * 12, y - 4 - (i * 5) % 18, 1, '#ffffff', (1 - ph * 2) * k); }
  if (A.res.regenbogen) { const C = ['#ff5a5a', '#ffb03a', '#ffe04a', '#4ade80', '#57a7d6', '#b892f4']; for (let i = 0; i < 24; i++) { const a = i / 24 * 6.283 + T * .5; auPx(x + Math.cos(a) * 13, y + Math.sin(a) * 5, 1, C[i % 6], .85 * k); } ctx.globalAlpha = 1; }
  if (MODS.shield > 0) { auRing(x, y - 11, 11, 13, 26, '#fff2b0', '#e8c860', .55 * k, T, 2); ctx.globalAlpha = 1; }
}
function mFieldDraw(f) { const a = clamp((f.end - T) / .8, 0, 1); ctx.fillStyle = f.k === 'gift' ? `rgba(110,200,60,${.28 * a})` : `rgba(255,110,40,${.3 * a})`; ctx.beginPath(); ctx.ellipse(Math.round(f.x - CX), Math.round(f.y - CY), f.r, f.r * .5, 0, 0, 6.283); ctx.fill(); }
function mPickDraw(c) { const x = Math.round(c.x - CX), y = Math.round(c.y - CY), z = Math.round(c.z + Math.sin(c.t * 5) + 2); ctx.drawImage(modArt(c.mk), x - 8, y - z - 15); addLight(x, y - 8, 18, .7); }
HOOK.draw.push(list => {
  if (!P || !G) return;
  for (const f of MODS.fields) list.push({ y: -1e9, draw: () => mFieldDraw(f) });
  for (const c of pickups) if (c.k === 'mod') { c.di = c.di || { y: 0, draw: () => mPickDraw(c) }; c.di.y = c.y; list.push(c.di); }
  const A = MODS.act; if ((A.pr.length || A.res.vollmond || A.res.sternenstaub || A.res.regenbogen || MODS.shield > 0) && state !== 'dead' && !P.leap) list.push({ y: P.y - .06, draw: mGlowBack });
});

/* ---------- Oberfläche: VERBESSERN (js/forge.js ruft modVerHead/modVerBody) ---------- */
function mUI(it) { let S = WB.mod; if (!S || S.uid !== it.uid) S = WB.mod = { uid: it.uid, i: -1, pick: null, fam: '', aff: null, ess: null, arm: false }; return S; }
function modChip(k, sel, act, n) { const p = modParse(k); return `<button class="wbchip${sel ? ' sel' : ''}" data-act="${act}" data-id="${k}" style="--c:${modCol(k)}" aria-label="${esc(modName(k))}">${modImg(k)}<b>${ROMAN[p.t]}</b><small>×${n != null ? n : modHave(k)}</small></button>`; }
function mBookBtn(from) { const B = SAVE.meta.mods.book, n = RESO.filter(R => B[R.id]).length; return `<button class="btn alt sm" data-act="mod_book" data-id="${from}">${_t('Resonanz-Buch {n}/{m} ›', { n, m: RESO.length })}</button>`; }
function modVerHead(k, it) {
  switch (k) {
    case 'mods': { const S = modSlots(it), u = modsOf(it).length, fit = u < S ? modStock().filter(x => !modFitWhy(it, x)).length : 0; return { ic: modIconURL('glyphe_kette:6'), n: _t('MODS'), st: _t('{a}/{n} Plätze belegt', { a: u, n: S }) + (fit ? ' · ' + _t('{n} passende im Vorrat', { n: fit }) : ''), cls: fit ? 'ok' : '' }; }
    case 'reroll': { const n = Object.keys(it.aff).length, c = n && affRerollCost(it); return { ic: iconURL(['fx', 'sparks', 2]), n: _t('UMSCHMIEDEN'), st: !n ? _t('Keine Zusatzwerte') : (it.rr ? _t('Einen Zusatzwert tauschen · schon {n}×', { n: it.rr }) : _t('Einen Zusatzwert tauschen')), cls: n && canAfford(c.mats, c.gold) ? 'ok' : '' }; }
    case 'refine': { const ks = Object.keys(it.aff), cap = affCap(it), up = ks.filter(x => affStufe(it, x) < cap); return { ic: iconURL(['pa', 'mdref']), n: _t('VEREDELN'), st: !ks.length ? _t('Keine Zusatzwerte') : up.length ? _t('{n} Zusatzwerte · bis Stufe {cap}', { n: up.length, cap }) : _t('Alles auf Stufe {cap} – mehr geht nicht', { cap }), cls: up.length && canAfford(affRefineCost(it, up[0]).mats, affRefineCost(it, up[0]).gold) ? 'ok' : '' }; }
    case 'extract': { const n = Object.keys(it.aff).length; return { ic: iconURL(['pa', 'mdext']), n: _t('EXTRAHIEREN'), st: n ? _t('Ein Zusatzwert bleibt als Essenz') : _t('Keine Zusatzwerte'), cls: '' }; }
  }
  return { ic: '', n: k, st: '', cls: '' };
}
// Zusatzwerte zum Antippen (wie die Material-Auswahl beim Schmieden)
function affRows(it, sel) {
  const pool = affPool(it), cap = affCap(it);
  return `<div class="afrows">${Object.keys(it.aff).map(k => { const s = affStufe(it, k); return `<button class="row wbmat afrow${k === sel ? ' sel' : ''}" data-act="af_sel" data-id="${k}"><div class="ic"><b class="afs" style="color:${gradeCol(s)}">${ROMAN[s]}</b></div><div><div class="nm">${esc(pool[k].s(it.aff[k]))}</div><div class="st">${_t('Stufe {s} von höchstens {n}', { s, n: cap })}</div></div><span class="wbradio">${k === sel ? '✓' : ''}</span></button>`; }).join('')}</div>`;
}
const mClone = it => JSON.parse(JSON.stringify(it));
const affEssCost = s => Math.round((40 + 30 * s) * (1 - weekFx('smith')));
const affExCost = it => Math.round((40 + PRICE[it.tier] * .03) * (1 - weekFx('smith')));
function affEssWhy(it, ek, k) {
  const e = modParse(ek); if (!e || e.f !== 'aff') return _t('Unbekannte Essenz.');
  if (e.w !== (it.slot === 'weapon')) return e.w ? _t('Passt nur auf Waffen.') : _t('Passt nur auf Rüstung und Helm.');
  if (modHave(ek) < 1) return _t('Davon hast du keine mehr.');
  if (e.id !== k && e.id in it.aff) return _t('Diesen Zusatzwert hat der Gegenstand schon – wähle ihn oben aus.');
  if (e.id === k && Math.min(e.t, affCap(it)) <= affStufe(it, k)) return _t('Bringt nichts: der Wert ist schon so hoch.');
  return '';
}
function modsBody(it) {
  const S = mUI(it), ms = modsOf(it), N = modSlots(it);
  if (S.i < 0 || S.i > ms.length || S.i >= N) S.i = ms.length < N ? ms.length : 0;
  let h = `<div class="mslots">${Array.from({ length: N }, (_, i) => { const k = ms[i], sel = i === S.i || (!k && S.i === ms.length && i === ms.length); return k ? `<button class="mslot${sel ? ' sel' : ''}" data-act="mod_slot" data-i="${i}" style="--c:${modCol(k)}" aria-label="${esc(modName(k))}">${modImg(k)}<b>${ROMAN[modParse(k).t]}</b></button>` : `<button class="mslot free${sel ? ' sel' : ''}" data-act="mod_slot" data-i="${ms.length}" aria-label="${_t('Freier Platz')}"><span>+</span></button>`; }).join('')}</div>`;
  if (S.i < ms.length) {
    const k = ms[S.i], p = modParse(k), c = modRemoveCost(k);
    h += `<div class="wbpart"><div class="wbpart-h">${modImg(k)}<b style="color:${modCol(k)}">${esc(modName(k))}</b><small>${esc(MOD_FAM[p.f].n)}</small></div><p class="wbline">${nb(esc(modDesc(k, it)))}</p>${wbBtn('mod_out', _t('Herausnehmen · {gold} Gold', { gold: fmt(c) }), P.gold >= c ? '' : _t('Dir fehlt Gold.'), { i: S.i, cls: 'alt' })}<p class="wbdim">${_t('Der Mod kommt zurück in deinen Vorrat.')}</p></div>`;
    if (ms.length < N) h += `<button class="btn alt sm mfree" data-act="mod_slot" data-i="${ms.length}">${_t('Freien Platz füllen ›')}</button>`;
    return h + `<div class="wbhelpers">${mBookBtn('wb')}</div>`;
  }
  const own = modStock().filter(k => modParse(k).f !== 'aff'), fits = own.filter(k => !modFitWhy(it, k));
  if (!own.length) return h + `<p class="wbwhy">${_t('Noch keine Mods im Vorrat. Elite-Gegner und Bosse lassen manchmal welche fallen – in den Endlosen Landen öfter und stärker.')}</p><div class="wbhelpers">${mBookBtn('wb')}</div>`;
  const fams = MOD_FAMS.filter(f => fits.some(k => modParse(k).f === f)); if (S.fam && !fams.includes(S.fam)) S.fam = '';
  const list = fits.filter(k => !S.fam || modParse(k).f === S.fam); if (!list.includes(S.pick)) S.pick = list[0] || null;
  h += `<div class="wbrowh"><span>${_t('Mod wählen:')}</span>${mBookBtn('wb')}</div>`;
  if (fams.length > 1) h += `<div class="mfams">${[''].concat(fams).map(f => `<button class="mfam${S.fam === f ? ' sel' : ''}" data-act="mod_fam" data-id="${f}" aria-label="${f ? esc(MOD_FAM[f].n) : _t('Alle')}">${f ? modImg(MOD_FAM[f].ic) : `<b>${_t('ALLE')}</b>`}<small>${f ? fits.filter(k => modParse(k).f === f).length : fits.length}</small></button>`).join('')}</div>`;
  h += list.length ? `<div class="wbchips">${list.map(k => modChip(k, k === S.pick, 'mod_pick')).join('')}</div>` : `<p class="wbwhy">${_t('Kein Mod passt in diesen Gegenstand.')}</p>`;
  const nf = own.length - fits.length; if (nf) h += `<p class="wbdim">${nf === 1 ? _t('1 Mod passt nicht: diese Art steckt schon drin oder es gibt schon eine Essenz.') : _t('{n} Mods passen nicht: diese Art steckt schon drin oder es gibt schon eine Essenz.', { n: nf })}</p>`;
  const k = S.pick; if (!k) return h;
  const pv = modPreview(it, k), before = resOfItem(it), after = resOfItem(pv), B = SAVE.meta.mods.book, L = mParsed(pv);
  h += `<p class="wbline"><b style="color:${modCol(k)}">${esc(modName(k))}</b>: ${nb(esc(modDesc(k, it)))}</p>` + cmpHTML(it, pv);
  for (const id of after.filter(x => !before.includes(x))) h += `<p class="mresn">✦ ${B[id] ? esc(_t('Resonanz {name}: {fx}', { name: RESOI[id].n, fx: RESOI[id].d(resItemQ(RESOI[id], pv, L)) })) : esc(_t('Eine unbekannte Resonanz erwacht! Setz den Mod ein und finde es heraus.'))}</p>`;
  // entdeckte Resonanzen, denen nur noch ein Mod fehlt
  const miss = R => R.need.filter(x => !L.some(p => p.k === x));
  const near = RESO.filter(R => R.on === 'item' && R.need && B[R.id] && !after.includes(R.id) && (!R.slot || (R.slot === 'w') === (it.slot === 'weapon')) && miss(R).length === 1).slice(0, 2);
  for (const R of near) h += `<p class="wbdim">${esc(_t('Für {name} fehlt noch: {mod}', { name: R.n, mod: MODK[miss(R)[0]].n }))}</p>`;
  return h + wbBtn('mod_in', _t('Einsetzen'), modFitWhy(it, k), { id: k });
}
function rerollBody(it) {
  const keys = Object.keys(it.aff);
  if (!it.rar || !keys.length) { const R = recipeById('reroll'); return wbBtn('craft', esc(R.n), _t('Gewöhnliche Gegenstände haben keine Zusatzwerte.'), { id: 'reroll' }); }
  const S = mUI(it); if (!keys.includes(S.aff)) S.aff = keys[0];
  const k = S.aff, s = affStufe(it, k), pool = affPool(it), opts = affRerollOpts(it, k), c = affRerollCost(it);
  let h = affRows(it, k) + `<div class="wbsep"><b>${_t('ZUFÄLLIG NEU')}</b><small>${_t('Stufe {s} bleibt', { s })}</small></div>`;
  h += `<p class="wbline">${_t('Wird zu einem von: {list}', { list: nb(esc(opts.map(x => pool[x].s(affVal(pool, x, s))).join(' · '))) })}</p>` + wbCost(c.mats, c.gold);
  if (c.n) h += `<p class="wbdim">${_t('Jedes Mal teurer – schon {n}× umgeschmiedet.', { n: c.n })}</p>`;
  h += wbBtn('af_rr', _t('Umschmieden'), !opts.length ? _t('Keine anderen Werte möglich.') : canAfford(c.mats, c.gold) ? '' : true);
  const E = modStock('aff').filter(x => modParse(x).w === (it.slot === 'weapon'));
  h += `<div class="wbsep"><b>${_t('MIT AFFIX-ESSENZ')}</b><small>${_t('du bestimmst den Wert')}</small></div>`;
  if (!E.length) return h + `<p class="wbdim">${it.slot === 'weapon' ? _t('Keine Affix-Essenz für Waffen. Du bekommst welche unter EXTRAHIEREN – aus einer anderen Waffe.') : _t('Keine Affix-Essenz für Rüstung und Helm. Du bekommst welche unter EXTRAHIEREN – aus einer anderen Rüstung oder einem Helm.')}</p>`;
  if (!E.includes(S.ess)) S.ess = E[0];
  const e = modParse(S.ess), why = affEssWhy(it, S.ess, k), cost = affEssCost(e.t);
  h += `<div class="wbchips">${E.map(x => modChip(x, x === S.ess, 'af_ess')).join('')}</div><p class="wbline"><b style="color:${modCol(S.ess)}">${esc(modName(S.ess))}</b>${e.t > affCap(it) ? ' · ' + _t('auf diesem Gegenstand höchstens Stufe {n}', { n: affCap(it) }) : ''}</p>`;
  if (!why) { const pv = mClone(it); affPut(pv, e.id, e.t, k); h += cmpHTML(it, pv); }
  return h + wbCost({}, cost) + wbBtn('af_put', _t('Essenz einsetzen · {gold} Gold', { gold: fmt(cost) }), why || (P.gold >= cost ? '' : _t('Dir fehlt Gold.')));
}
function refineBody(it) {
  const keys = Object.keys(it.aff); if (!keys.length) return `<p class="wbwhy">${_t('Gewöhnliche Gegenstände haben keine Zusatzwerte.')}</p>`;
  const S = mUI(it), cap = affCap(it); if (!keys.includes(S.aff)) S.aff = keys.find(x => affStufe(it, x) < cap) || keys[0];
  const k = S.aff, s = affStufe(it, k); let h = affRows(it, k);
  if (s >= cap) return h + `<p class="wbwhy">${_t('Schon auf Stufe {s} – mehr geht bei dieser Seltenheit nicht. Höhere Seltenheit, höhere Grenze.', { s })}</p>`;
  const c = affRefineCost(it, k), pv = mClone(it); pv.aff[k] = affVal(affPool(it), k, s + 1);
  return h + cmpHTML(it, pv) + wbCost(c.mats, c.gold) + wbBtn('af_ref', _t('Veredeln · Stufe {a} → {b}', { a: s, b: s + 1 }), canAfford(c.mats, c.gold) ? '' : true);
}
function extractBody(it) {
  if (!itemList(it)) return `<p class="wbwhy">${_t('Angelegtes kann nicht extrahiert werden – leg es erst ab.')}</p>`;
  const keys = Object.keys(it.aff); if (!keys.length) return `<p class="wbwhy">${_t('Gewöhnliche Gegenstände haben keine Zusatzwerte.')}</p>`;
  const S = mUI(it); if (!keys.includes(S.aff)) S.aff = keys.slice().sort((a, b) => affStufe(it, b) - affStufe(it, a))[0];
  const k = S.aff, s = affStufe(it, k), ek = 'aff_' + k + ':' + s, c = affExCost(it), back = [it.gems.length ? _t('Edelsteine kommen zurück in den Vorrat.') : '', modsOf(it).length ? _t('Mods kommen zurück in den Vorrat.') : ''].filter(Boolean).join(' ');
  return affRows(it, k) + `<p class="wbline">${_t('Ergibt: {ess}', { ess: `<b style="color:${gradeCol(s)}">${esc(modName(ek))}</b>` })}</p><p class="wbdim">${esc(modDesc(ek))}</p><p class="wbline">${_t('Der Gegenstand geht verloren.')}${back ? ' ' + back : ''}</p>`
    + wbCost({}, c) + wbBtn('af_ex', S.arm ? _t('Wirklich extrahieren?') : _t('Extrahieren · {gold} Gold', { gold: fmt(c) }), P.gold >= c ? '' : _t('Dir fehlt Gold.'), { cls: S.arm ? 'red' : 'alt' }) + (S.arm ? `<p class="wbwhy">${_t('Nochmal tippen zum Bestätigen.')}</p>` : '');
}
function modVerBody(k, it) { return k === 'mods' ? modsBody(it) : k === 'reroll' ? rerollBody(it) : k === 'refine' ? refineBody(it) : k === 'extract' ? extractBody(it) : ''; }
// Extrahieren: Gegenstand weg, ein Zusatzwert als Affix-Essenz in den Vorrat
function affExtract(it, k) {
  if (!itemList(it) || !(k in it.aff)) return null;   // aus Beutel oder Lager
  const c = affExCost(it); if (P.gold < c) return 'poor';
  const ek = 'aff_' + k + ':' + affStufe(it, k); P.gold -= c;
  for (const g of it.gems) gainGem(g); modTakeBack(it); itemTake(it); modAdd(ek, 1); SAVE.meta.mods.ex++;
  if (typeof smithXP === 'function') smithXP(6 + 3 * it.tier + 4 * Math.min(it.rar, 5));
  return ek;
}
function affEssApply(it, ek, k) {
  const why = affEssWhy(it, ek, k); if (why) return why;
  const e = modParse(ek), c = affEssCost(e.t); if (P.gold < c) return _t('Dir fehlt Gold.');
  if (!affPut(it, e.id, e.t, k)) return _t('Das hat nicht geklappt.');
  P.gold -= c; modAdd(ek, -1); computeStats(); return '';
}

/* ---------- Charakter-Reiter MODS: Vorrat, 3 → 1, Resonanz-Buch ---------- */
const modCombCost = k => { const p = modParse(k); return p ? Math.round(40 * Math.pow(2, p.t - 1) * (1 - weekFx('smith'))) : 0; };
const modTop = k => modParse(k).f === 'aff' ? AFF_MAX : MOD_MAX;
function modCombine(k) {
  const p = modParse(k); if (!p || p.t >= modTop(k) || modHave(k) < 3) return null;
  const c = modCombCost(k); if (P.gold < c) return null;
  P.gold -= c; modAdd(k, -3); const nk = p.k + ':' + (p.t + 1); modAdd(nk, 1); return nk;
}
// alle kombinieren, niedrigste Stufe zuerst; plan = nur rechnen
function modCombAll(plan) {
  const o = Object.assign({}, P.mods || {}); let gold = P.gold, n = 0, cost = 0, best = null;
  for (let t = 1; t < MOD_MAX; t++) for (const k of Object.keys(o).filter(x => modParse(x) && modParse(x).t === t).sort()) {
    while ((o[k] || 0) >= 3 && t < modTop(k) && gold >= modCombCost(k)) { const c = modCombCost(k), nk = modParse(k).k + ':' + (t + 1); o[k] -= 3; o[nk] = (o[nk] || 0) + 1; gold -= c; cost += c; n++; best = nk; }
  }
  if (!plan && n) { for (const k in o) if (o[k] > 0) o[k] = Math.min(9999, o[k]); else delete o[k]; P.mods = o; P.gold = gold; }
  return { n, gold: cost, best };
}
function modStockRow(k) {
  const n = modHave(k), p = modParse(k), top = p.t >= modTop(k), c = modCombCost(k), ok = n >= 3 && !top && P.gold >= c;
  const btn = top ? `<span class="pill">${_t('MAX')}</span>` : `<button class="btn sm" data-act="mod_comb" data-id="${k}" ${ok ? '' : 'disabled'}>${_t('3 → 1').replace('→', '<span class="fgar">→</span>')}</button>`;
  const more = top ? '' : n < 3 ? ' · <span class="wbdim nowr">' + _t('noch {n} für 3 → 1', { n: 3 - n }) + '</span>' : ' · <span class="nowr">' + _t('{n} Gold', { n: fmt(c) }) + '</span>';
  return `<div class="row fgrow" style="cursor:default"><div class="ic">${modImg(k)}</div><div><div class="nm"><span style="color:${modCol(k)}">${esc(modName(k))}</span> <b class="fgn">×${n}</b></div><div class="st">${nb(esc(modDesc(k)))}${more}</div></div><div class="acts">${btn}</div></div>`;
}
function modCharHTML() {
  FG.scr = 'char';
  const keys = modStock(), n = keys.reduce((s, k) => s + P.mods[k], 0), B = SAVE.meta.mods.book, nb = RESO.filter(R => B[R.id]).length, pl = modCombAll(true);
  let h = `<div class="fgbox"><img src="${modIconURL('glyphe_kette:6')}" alt=""><div><b>${_t('MODS {n} · RESONANZEN {a}/{b}', { n, a: nb, b: RESO.length })}</b><small>${_t('Mods setzt du an jeder Werkbank und in der Schmiede ein: VERBESSERN → MODS.')}</small></div></div>`;
  h += `<div class="wbhelpers"><button class="btn alt" data-act="mod_book" data-id="char">${_t('Resonanz-Buch')}</button>${wbBtn('mod_comball', pl.n ? _t('Alle kombinieren ({n}×)', { n: pl.n }) : _t('Alle kombinieren'), pl.n ? '' : true)}</div>`;
  h += `<p class="${pl.n ? 'wbline' : 'wbdim'}">${pl.n ? _t('Kostet {cost}.', { cost: _t('{n} Gold', { n: fmt(pl.gold) }) }) : _t('Drei gleiche Mods (Art und Stufe) ergeben einen der nächsten Stufe.')}</p>`;
  if (!keys.length) return h + `<p class="sub">${_t('Noch keine Mods. Elite-Gegner und Bosse lassen manchmal welche fallen – in den Endlosen Landen öfter und stärker.')}</p>`;
  for (const f of MOD_FAMS.concat(['aff'])) { const ks = keys.filter(k => modParse(k).f === f); if (ks.length) h += `<h3>${esc(MOD_FAM[f].n.toLocaleUpperCase(LOCALE))}</h3><p class="wbdim">${esc(MOD_FAM[f].d)}</p>` + ks.map(modStockRow).join(''); }
  return h;
}
HOOK.charTabs.push({ k: 'mods', label: () => _t('MODS'), body: () => modCharHTML() });
function resRow(R, known, q) {
  const where = R.on === 'set' ? _t('über die ganze Ausrüstung') : R.slot === 'w' ? _t('auf einer Waffe') : R.slot === 'a' ? _t('auf Rüstung oder Helm') : R.fn ? _t('auf einem Meisterwerk') : _t('auf einem Gegenstand');
  if (!known) { const ic = R.fam.map(f => modImg(MOD_FAM[f].ic, 'mfi')).join(''); return `<div class="row mres unk" style="cursor:default"><div class="ic"><img src="${iconURL(['pa', 'mdbook'])}" alt=""></div><div><div class="nm">???</div><div class="st">${esc(R.h)}</div><div class="st mrec">${ic} ${esc(where)}</div></div><span></span></div>`; }
  const rec = R.need ? R.need.map(k => `<span class="mreck">${modImg(k + ':5', 'mfi')}${esc(MODK[k].n)}</span>`).join(' + ') : esc(R.r());
  return `<div class="row mres${q ? ' on' : ''}" style="cursor:default"><div class="ic"><img src="${modIconURL((R.need ? R.need[0] : MOD_FAM[R.fam[0]].ic.split(':')[0]) + ':8')}" alt=""></div><div><div class="nm">${esc(R.n)}</div><div class="st">${esc(R.d(q || 1))}</div><div class="st mrec">${rec} · ${esc(where)}</div></div>${q ? `<span class="pill">${_t('AKTIV')}</span>` : '<span></span>'}</div>`;
}
function modBookShow() {
  computeStats();
  const B = SAVE.meta.mods.book, A = MODS.act.res, n = RESO.filter(R => B[R.id]).length, rank = R => A[R.id] ? 2 : B[R.id] ? 1 : 0;
  const rows = RESO.slice().sort((a, b) => rank(b) - rank(a)).map(R => resRow(R, B[R.id], A[R.id])).join('');
  showOverlay(`<div class="head"><h2>${_t('RESONANZ-BUCH')}</h2><div class="hbtns"><button class="btn alt sm" data-act="mod_bookx">${_t('Zurück')}</button></div></div>
  <div class="fgbox"><img src="${iconURL(['pa', 'mdbook'])}" alt=""><div><b>${_t('{n} VON {m} ENTDECKT', { n, m: RESO.length })}</b><div class="fgbar"><i style="width:${(n / RESO.length * 100).toFixed(1)}%"></i></div><small>${_t('Bestimmte Mods zusammen wecken eine neue Kraft – auf einem Gegenstand oder über die ganze Ausrüstung. Unentdeckte zeigen einen Hinweis.')}</small></div></div>
  <div class="mbook">${rows}</div>`, true);
}
HOOK.mapMore.push(() => SAVE && SAVE.meta.mods && SAVE.meta.mods.found ? `<button class="btn alt" data-act="mod_book" data-id="map">${_t('Resonanz-Buch')}</button>` : '');

/* ---------- Zeilen am Gegenstand ---------- */
HOOK.itemLines.push((it, L) => {
  if (!it || !it.slot) return;
  const ms = modsOf(it), free = modSlots(it) - ms.length, Lp = ms.map(modParse);
  for (const k of ms) L.push('❖ ' + _t('{mod}: {fx}', { mod: modName(k), fx: modDesc(k, it) }));
  const B = SAVE && SAVE.meta.mods ? SAVE.meta.mods.book : {};
  for (const R of RESO) { if (R.on !== 'item') continue; const q = resItemQ(R, it, Lp); if (q) L.push('✦ ' + (B[R.id] ? _t('Resonanz {name}: {fx}', { name: R.n, fx: R.d(q) }) : _t('Unbekannte Resonanz – leg den Gegenstand an und entdecke sie.'))); }
  if (P && P.gear && P.gear[it.slot] === it) for (const id in MODS.act.res) { const R = RESOI[id]; if (R.on === 'set' && (MODS.act.who[id] || []).includes(it.uid)) L.push('✦ ' + _t('Ausrüstungs-Resonanz {name}: {fx}', { name: R.n, fx: R.d(MODS.act.res[id]) })); }
  // freie Plätze nur bei Gegenständen, die schon Mods tragen (sonst zeigt es die Werkbank) – hält Beschreibungen kurz
  if (ms.length && free > 0) L.push('❖ ' + (free === 1 ? _t('1 freier Mod-Platz') : _t('{n} freie Mod-Plätze', { n: free })));
});

/* ---------- Spielstand ---------- */
HOOK.meta.push(m => {
  const d = m.mods && typeof m.mods === 'object' && !Array.isArray(m.mods) ? m.mods : {}, b = d.book && typeof d.book === 'object' ? d.book : {}, book = {}, num = v => Math.max(0, Math.floor(+v) || 0);
  for (const R of RESO) if (mHas(b, R.id) && num(b[R.id])) book[R.id] = num(b[R.id]);
  m.mods = { book, found: num(d.found), ins: num(d.ins), rr: num(d.rr), vd: num(d.vd), ex: num(d.ex) };
});
HOOK.activate.push(H => {
  const src = H.mods && typeof H.mods === 'object' && !Array.isArray(H.mods) ? H.mods : {}, o = {};
  for (const k of Object.keys(src)) { const n = Math.floor(+src[k]); if (n > 0 && modParse(k)) o[k] = Math.min(9999, n); }
  H.mods = o;
  const give = k => { o[k] = Math.min(9999, (o[k] || 0) + 1); };
  if (H.gear) for (const s of MOD_GEAR) modFixItem(H.gear[s], give);
  for (const it of Array.isArray(H.bag) ? H.bag : []) modFixItem(it, give);
  WB.mod = null; Object.assign(MODS, { cd: {}, q: [], fields: [], whirl: null, shield: 0, on: {}, runT: 0, hasteT: 0, cdCut: null });
});
// Lager (für alle Helden) und alte Daten: kaputte Mods entfernen
HOOK.boot.push(() => { try { const S = SAVE.meta.hide && SAVE.meta.hide.stash; if (Array.isArray(S)) for (const it of S) modFixItem(it, null); } catch (e) { console.error('Mods (Lager):', e); } });

/* ---------- Knöpfe ---------- */
const mSel = () => { const it = wbSel(); return it ? { it, S: mUI(it) } : null; };
ON.mod_slot = (id, b, i) => { const x = mSel(); if (!x) return; x.S.i = i; x.S.pick = null; sfx('click'); openWorkbench(); };
ON.mod_pick = id => { const x = mSel(); if (!x) return; x.S.pick = id; sfx('click'); openWorkbench(); };
ON.mod_fam = id => { const x = mSel(); if (!x) return; x.S.fam = id || ''; x.S.pick = null; sfx('click'); openWorkbench(); };
ON.mod_in = id => {
  const x = mSel(), r = x ? modInsert(x.it, id) : 'none';
  if (r === '') { sfx('craft'); shake(1.5); toast(_t('{mod} eingesetzt', { mod: modName(id) }), modCol(id)); x.S.i = -1; x.S.pick = null; } else { sfx('deny'); if (r && r !== 'none') toast(r); }
  fgDone(); openWorkbench();
};
ON.mod_out = (id, b, i) => {
  const x = mSel(), k = x && modsOf(x.it)[i], r = x ? modRemove(x.it, i) : 'none';
  if (r === 'ok') { sfx('coin'); toast(_t('{mod} zurück im Vorrat', { mod: modName(k) }), modCol(k)); x.S.i = -1; } else sfx('deny');
  fgDone(); openWorkbench();
};
ON.af_sel = id => { const x = mSel(); if (!x) return; x.S.aff = id; x.S.arm = false; sfx('click'); openWorkbench(); };
ON.af_ess = id => { const x = mSel(); if (!x) return; x.S.ess = id; sfx('click'); openWorkbench(); };
ON.af_rr = () => {
  const x = mSel(), r = x ? affReroll(x.it, x.S.aff) : null;
  if (r && r !== 'poor') { x.S.aff = r; SAVE.meta.mods.rr++; sfx('craft'); toast(_t('Umgeschmiedet: {aff}', { aff: affPool(x.it)[r].s(x.it.aff[r]) }), '#79c24e'); if (typeof smithXP === 'function') smithXP(10 + 4 * x.it.tier); } else sfx('deny');
  fgDone(); openWorkbench();
};
ON.af_put = () => {
  const x = mSel(); if (!x) return; const ek = x.S.ess, e = modParse(ek), r = affEssApply(x.it, ek, x.S.aff);
  if (r === '') { x.S.aff = e.id; sfx('craft'); toast(_t('Affix-Essenz eingesetzt: {aff}', { aff: affPool(x.it)[e.id].s(x.it.aff[e.id]) }), '#9affd8'); } else { sfx('deny'); toast(r); }
  fgDone(); openWorkbench();
};
ON.af_ref = () => {
  const x = mSel(), r = x ? affRefine(x.it, x.S.aff) : null;
  if (r === 'ok') { SAVE.meta.mods.vd++; sfx('craft'); shake(1.5); toast(_t('Veredelt: {aff}', { aff: affPool(x.it)[x.S.aff].s(x.it.aff[x.S.aff]) }), '#79c24e'); if (typeof smithXP === 'function') smithXP(15 * affStufe(x.it, x.S.aff)); } else sfx('deny');
  fgDone(); openWorkbench();
};
ON.af_ex = () => {
  const x = mSel(); if (!x) return;
  if (!x.S.arm) { x.S.arm = true; sfx('click'); openWorkbench(); return; }
  const r = affExtract(x.it, x.S.aff);
  if (r && r !== 'poor') { sfx('craft'); shake(2); toast(_t('Extrahiert: {ess}', { ess: modName(r) }), '#9affd8'); selItem = null; WB.mod = null; } else { x.S.arm = false; sfx('deny'); }
  fgDone(); openWorkbench();
};
ON.mod_book = id => { MODS.bookFrom = id || 'wb'; sfx('page'); modBookShow(); };
ON.mod_bookx = () => { const f = MODS.bookFrom; sfx('click'); if (f === 'char') openChar('mods'); else if (f === 'map') showMapMore(); else openWorkbench(); };
ON.mod_comb = id => { const r = modCombine(id); if (r) { sfx('craft'); toast(modName(r), modCol(r)); saveChar(); } else sfx('deny'); openChar('mods'); };
ON.mod_comball = () => { const r = modCombAll(false); if (r.n) { sfx('craft'); toast(_t('{n}× kombiniert – bestes: {mod}', { n: r.n, mod: modName(r.best) }), modCol(r.best)); saveChar(); } else sfx('deny'); openChar('mods'); };
// Verkaufen beim Händler und im Charakterbildschirm: Mods bleiben im Vorrat (wie js/ui.js, dazu die Mods zurück)
const mBack = it => { const n = modTakeBack(it); if (n) toast(n === 1 ? _t('1 Mod zurück in den Vorrat') : _t('{n} Mods zurück in den Vorrat', { n }), '#9affd8'); };
// aus Beutel oder Lager (6.2: sellItem, sellAll in js/ui.js); Sammel-Verkauf lässt Gegenstände mit Mods ohnehin aus
ON.sell = id => { const f = findItem(id); if (f && !f.eq && sellItem(f.it, mBack)) { sfx('coin'); saveChar(); persist(); } selItem = null; openChar(); };
ON.msell = id => { const f = findItem(id); if (f && !f.eq && sellItem(f.it, mBack)) { sfx('coin'); saveChar(); persist(); } openMerchant(); };
ON.sellall = () => sellAll(mBack);

document.head.insertAdjacentHTML('beforeend', `<style>
.mslots{display:flex;flex-wrap:wrap;gap:6px;margin:4px 0 8px}
.mslot{position:relative;width:52px;height:52px;border:0;padding:0;display:grid;place-items:center;background:var(--night);box-shadow:inset 0 0 0 2px var(--c,var(--stone-hi));cursor:pointer}
.mslot img{width:32px;height:32px;image-rendering:pixelated}
.mslot b{position:absolute;left:3px;top:3px;font-family:var(--f-display);font-weight:400;font-size:7px;color:var(--c);text-shadow:1px 1px 0 #000}
.mslot.free{background:var(--stone-lo);box-shadow:inset 0 0 0 2px var(--stone-hi)}.mslot.free span{font-family:var(--f-display);font-size:14px;color:var(--parch-dim)}
.mslot.sel{box-shadow:inset 0 0 0 3px var(--gold),0 0 0 2px var(--night);background:var(--stone-hi)}
.mfams{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:4px;margin:4px 0}
.mfam{position:relative;min-width:0;height:48px;border:0;padding:0;background:var(--stone-lo);box-shadow:inset 0 0 0 2px var(--stone-hi);display:grid;place-items:center;cursor:pointer;color:var(--parch)}
.mfam img{width:26px;height:26px;image-rendering:pixelated}.mfam b{font-family:var(--f-display);font-weight:400;font-size:7px}
.mfam small{position:absolute;right:3px;bottom:1px;font-size:14px;color:var(--parch-dim)}.mfam.sel{background:var(--stone-hi);box-shadow:inset 0 0 0 2px var(--gold)}
.mfree{margin:0 0 6px}.wbab .wbpart>.btn:not(.sm){display:block;width:100%;margin-top:6px}.nowr{white-space:nowrap}
.mresn{font-size:17px;line-height:1.12;color:#ffd24a;margin:4px 0 6px}
.afrows{display:grid;gap:4px;margin:2px 0 6px}.wbab .afrow{margin:0;background:var(--night)}.afrow .ic{width:40px;height:40px}
.afs{font-family:var(--f-display);font-weight:400;font-size:10px;text-shadow:1px 1px 0 #000}
.afrow.sel{box-shadow:inset 0 0 0 2px var(--gold);background:var(--stone-hi)}
.mbook .row{margin-bottom:5px}.mres .st{line-height:1.1}.mres.unk{opacity:.78}.mres.unk .nm{color:var(--parch-dim)}
.mres.on{box-shadow:inset 0 0 0 2px var(--gold)}.mres .ic img{width:32px;height:32px;image-rendering:pixelated}
.mrec{color:var(--parch-dim);font-size:15px;margin-top:2px}.mreck{display:inline-flex;align-items:center;gap:2px;white-space:nowrap}
img.mfi{width:16px;height:16px;image-rendering:pixelated;vertical-align:-3px}
</style>`);
