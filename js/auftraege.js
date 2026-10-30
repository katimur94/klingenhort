'use strict';
/* =========================================================
   KLINGENHORT – Aufträge (6.3 „Aufträge & Ruf“): je Held 3 Tages- und 3 Wochenaufträge an der Auftragstafel im Versteck (auch Karte → Mehr)
   Neu um Mitternacht (Ortszeit) bzw. montags (weekNo, js/weekly.js). Je Held, Tag und Woche fest ausgewürfelt (gleiche Saat = gleiche Aufträge);
   die Uhr läuft nur vorwärts – zurückgestellt bleiben die Aufträge. Erfüllte, aber nicht abgeholte Aufträge bleiben beim Wechsel als „noch abzuholen“.
   Nur Machbares: Lande-Aufträge ab LV 5 (Weltentor), Acker mit Kräutergarten, Eier mit Ei im Nest, Glücksrad mit Tempel …; Ziele wachsen mit dem Level.
   Fortschritt über HOOK.stat (jede stat()-Zählung, js/core.js) und HOOK.kill – Meldung, sobald ein Auftrag erfüllt ist.
   Einmal am Tag ein Tagesauftrag gratis neu würfeln. Belohnung: Gold, Glücksmünzen, Material (auch neue Rohstoffe), Bauteile, manchmal Mod oder Ei,
   dazu Ruf und Ruf-Marken der Fraktion des Auftrags (js/fraktionen.js). Wochenaufträge geben etwa fünfmal so viel.
   Spielstand: SAVE.meta.auf = { v, h: { Held: { d: Tag (JJJJMMTT), w: Woche, dq: [Auftrag], wq: [Auftrag], rr: Tag des Neuwürfelns, rn, lo: [Auftrag] } }, n: abgeholt }
     Auftrag = { k: Art (AUFDEF), f: Fraktion, n: Ziel, c: Stand, x?: Rohstoff, s?: [Gegnerarten], ok: erfüllt, pd: abgeholt, rw: [Belohnung], rep, tok }
   Schnittstelle: AUFDEF · aufSet() → Aufträge des Helden · aufEv(ereignis, n, x) · aufClaim('d'|'w'|'lo', i) · aufReroll(i) · aufReady() · aufOpen(von) · aufText(q)
   ========================================================= */

document.head.insertAdjacentHTML('beforeend', `<style>
.aqg{display:grid;gap:8px;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));margin-bottom:4px}
.aq{background:var(--stone-lo);padding:8px 10px;box-shadow:inset 3px 0 0 var(--c);display:flex;flex-direction:column;gap:6px;min-width:0}
.aq.ready{background:#2e2618;box-shadow:inset 3px 0 0 var(--c),inset 0 0 0 2px var(--gold)}
.aq.paid{opacity:.5}
.aqh{display:flex;gap:8px;align-items:center}.aqh img{width:28px;height:28px;image-rendering:pixelated;flex:none}
.aqt{font-size:19px;line-height:1.05}.aqf{font-family:var(--f-display);font-size:6px;line-height:1.5;color:var(--c);margin-top:3px;letter-spacing:1px}
.aqb,.fkbar{position:relative;height:14px;background:var(--night);box-shadow:inset 0 0 0 2px var(--stone-hi)}
.aqb i,.fkbar i{position:absolute;left:2px;top:2px;bottom:2px;max-width:calc(100% - 4px);background:var(--c,var(--gold))}
.aqb span,.fkbar span{position:absolute;inset:0;display:grid;place-items:center;font-family:var(--f-display);font-size:7px;text-shadow:1px 1px 0 #000;white-space:nowrap}
.aqr{display:flex;flex-wrap:wrap;gap:4px}
.rwc{display:inline-flex;align-items:center;gap:3px;background:var(--night);padding:2px 6px 2px 3px;font-size:16px;line-height:1;box-shadow:inset 0 -2px 0 var(--c,var(--stone-hi));white-space:nowrap}
.rwc img{width:18px;height:18px;image-rendering:pixelated;object-fit:contain}
.rwc.rep{color:var(--c)}
.aqa{display:flex;gap:6px}.aqa .btn{flex:1;min-height:44px}
body.touch .panel [data-act^="auf_"],body.touch .panel .btn[data-act^="auf_"]{min-height:44px}
.aqok{font-family:var(--f-display);font-size:7px;color:var(--moss);padding:4px 0}
.aqh3{display:flex;flex-wrap:wrap;justify-content:space-between;align-items:baseline;gap:2px 10px}.aqh3 small{font-family:var(--f-body);font-size:16px;color:var(--parch-dim);letter-spacing:0}
.aqall{width:100%;min-height:44px;margin:4px 0 8px}
.fkrow{grid-template-columns:44px minmax(0,1fr) auto}.fkrow.sel{box-shadow:inset 0 0 0 2px var(--c)}.fkrow .fkbar{margin-top:5px;height:10px}
.fktok{display:inline-flex;align-items:center;gap:3px;font-family:var(--f-display);font-size:9px;color:var(--parch);white-space:nowrap}.fktok img{width:20px;height:20px;image-rendering:pixelated}
.fkhead{display:flex;gap:10px;align-items:center;margin:4px 0 8px}.fkhead>img{width:40px;height:40px;image-rendering:pixelated;flex:none}.fkhead>div{flex:1;min-width:0}.fkhead .nm{font-size:20px;line-height:1.05;margin-bottom:5px}
.fkrk{background:var(--stone-lo);padding:6px 8px;margin-bottom:4px;font-size:17px;line-height:1.1;opacity:.6}.fkrk b{display:flex;justify-content:space-between;align-items:baseline;flex-wrap:wrap;gap:0 8px;font-family:var(--f-display);font-weight:400;font-size:7px;line-height:1.5;margin-bottom:3px}.fkrk b small{font-family:var(--f-body);font-size:15px;color:var(--parch-dim)}
.fkrk.on{opacity:1;box-shadow:inset 3px 0 0 var(--c)}.fkrk.nx{opacity:1;box-shadow:inset 0 0 0 2px var(--c)}
.fkul{margin:0 0 6px;padding-left:20px;font-size:17px;line-height:1.15}.fkul li{margin-bottom:3px}
.fkopts{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:6px;margin-bottom:8px}.fkopts .opt{min-width:0;display:flex;flex-direction:column;align-items:center;gap:3px;padding:6px 2px}.fkopts .opt img{width:26px;height:26px;image-rendering:pixelated}.fkopts .opt small{margin:0;display:flex;align-items:center;gap:2px}.fkopts .opt small img{width:14px;height:14px}
.fkoff .btn{min-height:44px;display:inline-flex;align-items:center;gap:4px;white-space:nowrap}.fkoff .btn img{width:16px;height:16px;image-rendering:pixelated}.fkoff.dim{opacity:.55}
.fkttl{display:flex;flex-wrap:wrap;gap:6px}.fkttl .opt{flex:0 1 auto}
.aqrev{text-align:center}.aqrev h2{margin:4px 0 6px;color:var(--gold)}
.aqgot{text-align:left;max-width:520px;margin:6px auto}.rwrow{animation:aqin .45s steps(5) both}
@keyframes aqin{0%{opacity:0;transform:translateY(10px) scale(.96)}100%{opacity:1;transform:none}}
.aqrp{display:flex;gap:10px;align-items:center;text-align:left;max-width:520px;margin:8px auto;background:var(--stone-lo);padding:8px 10px;box-shadow:inset 3px 0 0 var(--c)}.aqrp>img{width:32px;height:32px;image-rendering:pixelated;flex:none}.aqrp>div{flex:1;min-width:0}.aqrp b{font-family:var(--f-display);font-weight:400;font-size:7px;line-height:1.5;color:var(--c);display:block;margin-bottom:4px}
.aqrp .fkbar i{width:var(--a);animation:aqfill 1.1s .5s steps(12) forwards}
@keyframes aqfill{from{width:var(--a)}to{width:var(--b)}}
.aqup{max-width:520px;margin:8px auto;padding:10px;background:#2e2618;box-shadow:inset 0 0 0 3px var(--c);animation:aqin .5s 1.2s steps(5) both}.aqup b{display:block;font-family:var(--f-display);font-weight:400;font-size:11px;color:var(--c);margin-bottom:6px}.aqup .nm{font-size:22px}.aqup p{margin:4px 0 0;font-size:17px;color:var(--parch-dim)}
</style>`);

/* ---------- Hilfen ---------- */
const AUF = { from: 'hide', tab: 'auf', fk: null, qf: 'orden', rev: null, op: 0, guard: 0, hid: null, until: 0 };
function aufTry(fn, d) { try { return fn(); } catch (e) { return d; } }
const aufLand = () => typeof lCanGo === 'function' && lCanGo() && !!(SAVE && SAVE.meta.lande);
const aufMods = () => typeof modStock === 'function' ? modStock().length : 0;
const aufEggs = nest => typeof nestEggs !== 'function' ? 0 : nest ? nestEggs().length : (SAVE.meta.pets && SAVE.meta.pets.eggs ? SAVE.meta.pets.eggs.length : 0);
const aufEggReady = () => typeof nestEggs === 'function' && nestEggs().some(g => aufTry(() => eggView(g).q >= .6, false));
// runde Zahlen: 37 → 35, 1234 → 1200
function aufNice(v) { v = Math.max(1, +v || 1); const s = v < 20 ? 1 : v < 200 ? 5 : v < 2000 ? 50 : v < 20000 ? 500 : 5000; return Math.max(s, Math.round(v / s) * s); }
// verschiedene Gegnerarten: nicht mehr, als der Held schon treffen kann (Kampagne bis zum erreichten Akt, Lande: fast alle)
function aufTypes(n) { const st = aufLand() ? 99 : Math.max(3, (P.maxAct || P.act || 1) * 7); const have = Object.keys(EN).filter(k => !EN[k].boss && EN[k].cost < 99 && EN[k].from <= st).length; return clamp(n, 3, Math.max(3, have - 2)); }
// Beutewert eines Ausflugs: wächst mit dem Level, höchstens etwas unter dem eigenen Bestwert (mal 1 bzw. 3 für die Woche)
function aufLoot(lv, k) { const best = SAVE.meta.lande ? SAVE.meta.lande.best || 0 : 0; let v = (100 + lv * 30) * k; if (best > 0) v = Math.min(v, Math.max(150 * k, best * .7 * k)); return aufNice(v); }
function aufDay(t) { const d = new Date(t); return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate(); }
function aufMidnight(t) { const d = new Date(t); return new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1).getTime(); }
function aufMonday(t) { const d = new Date(t), dow = (d.getDay() + 6) % 7; return new Date(d.getFullYear(), d.getMonth(), d.getDate() + 7 - dow).getTime(); }
const aufGat = (q, n, x) => x === q.x ? q.c + n : q.c;

/* ---------- Arten von Aufträgen ----------
   f Fraktion · ev Ereignis (aufEv) · d(lv) / w(lv) Ziel als Tages- / Wochenauftrag (0 = gibt es so nicht) · ok() machbar?
   x(R) Zusatzwert (Rohstoff) · add(q, n, x) neuer Stand (sonst + n) · g Schwierigkeit (mehr Belohnung) · t(q) Text */
const AUFDEF = {
  // Orden des Weltentors: Kampagne, Bosse, Bestiarium
  kill: { f: 'orden', ev: 'kill', d: lv => aufNice(30 + lv * 2), w: lv => aufNice(200 + lv * 8), t: q => _t('Besiege {n} Gegner', { n: q.n }) },
  elite: { f: 'orden', ev: 'elite', d: lv => 4 + Math.floor(lv / 6), w: lv => 20 + Math.floor(lv * .6), t: q => _t('Besiege {n} Elite-Gegner', { n: q.n }) },
  champ: { f: 'orden', ev: 'champ', d: () => 1, w: lv => 3 + (lv >= 20 ? 1 : 0), g: 1.3, t: q => q.n === 1 ? _t('Besiege einen Champion') : _t('Besiege {n} Champions', { n: q.n }) },
  boss: { f: 'orden', ev: 'boss', d: lv => lv >= 8 ? 1 : 0, w: () => 3, g: 1.5, t: q => q.n === 1 ? _t('Bezwinge einen Boss') : _t('Bezwinge {n} Bosse', { n: q.n }) },
  bz: { f: 'orden', ev: 'bz', ok: () => aufLand() && P.lv >= 8, d: lv => lv >= 25 ? 1 : 0, w: lv => 1 + (lv >= 30 ? 1 : 0), g: 1.8, t: q => q.n === 1 ? _t('Besiege einen der Tausend Bosse') : _t('Besiege {n} der Tausend Bosse', { n: q.n }) },
  arten: { f: 'orden', ev: 'type', d: lv => aufTypes(4 + Math.floor(lv / 8)), w: lv => aufTypes(10 + Math.floor(lv / 4)), add: (q, n, x) => { if (!Array.isArray(q.s)) q.s = []; if (x && !q.s.includes(x)) q.s.push(x); return q.s.length; }, t: q => _t('Besiege {n} verschiedene Gegnerarten', { n: q.n }) },
  node: { f: 'orden', ev: 'node', d: lv => 4 + (lv >= 20 ? 2 : 0), w: () => 25, t: q => _t('Schaffe {n} Orte auf der Weltkarte', { n: q.n }) },
  akt: { f: 'orden', ev: 'act', d: () => 0, w: () => 1, g: 1.5, t: () => _t('Bezwinge einen Akt-Boss der Kampagne') },
  daily: { f: 'orden', ev: 'daily', d: () => 1, w: () => 0, t: () => _t('Schaffe die Tages-Challenge') },
  // Kundschafter der Lande (ab LV 5)
  lkill: { f: 'kund', ev: 'lkill', ok: aufLand, d: lv => aufNice(25 + lv * 1.5), w: lv => aufNice(150 + lv * 5), t: q => _t('Besiege {n} Gegner in den Endlosen Landen', { n: q.n }) },
  lelite: { f: 'kund', ev: 'lelite', ok: aufLand, d: lv => 3 + Math.floor(lv / 8), w: lv => 15 + Math.floor(lv / 2), t: q => _t('Besiege {n} Elite-Gegner in den Endlosen Landen', { n: q.n }) },
  ext: { f: 'kund', ev: 'ext', ok: aufLand, d: () => 1, w: lv => 3 + (lv >= 20 ? 1 : 0), g: 1.2, t: q => q.n === 1 ? _t('Entkomme lebend aus den Endlosen Landen') : _t('Entkomme {n}× lebend aus den Endlosen Landen', { n: q.n }) },
  extv: { f: 'kund', ev: 'extv', ok: aufLand, d: lv => aufLoot(lv, 1), w: lv => aufLoot(lv, 3), g: 1.3, add: (q, n) => Math.max(q.c, n), t: q => _t('Bring von einem Ausflug Beute im Wert von {n} Gold heim', { n: fmt(q.n) }) },
  beacon: { f: 'kund', ev: 'beacon', ok: () => aufLand() && ((SAVE.meta.lande.stones || 0) > 0 || !!lPerk('stone')), d: () => (SAVE.meta.lande.stones || 0) > 0 ? 1 : 0, w: () => 1, g: 1.3, t: () => _t('Setze ein Leuchtfeuer in den Landen') },
  region: { f: 'kund', ev: 'region', ok: aufLand, d: lv => 1 + (lv >= 15 ? 1 : 0), w: lv => 4 + Math.floor(lv / 15), t: q => q.n === 1 ? _t('Entdecke eine neue Region') : _t('Entdecke {n} neue Regionen', { n: q.n }) },
  arte: { f: 'kund', ev: 'arte', ok: aufLand, d: () => 1, w: lv => 4 + Math.floor(lv / 20), t: q => q.n === 1 ? _t('Finde ein Artefakt') : _t('Finde {n} Artefakte', { n: q.n }) },
  mis: { f: 'kund', ev: 'mis', ok: aufLand, d: () => 2, w: () => 6, t: q => _t('Erfülle {n} Aufträge von Kundschafterin Elwa', { n: q.n }) },
  bird: { f: 'kund', ev: 'bird', ok: () => aufLand() && typeof birdTotal === 'function' && birdTotal() > 0, d: () => 1, w: () => 2, t: q => q.n === 1 ? _t('Schick einen magischen Vogel heim') : _t('Schick {n} magische Vögel heim', { n: q.n }) },
  // Handelsgilde: Basar, Gold, Schmiede
  mkbuy: { f: 'gilde', ev: 'mkbuy', d: () => 1, w: () => 4, t: q => q.n === 1 ? _t('Kaufe ein Angebot im Basar') : _t('Kaufe {n} Angebote im Basar', { n: q.n }) },
  mksell: { f: 'gilde', ev: 'mksell', d: () => 3, w: () => 12, t: q => _t('Verkaufe {n}× im Basar – sofort oder versteigert', { n: q.n }) },
  mkauc: { f: 'gilde', ev: 'mkauc', d: () => 1, w: () => 3, t: q => q.n === 1 ? _t('Stell etwas im Basar zur Versteigerung ein') : _t('Stell {n} Dinge im Basar zur Versteigerung ein', { n: q.n }) },
  mkwon: { f: 'gilde', ev: 'mkwon', ok: () => P.lv >= 5, d: () => 0, w: () => 1, g: 1.4, t: () => _t('Gewinne eine Versteigerung im Basar') },
  gold: { f: 'gilde', ev: 'gold', d: lv => aufNice(800 + lv * 120), w: lv => aufNice(6000 + lv * 900), t: q => _t('Verdiene {n} Gold', { n: fmt(q.n) }) },
  up: { f: 'gilde', ev: 'up', d: () => 3, w: () => 12, t: q => _t('Werte {n}× einen Gegenstand auf – auch Fehlschläge zählen', { n: q.n }) },
  forge: { f: 'gilde', ev: 'forge', d: () => 1, w: () => 4, t: q => q.n === 1 ? _t('Schmiede einen Gegenstand') : _t('Schmiede {n} Gegenstände', { n: q.n }) },
  salv: { f: 'gilde', ev: 'salv', d: () => 3, w: () => 12, t: q => _t('Zerlege {n} Gegenstände', { n: q.n }) },
  mod: { f: 'gilde', ev: 'mod', ok: () => aufMods() > 0 || !!(SAVE.meta.mods && SAVE.meta.mods.found > 0), d: () => aufMods() > 0 ? 1 : 0, w: () => 3, t: q => q.n === 1 ? _t('Setze einen Mod ein') : _t('Setze {n} Mods ein', { n: q.n }) },
  spin: { f: 'gilde', ev: 'spin', ok: () => hideLv('tempel') >= 1, d: () => (P.fate || 0) >= 1 || aufTry(freeSpin, null) ? 1 : 0, w: () => 3, t: q => q.n === 1 ? _t('Dreh am Glücksrad im Glückstempel') : _t('Dreh {n}× am Glücksrad im Glückstempel', { n: q.n }) },
  build: { f: 'gilde', ev: 'build', ok: () => typeof buildFree === 'function' && buildFree(), d: () => 0, w: () => 1, t: () => _t('Starte einen Ausbau im Versteck') },
  // Hüter der Wildnis: Sammeln, Acker, Eier, Begleiter
  gat: { f: 'wild', ev: 'gat', x: R => fkPick(R, ['holz', 'stein', 'faser']), d: lv => Math.min(40, 15 + Math.floor(lv / 2)), w: lv => aufNice(80 + lv), add: aufGat, t: q => _t('Sammle {n} {mat}', { n: q.n, mat: MATS[q.x].n }) },
  gatr: { f: 'wild', ev: 'gat', ok: () => aufLand() && P.lv >= 15, x: R => fkPick(R, ['eisenholz', 'marmor', 'obsidian']), d: () => 0, w: lv => 6 + Math.floor(lv / 8), g: 1.4, add: aufGat, t: q => _t('Sammle {n} {mat}', { n: q.n, mat: MATS[q.x].n }) },
  feder: { f: 'wild', ev: 'gat', x: () => 'feder', d: () => 4, w: () => 20, add: aufGat, t: q => _t('Sammle {n} {mat}', { n: q.n, mat: MATS[q.x].n }) },
  harvest: { f: 'wild', ev: 'harvest', ok: () => hideLv('garten') >= 1, d: () => 2, w: () => 8, t: q => _t('Ernte {n} Beete im Acker', { n: q.n }) },
  sow: { f: 'wild', ev: 'sow', ok: () => hideLv('garten') >= 1, d: () => 2, w: () => 8, t: q => _t('Säe {n} Beete im Acker', { n: q.n }) },
  care: { f: 'wild', ev: 'care', ok: () => aufEggs(true) > 0, d: () => 5, w: () => 20, t: q => _t('Pflege deine Eier {n}× – wärmen, füttern oder streicheln', { n: q.n }) },
  hatch: { f: 'wild', ev: 'hatch', ok: () => aufEggs(true) > 0, d: () => aufEggReady() ? 1 : 0, w: () => 1, g: 1.3, t: () => _t('Lass ein Ei im Brutnest schlüpfen') },
  pkill: { f: 'wild', ev: 'pkill', ok: () => typeof petActive === 'function' && !!petActive(), d: lv => aufNice(30 + lv), w: lv => aufNice(150 + lv * 4), t: q => _t('Besiege {n} Gegner, während dein Begleiter dabei ist', { n: q.n }) }
};
function aufText(q) { const D = AUFDEF[q.k]; return D ? aufTry(() => D.t(q), '?') : '?'; }

/* ---------- Auswürfeln: fest je Held und Tag/Woche ---------- */
// Was der Held gerade schaffen kann (Art → Ziel), wk = Wochenauftrag
function aufAvail(wk) { const lv = P.lv, r = {}; for (const k in AUFDEF) { const D = AUFDEF[k]; if (D.ok && !aufTry(D.ok, false)) continue; const n = aufTry(() => (wk ? D.w : D.d)(lv), 0); if (n > 0) r[k] = Math.round(n); } return r; }
// bis zu n Aufträge, möglichst aus verschiedenen Fraktionen, ohne die Arten in „ohne“
function aufGen(wk, seed, ohne, n) {
  const R = mulberry(seed), A = aufAvail(wk), out = [], usedK = new Set(ohne || []), usedF = new Set();
  for (let i = 0; i < (n || 3); i++) {
    let pool = Object.keys(A).filter(k => !usedK.has(k) && !usedF.has(AUFDEF[k].f)); if (!pool.length) pool = Object.keys(A).filter(k => !usedK.has(k)); if (!pool.length) break;
    const fs = [...new Set(pool.map(k => AUFDEF[k].f))], f = fs[Math.floor(R() * fs.length)], ks = pool.filter(k => AUFDEF[k].f === f), k = ks[Math.floor(R() * ks.length)];
    usedK.add(k); usedF.add(f); out.push(aufMake(k, A[k], wk, R));
  }
  return out;
}
function aufMake(k, n, wk, R) {
  const D = AUFDEF[k], g = D.g || 1, q = { k, f: D.f, n, c: 0, ok: 0, pd: 0 };
  if (D.x) q.x = D.x(R);
  q.rw = aufRewards(q, wk, R); q.rep = Math.round((wk ? 200 : 40) * g / 5) * 5; q.tok = (wk ? 8 : 2) + (g >= 1.4 ? (wk ? 2 : 1) : 0);
  return q;
}
// Material passend zum Level (auch die neuen Rohstoffe), Menge nach Wert
function aufMat(R, lv, val) { const band = lv < 12 ? ['erz', 'leder', 'knochen', 'holz', 'stein', 'faser'] : lv < 28 ? ['kristall', 'horn', 'mithril', 'eisenholz', 'marmor', 'glut'] : ['adamant', 'schuppe', 'stern', 'obsidian', 'sternholz', 'eisenholz'], k = fkPick(R, band); return { t: 'mat', k, n: clamp(Math.round(val / MK_MATV[k]), 1, 60) }; }
function aufEggTier(lv, R) { return clamp((lv < 10 ? 1 : lv < 25 ? 2 : lv < 40 ? 3 : 4) - (R() < .5 ? 1 : 0), 0, 4); }
function aufRewards(q, wk, R) {
  const lv = P.lv, g = AUFDEF[q.k].g || 1, m = wk ? 5 : 1, L = [];
  L.push({ t: 'gold', n: aufNice((80 + lv * 30) * g * m * (.9 + R() * .2)) });
  if (wk) L.push({ t: 'fate', n: 2 + (R() < .5 ? 1 : 0) }); else if (R() < .3) L.push({ t: 'fate', n: 1 });
  L.push(aufMat(R, lv, (40 + lv * 12) * g * m));
  if (wk || R() < .35) L.push(fkPartE(R, lv, wk ? 0 : -1));
  if (lv >= 5 && R() < (wk ? .5 : .1)) L.push(fkModE(R, lv, 0));
  if (q.f === 'wild' ? (wk || R() < .15) : (wk && R() < .15)) L.push({ t: 'egg', tier: q.f === 'wild' ? aufEggTier(lv, R) : 1 });
  if (q.f === 'kund' && wk && R() < .5) L.push({ t: 'stone', n: 1 });
  return L;
}

/* ---------- Spielstand ---------- */
function aufDef() { return { v: 1, h: {}, n: 0 }; }
const AUF_RW = ['gold', 'fate', 'mat', 'gem', 'part', 'mod', 'egg', 'stone', 'key', 'bird'];
function aufRwOk(e) {
  if (!e || typeof e !== 'object' || !AUF_RW.includes(e.t)) return false;
  if (e.t === 'egg') return Number.isInteger(e.tier) && e.tier >= 0 && e.tier < PET_TIERS.length;
  if (!(Number.isInteger(e.n) && e.n >= 1 && e.n <= 1e8)) return false;
  switch (e.t) {
    case 'mat': return Object.prototype.hasOwnProperty.call(MATS, e.k);
    case 'gem': { const a = String(e.k).split(':'); return !!GEMS[a[0]] && +a[1] >= 0 && +a[1] <= 4; }
    case 'part': return typeof pvalid === 'function' && pvalid(e.k);
    case 'mod': return typeof modValid === 'function' && modValid(e.k);
    case 'bird': return typeof BIRDS !== 'undefined' && !!BIRDS[e.k];
  }
  return true;
}
function aufQFix(q) {
  if (!q || typeof q !== 'object' || !AUFDEF[q.k]) return null;
  const n = clamp(Math.floor(+q.n) || 0, 1, 1e9), o = { k: q.k, f: AUFDEF[q.k].f, n, c: clamp(Math.floor(+q.c) || 0, 0, n), ok: 0, pd: q.pd ? 1 : 0 };
  if (AUFDEF[q.k].x) { if (!Object.prototype.hasOwnProperty.call(MATS, q.x)) return null; o.x = q.x; }
  if (Array.isArray(q.s)) o.s = q.s.filter(x => typeof x === 'string' && x.length < 30).slice(0, 80);
  o.ok = o.c >= n || q.ok ? 1 : 0; if (o.ok) o.c = n;
  o.rw = (Array.isArray(q.rw) ? q.rw : []).filter(aufRwOk).slice(0, 8).map(e => Object.assign({}, e));
  o.rep = clamp(Math.floor(+q.rep) || 0, 0, 5000); o.tok = clamp(Math.floor(+q.tok) || 0, 0, 100);
  return o;
}
function aufFix(d) {
  const o = aufDef(); if (!d || typeof d !== 'object') return o;
  o.n = clamp(Math.floor(+d.n) || 0, 0, 1e9);
  if (d.h && typeof d.h === 'object') for (const id of Object.keys(d.h).slice(0, 60)) {
    const H = d.h[id]; if (!/^[a-z0-9]{4,30}$/i.test(id) || !H || typeof H !== 'object') continue;
    const L = a => (Array.isArray(a) ? a : []).map(aufQFix).filter(Boolean).slice(0, 6);
    o.h[id] = { d: clamp(Math.floor(+H.d) || 0, 0, 99991231), w: clamp(Math.floor(+H.w) || 0, 0, 1e7), dq: L(H.dq), wq: L(H.wq), rr: clamp(Math.floor(+H.rr) || 0, 0, 99991231), rn: clamp(Math.floor(+H.rn) || 0, 0, 999), lo: L(H.lo).filter(q => q.ok && !q.pd) };
  }
  return o;
}
HOOK.meta.push(m => { try { m.auf = aufFix(m.auf); } catch (e) { console.error('Aufträge (meta):', e); m.auf = aufDef(); } AUF.hid = null; });
HOOK.activate.push(() => { AUF.hid = null; AUF.rev = null; });

// Aufträge des aktiven Helden – neu, wenn Tag oder Woche um ist (nur vorwärts); erfüllte, nicht abgeholte wandern nach „noch abzuholen“
function aufSet() {
  if (!P || !SAVE || SAVE.active < 0 || !SAVE.meta.auf) return null;
  const M = SAVE.meta.auf, now = Date.now(), id = P.id; let H = M.h[id];
  if (H && AUF.hid === id && now < AUF.until) return H;
  if (!H) H = M.h[id] = { d: 0, w: 0, dq: [], wq: [], rr: 0, rn: 0, lo: [] };
  const d = aufDay(now), w = weekNo(now); let ch = false;
  const left = L => { for (const q of L) if (q.ok && !q.pd && H.lo.length < 6) H.lo.push(q); };
  if (d > H.d) { left(H.dq); H.d = d; H.dq = aufGen(false, hashStr(id + ':d:' + d)); H.rr = 0; H.rn = 0; ch = true; }
  if (w > H.w) { left(H.wq); H.w = w; H.wq = aufGen(true, hashStr(id + ':w:' + w)); ch = true; }
  for (const k of Object.keys(M.h)) if (!SAVE.chars.some(c => c && c.id === k)) { delete M.h[k]; ch = true; }
  AUF.hid = id; AUF.until = aufMidnight(now);
  if (ch) persist();
  return H;
}
function aufReady() { const H = aufTry(aufSet, null); if (!H) return 0; let n = H.lo.length; for (const q of H.dq.concat(H.wq)) if (q.ok && !q.pd) n++; return n; }

/* ---------- Fortschritt ---------- */
function aufEv(k, n, x) {
  const H = aufSet(); if (!H) return;
  for (const q of H.dq.concat(H.wq)) {
    if (q.ok || q.pd) continue; const D = AUFDEF[q.k]; if (!D || D.ev !== k) continue;
    const c = D.add ? D.add(q, n, x) : q.c + n; q.c = Math.min(q.n, Math.max(q.c, Math.floor(c) || 0));
    if (q.c >= q.n) { q.ok = 1; persist(); const t = _t('Auftrag erfüllt: {q} – hol dir die Belohnung an der Auftragstafel!', { q: aufText(q) }); if (typeof mkToastQ === 'function') mkToastQ({ txt: t, c: FK[q.f].c, s: 'ach' }); else { toast(t, FK[q.f].c); sfx('ach'); } }
  }
}
// stat()-Schlüssel → Ereignis (g_<Rohstoff> und boss_<Art> eigens)
const AUF_STAT = { nodes: 'node', dailies: 'daily', spins: 'spin', harvest: 'harvest', sown: 'sow', arte: 'arte', landeExt: 'ext', landeLoot: 'extv', landeCps: 'beacon', landeRegs: 'region', landeMis: 'mis', builds: 'build', upTry: 'up', salv: 'salv', forged: 'forge', mwMade: 'forge', modIns: 'mod', mkBuy: 'mkbuy', mkWon: 'mkwon', mkSell: 'mksell', mkSold: 'mksell', mkAuc: 'mkauc', eggCare: 'care', hatch: 'hatch', birdsSent: 'bird', goldTotal: 'gold' };
HOOK.stat.push((k, n) => {
  if (!P || typeof k !== 'string') return;
  try {
    if (k.startsWith('g_')) aufEv('gat', n, k.slice(2));
    else if (k.startsWith('boss_')) aufEv('act', 1);
    else if (AUF_STAT[k]) aufEv(AUF_STAT[k], n);
  } catch (e) { console.error('Aufträge:', e); }
});
// Kills: überall; Elite, Champion, Boss, Tausend Bosse, Lande, mit Begleiter, Gegnerart (nicht Puppe, Übungskampf, Totem)
HOOK.kill.push(e => {
  if (!P || !e || e.ai === 'dummy' || e.bTotem || e.bPractice || !G || G.type === 'versteck') return;
  try {
    const L = typeof landeActive === 'function' && landeActive();
    aufEv('kill', 1); aufEv('type', 1, e.t);
    if (e.elite) aufEv('elite', 1); if (e.champ) aufEv('champ', 1); if (e.boss) aufEv('boss', 1); if (e.bz && e.bossId != null) aufEv('bz', 1);
    if (L) { aufEv('lkill', 1); if (e.elite) aufEv('lelite', 1); }
    if (typeof petActive === 'function' && petActive()) aufEv('pkill', 1);
  } catch (err) { console.error('Aufträge (Kill):', err); }
});

/* ---------- Abholen, neu würfeln ---------- */
// → { ok, qs: [Aufträge], got: [Belohnungen], fk: { Fraktion: { rep, tok, p0, r0 } }, up: [{ f, r }] } | { err }
function aufClaim(wk, i) {
  if (!P) return { err: 'hero' }; if (typeof landeActive === 'function' && landeActive()) return { err: 'lande' };
  const H = aufSet(); if (!H) return { err: 'hero' };
  const list = i === 'all' ? [['lo', H.lo], ['d', H.dq], ['w', H.wq]].flatMap(([w, L]) => L.filter(q => q.ok && !q.pd)) : [(wk === 'lo' ? H.lo : wk === 'w' ? H.wq : H.dq)[i]].filter(q => q && q.ok && !q.pd);
  if (!list.length) return { err: 'none' };
  const got = [], fk = {};
  for (const q of list) {
    for (const e of q.rw) { const g = rwGive(e); if (g) got.push(g); }
    if (!fk[q.f]) { const p = fkProg(q.f); fk[q.f] = { rep: 0, tok: 0, p0: p.p, r0: p.r }; }
    fk[q.f].rep += q.rep; fk[q.f].tok += q.tok; q.pd = 1; SAVE.meta.auf.n++;
  }
  H.lo = H.lo.filter(q => !q.pd);
  let up = []; for (const f in fk) up = up.concat(fkGain(f, fk[f].rep, fk[f].tok, true));
  // gleiche Belohnungen zusammenfassen (Alle abholen)
  const sum = []; for (const e of got) { const s = ['gold', 'fate', 'mat', 'gem', 'part', 'mod', 'stone', 'key', 'bird'].includes(e.t) && sum.find(x => x.t === e.t && x.k === e.k); if (s) s.n += e.n; else sum.push(Object.assign({}, e)); }
  stat('aufDone', list.length); saveChar(); persist();
  return { ok: 1, qs: list, got: sum, fk, up };
}
function aufReroll(i) {
  const H = aufSet(); if (!H || H.rr === H.d) return false; const q = H.dq[i]; if (!q || q.ok || q.pd) return false;
  const nq = aufGen(false, hashStr(P.id + ':r:' + H.d + ':' + (H.rn + 1)), H.dq.map(x => x.k), 1)[0]; if (!nq) return false;
  H.rn++; H.dq[i] = nq; H.rr = H.d; persist(); return true;
}

/* ---------- Auftragstafel: Aufträge · Fraktionen · Quartiermeister ---------- */
function aufCard(q, wk, i, rr) {
  const F = FK[q.f], p = q.n ? q.c / q.n : 0;
  const btn = q.pd ? `<span class="aqok">✓ ${_t('ABGEHOLT')}</span>` : q.ok ? `<button class="btn" data-act="auf_claim" data-id="${wk}" data-i="${i}">${_t('Belohnung abholen')}</button>` : rr ? `<button class="btn alt sm" data-act="auf_rr" data-i="${i}">${_t('Neu würfeln (gratis)')}</button>` : '';
  return `<div class="aq${q.ok && !q.pd ? ' ready' : ''}${q.pd ? ' paid' : ''}" style="--c:${F.c}"><div class="aqh"><img src="${fkIc(q.f)}" alt=""><div><div class="aqt">${esc(aufText(q))}</div><div class="aqf">${esc(F.n).toLocaleUpperCase(LOCALE)}</div></div></div>
  <div class="aqb"><i style="width:${(p * 100).toFixed(1)}%"></i><span>${q.k === 'extv' || q.k === 'gold' ? fmt(q.c) + ' / ' + fmt(q.n) : q.c + ' / ' + q.n}</span></div>
  <div class="aqr">${q.rw.map(rwChip).join('')}<span class="rwc rep" style="--c:${F.c}" title="${_t('Ruf-Marken')}"><img src="${fkTokIc(q.f)}" alt="${_t('Ruf-Marken')}">+${q.tok}</span><span class="rwc rep" style="--c:${F.c}">${_t('+{n} Ruf', { n: q.rep })}</span></div>${btn ? `<div class="aqa">${btn}</div>` : ''}</div>`;
}
function aufLeftTxt(ms) { const s = Math.max(60, ms / 1000); return s >= 86400 * 2 ? _t('{n} Tagen', { n: Math.floor(s / 86400) }) : typeof buildTimeText === 'function' ? buildTimeText(Math.ceil(s / 60) * 60) : Math.ceil(s / 3600) + ' h'; }
function aufListHTML() {
  const H = aufSet(), now = Date.now(), rr = H.rr !== H.d, n = aufReady();
  let h = n > 1 ? `<button class="btn aqall" data-act="auf_claim" data-id="all" data-i="0">${_t('Alles abholen ({n})', { n })}</button>` : '';
  if (H.lo.length) h += `<h3>${_t('NOCH ABZUHOLEN')}</h3><div class="aqg">${H.lo.map((q, i) => aufCard(q, 'lo', i, false)).join('')}</div>`;
  h += `<h3 class="aqh3">${_t('HEUTE')}<small>${_t('Neue Aufträge in {t}', { t: aufLeftTxt(aufMidnight(now) - now) })}</small></h3>`;
  h += H.dq.length ? `<div class="aqg">${H.dq.map((q, i) => aufCard(q, 'd', i, rr)).join('')}</div>` : `<p class="sub">${_t('Heute gibt es nichts für dich zu tun.')}</p>`;
  h += `<p class="sub" style="margin:2px 0 8px;font-size:16px">${rr ? _t('Einmal am Tag darfst du einen Tagesauftrag gratis neu würfeln.') : _t('Heute hast du schon neu gewürfelt.')}</p>`;
  h += `<h3 class="aqh3">${_t('DIESE WOCHE')}<small>${_t('Neue Aufträge in {t}', { t: aufLeftTxt(aufMonday(now) - now) })}</small></h3>`;
  h += `<div class="aqg">${H.wq.map((q, i) => aufCard(q, 'w', i, false)).join('')}</div>`;
  return h + `<p class="sub" style="font-size:16px">${_t('Jeder Auftrag gehört zu einer Fraktion: Abholen bringt Ruf und Ruf-Marken. Mit Ruf steigst du im Rang (Vorteile), mit Marken tauschst du beim Quartiermeister.')}</p>`;
}
function aufFkRow(f) {
  const F = FK[f], p = fkProg(f), R = fkRanks(f), lock = F.lande && !aufLand();
  return `<button class="row fkrow${AUF.fk === f ? ' sel' : ''}" data-act="auf_fk" data-id="${f}" style="--c:${F.c}"><div class="ic"><img src="${fkIc(f)}" alt=""></div><div><div class="nm" style="color:${F.c}">${esc(F.n)}</div><div class="st">${_t('Rang {n}: {rank}', { n: p.r + 1, rank: esc(R[p.r].n) })}${lock ? ' · ' + _t('ab LV 5') : ''}</div><div class="fkbar"><i style="width:${(p.p * 100).toFixed(1)}%"></i></div></div><span class="fktok"><img src="${fkTokIc(f)}" alt="${_t('Ruf-Marken')}">${fkTok(f)}</span></button>`;
}
function aufFkDetail(f) {
  const F = FK[f], p = fkProg(f), R = fkRanks(f), now = fkPerkNow(f), M = fkM();
  let h = `<div class="say"><img class="px" src="${iconURL(['sp', F.sp])}" alt=""><div><b style="color:${F.c}">${esc(F.who())}</b>${_t('„{text}“', { text: esc(F.say[(SAVE.meta.auf.n + (P.lv || 0)) % F.say.length]) })}</div></div>
  <div class="fkhead" style="--c:${F.c}"><img src="${fkIc(f)}" alt=""><div><div class="nm" style="color:${F.c}">${_t('Rang {n} von {m}: {rank}', { n: p.r + 1, m: R.length, rank: esc(R[p.r].n) })}</div><div class="fkbar"><i style="width:${(p.p * 100).toFixed(1)}%"></i><span>${p.nx ? _t('{a} / {b} RUF', { a: fmt(p.v), b: fmt(p.nx) }) : _t('HÖCHSTER RANG · {a} RUF', { a: fmt(p.v) })}</span></div></div></div>
  <p class="sub" style="margin:0 0 4px">${esc(F.s)}${F.lande ? ' · ' + _t('Elwas Aufträge in den Landen zählen hier mit.') : ''}</p>${R[p.r + 1] ? `<p class="sub" style="margin:0 0 4px;color:${F.c}">${_t('Nächster Rang „{rank}“: {d}', { rank: esc(R[p.r + 1].n), d: esc(R[p.r + 1].d) })}</p>` : ''}
  <h3>${_t('VORTEILE JETZT')}</h3>${now.length ? `<ul class="fkul">${now.map(x => `<li>${esc(x)}</li>`).join('')}</ul>` : `<p class="sub" style="margin-top:0">${_t('Noch keine – der erste Rang bringt den ersten Vorteil.')}</p>`}
  <h3>${_t('RÄNGE')}</h3>${R.map((x, i) => `<div class="fkrk${i <= p.r ? ' on' : ''}${i === p.r + 1 ? ' nx' : ''}" style="--c:${F.c}"><b><span>${i <= p.r ? '✓ ' : ''}${_t('RANG {n} · {rank}', { n: i + 1, rank: esc(x.n).toLocaleUpperCase(LOCALE) })}</span><small>${_t('ab {n} Ruf', { n: fmt(x.at) })}</small></b>${esc(x.d)}</div>`).join('')}
  <div class="menu" style="margin-top:8px"><button class="btn" data-act="auf_qm" data-id="${f}">${_t('Zum Quartiermeister')} · ${fkTok(f)} <img src="${fkTokIc(f)}" alt="" style="width:16px;height:16px;vertical-align:-3px"></button></div>`;
  if (M.tt.length) h += `<h3>${_t('DEIN TITEL')}</h3><div class="fkttl"><button class="opt${!M.t ? ' sel' : ''}" data-act="auf_ttl" data-id="">${_t('Kein Titel')}</button>${M.tt.map(t => `<button class="opt${M.t === t ? ' sel' : ''}" data-act="auf_ttl" data-id="${t}">${esc(FK_TITLES[t])}</button>`).join('')}</div>`;
  return h;
}
function aufFkHTML() {
  const side = AUF.fk ? `<div class="side sheet"><button class="btn alt sm sheetx" data-act="auf_fk" data-id="" aria-label="${_t('Schließen')}"><span class="x">×</span></button>${aufFkDetail(AUF.fk)}</div>` : `<div class="side"><p class="sub" style="margin-top:0">${_t('Tippe eine Fraktion an: Ränge, Vorteile und was als Nächstes kommt.')}</p></div>`;
  return `<p class="sub" style="margin-top:0">${_t('Vier Fraktionen. Ruf bringt Ränge mit kleinen, dauerhaften Vorteilen für alle deine Helden.')}</p><div class="split"><div>${FKORDER.map(aufFkRow).join('')}</div>${side}</div>`;
}
function aufQmHTML() {
  const f = AUF.qf, F = FK[f], r = fkRank(f), O = fkOffers(f), R = fkRanks(f), now = Date.now();
  const opts = FKORDER.map(k => `<button class="opt${k === f ? ' sel' : ''}" data-act="auf_qf" data-id="${k}" aria-label="${esc(FK[k].n)}" aria-pressed="${k === f}" style="${k === f ? `box-shadow:inset 0 0 0 3px ${FK[k].c}` : ''}"><img src="${fkIc(k)}" alt=""><small><img src="${fkTokIc(k)}" alt="">${fkTok(k)}</small></button>`).join('');
  const rows = O.map(o => {
    const lock = r < o.r, can = !lock && o.left > 0 && fkTok(f) >= o.tok && P.gold >= o.gold, c = rwCol(o.e);
    const st = lock ? _t('ab Rang {n} „{rank}“', { n: o.r + 1, rank: esc(R[o.r].n) }) : o.left > 0 ? _t('noch {n} diese Woche', { n: o.left }) : _t('diese Woche ausverkauft');
    const desc = o.e.t === 'mod' && typeof modDesc === 'function' ? aufTry(() => modDesc(o.e.k), '') : o.e.t === 'egg' ? _t('Kommt in dein Brutnest.') : o.e.t === 'title' ? _t('Erscheint bei deinem Helden.') : '';
    return `<div class="row fkoff${lock || o.left <= 0 ? ' dim' : ''}" style="cursor:default"><div class="ic" style="box-shadow:inset 0 0 0 2px ${c}"><img src="${rwIcon(o.e)}" alt=""></div><div><div class="nm" style="color:${c}">${esc(rwName(o.e))}</div><div class="st">${desc ? esc(desc) + ' · ' : ''}${st}</div></div><button class="btn sm" data-act="auf_buy" data-id="${o.id}" ${can ? '' : 'disabled'} aria-label="${_t('Tauschen')}"><img src="${fkTokIc(f)}" alt="">${o.tok}${o.gold ? ` <i class="coin"></i>${fmt(o.gold)}` : ''}</button></div>`;
  }).join('');
  return `<div class="fkopts">${opts}</div><div class="say"><img class="px" src="${iconURL(['sp', F.sp])}" alt=""><div><b style="color:${F.c}">${esc(F.who())}</b>${_t('{fk}: Du hast {n} Ruf-Marken, dein Rang ist {r} – {rank}.', { fk: esc(F.n), n: fkTok(f), r: r + 1, rank: esc(R[r].n) })}</div></div>
  <p class="sub" style="margin-top:0">${_t('Tauschangebote dieser Woche – neue in {t}. Bezahlt wird mit Ruf-Marken und Gold.', { t: aufLeftTxt(aufMonday(now) - now) })}</p>${rows}`;
}
function aufShow() {
  if (!P) return;
  if (AUF.rev) return aufRevShow();
  const n = aufReady(), tab = (k, l, b) => `<button class="tab" role="tab" aria-selected="${AUF.tab === k}" data-act="auf_tab" data-id="${k}">${l}${b ? ` (${b})` : ''}</button>`;
  const body = AUF.tab === 'ruf' ? aufFkHTML() : AUF.tab === 'qm' ? aufQmHTML() : aufListHTML();
  showOverlay(`<div class="head"><h2>${_t('AUFTRAGSTAFEL')}</h2><div class="hbtns"><div class="gold"><i class="coin"></i>${fmt(P.gold)} <span style="color:#ffd24a"><i class="fc"></i>${P.fate || 0}</span></div><button class="btn alt sm" data-act="auf_back">${_t('Zurück')}</button></div></div>
  <div class="tabs" role="tablist">${tab('auf', _t('AUFTRÄGE'), n)}${tab('ruf', _t('FRAKTIONEN'))}${tab('qm', _t('TAUSCH'))}</div>${body}`, true);
}
// Belohnung zeigen: Beute nacheinander, Ruf-Balken füllt sich, neuer Rang groß
function aufRevShow() {
  const r = AUF.rev, one = r.qs.length === 1;
  const fk = Object.keys(r.fk).map(f => { const F = FK[f], x = r.fk[f], p = fkProg(f), up = p.r > x.r0; return `<div class="aqrp" style="--c:${F.c}"><img src="${fkIc(f)}" alt=""><div><b>${esc(F.n).toLocaleUpperCase(LOCALE)}</b><div class="fkbar"><i style="--a:${(x.p0 * 100).toFixed(1)}%;--b:${up ? 100 : (p.p * 100).toFixed(1)}%"></i><span>${_t('+{n} Ruf', { n: x.rep })}</span></div></div><span class="fktok">+${x.tok}<img src="${fkTokIc(f)}" alt="${_t('Ruf-Marken')}"></span></div>`; }).join('');
  const up = r.up.map(u => { const F = FK[u.f], R = fkRanks(u.f)[u.r]; return `<div class="aqup" style="--c:${F.c}"><b>${_t('NEUER RANG!')}</b><div class="nm">${esc(F.n)}: ${esc(R.n)}</div><p>${esc(R.d)}</p></div>`; }).join('');
  showOverlay(`<div class="aqrev"><h2>${one ? _t('AUFTRAG ERFÜLLT!') : _t('{n} AUFTRÄGE ERFÜLLT!', { n: r.qs.length })}</h2><p class="sub">${one ? esc(aufText(r.qs[0])) : _t('Alle Belohnungen auf einen Blick:')}</p>
  <div class="aqgot">${r.got.map(rwRow).join('')}</div>${fk}${up}<div class="menu" style="max-width:520px;margin:10px auto 0"><button class="btn" data-act="auf_ok">${_t('Weiter')}</button></div></div>`, true);
}
function aufOpen(from) {
  if (!P || (typeof landeActive === 'function' && landeActive())) return;
  if (from) AUF.from = from;
  setState('menu'); showHud(false);   // auch von der Karte: sonst baut Drehen des Handys die Karte neu auf
  AUF.rev = null; AUF.tab = 'auf'; AUF.fk = null; AUF.op = from === 'hide' ? performance.now() : 0;
  // Geister-Tipp: der Finger auf dem Interagieren-Knopf im Versteck darf nicht gleich etwas auf der Tafel antippen
  if (!AUF.guard) { AUF.guard = 1; panel.addEventListener('click', e => { if (performance.now() - AUF.op < 350 && panel.querySelector('[data-act^="auf_"]')) { e.stopImmediatePropagation(); e.preventDefault(); } }, true); }
  aufSet(); sfx('page'); aufShow();
}
function aufClose() { AUF.rev = null; if (AUF.from === 'map') { setState('map'); showMapMore(); } else backToHide(); }
function aufSay(t, ok) { toast(t, ok ? '#79c24e' : '#ff6a5a'); sfx(ok ? 'buy' : 'deny'); }
ON.auf_open = id => aufOpen(id || 'map');
ON.auf_back = () => { sfx('click'); aufClose(); };
ON.auf_tab = id => { AUF.tab = id; sfx('click'); aufShow(); panel.scrollTop = 0; };
ON.auf_claim = (id, b, i) => {
  const r = aufClaim(id, id === 'all' ? 'all' : i);
  if (!r.ok) { aufSay(r.err === 'lande' ? _t('Nicht mitten in den Endlosen Landen.') : _t('Das hat nicht geklappt.')); aufShow(); return; }
  AUF.rev = r; sfx('loot'); if (r.up.length) setTimeout(() => sfx('lvl'), 1200); aufShow(); panel.scrollTop = 0;
};
ON.auf_ok = () => { AUF.rev = null; sfx('click'); aufShow(); };
ON.auf_rr = (id, b, i) => { if (aufReroll(i)) { sfx('page'); toast(_t('Neuer Auftrag: {q}', { q: aufText(aufSet().dq[i]) }), '#ffd24a'); } else sfx('deny'); aufShow(); };
ON.auf_fk = id => { AUF.fk = id || null; sfx('click'); aufShow(); };
ON.auf_qm = id => { AUF.qf = FK[id] ? id : AUF.qf; AUF.tab = 'qm'; sfx('click'); aufShow(); panel.scrollTop = 0; };
ON.auf_qf = id => { if (FK[id]) AUF.qf = id; sfx('click'); aufShow(); };
ON.auf_buy = id => { const r = fkBuy(AUF.qf, id); if (r.ok) { aufSay(_t('Getauscht: {item}', { item: r.e.t === 'item' ? itemName(r.e.it) : rwName(r.e) }), true); if (r.e.t === 'title') sfx('ach'); } else aufSay(fkErr(r)); aufShow(); };
ON.auf_ttl = id => { const M = fkM(); if (M && (!id || M.tt.includes(id))) { M.t = id || ''; persist(); sfx('click'); } aufShow(); };

/* ---------- Versteck: Station, Bild, Karte ---------- */
BUILD.auftrag = { n: _t('Auftragstafel'), icon: 'tafel', fixed: 1, d0: _t('Tages- und Wochenaufträge, Ruf bei den Fraktionen und ihre Tauschangebote.') };
BUILDORDER.push('auftrag');
// zwischen Bibliothek und Lagerfeuer, in der Reihe von Sattlerei und Vogelhaus: die Kamera zeigt sie mittig – nie unter den Touch-Knöpfen
HIDE_POS.auftrag = [.5, .36];
HOOK.station.push((h, id) => { if (h || id !== 'auftrag') return h; aufOpen('hide'); return true; });
HOOK.mapMore.push(() => { if (!P) return ''; const n = aufReady(); return `<button class="btn alt" data-act="auf_open" data-id="map">${_t('Aufträge & Ruf')}${n ? `<span class="badge">${n}</span>` : ''}</button>`; });
// Holztafel unter einem Dach, Zettel mit Siegeln der Fraktionen; ist etwas abzuholen, leuchten die Zettel und ein goldenes „!“ schwebt darüber
HOOK.drawStation.push((o, x, y, r) => {
  if (o.id !== 'auftrag') return;
  const D = '#1a1420', n = aufReady(), f = Math.floor(T * 3);
  r(-15, -31, 4, 32, D); r(11, -31, 4, 32, D); r(-14, -30, 2, 31, WOOD[0]); r(12, -30, 2, 31, WOOD[0]); r(-13, -30, 1, 31, WOOD[1]); r(13, -30, 1, 31, WOOD[1]);
  r(-14, -29, 28, 21, D); r(-13, -28, 26, 19, WOOD[1]); r(-13, -28, 26, 1, WOOD[2]); r(-13, -10, 26, 1, WOOD[0]);
  r(-19, -36, 38, 5, D); r(-18, -35, 36, 3, '#7a2a22'); r(-18, -35, 36, 1, '#a83a2c'); r(-15, -38, 30, 3, D); r(-14, -37, 28, 2, '#8a3226');
  const P_ = [[-11, -26, 7, 8, '#ffd24a'], [-2, -27, 6, 7, '#57c7e6'], [6, -25, 6, 9, '#ffb03a'], [-9, -16, 7, 5, '#79c24e'], [0, -18, 6, 6, '#efe2bf']];
  for (const [px_, py, w, hh, sc] of P_) { r(px_, py, w, hh, n ? '#fff3c0' : '#efe2bf'); r(px_ + 1, py + 2, w - 2, 1, '#a8997e'); if (hh > 5) r(px_ + 1, py + 4, w - 3, 1, '#a8997e'); r(px_ + (w >> 1), py, 1, 1, '#c8342c'); r(px_ + w - 2, py + hh - 2, 2, 2, sc); }
  r(-17, -1, 34, 2, '#3a3440');
  if (n) { addLight(x, y - 20, 34, .55 + .1 * Math.sin(T * 4)); if (!(G && G.near && G.near.act === 'auftrag')) { const b = Math.round(Math.sin(T * 4) * 1.5), ex = -15; r(ex - 2, -50 + b, 5, 8, D); r(ex - 2, -41 + b, 5, 4, D); r(ex - 1, -49 + b, 3, 6, '#ffd24a'); r(ex - 1, -40 + b, 3, 2, '#ffd24a'); r(ex - 1, -49 + b, 1, 6, '#fff3c0'); addLight(x + ex, y - 44, 18, .6); } if (f % 4 === 0 && Math.random() < .3) part(o.x + rnd(-10, 10), o.y, rnd(10, 26), 0, 0, rnd(8, 18), '#ffe08a', .6, 1, -6, 1); }
});
HOOK.artIcon.push((name, b) => {
  if (name !== 'tafel') return;
  b.rect(2, 3, 2, 12, WOOD[0]); b.rect(12, 3, 2, 12, WOOD[0]); b.rect(1, 1, 14, 2, '#a83a2c'); b.rect(3, 4, 10, 8, WOOD[1]); b.rect(3, 4, 10, 1, WOOD[2]);
  b.rect(4, 5, 3, 4, '#efe2bf'); b.rect(8, 5, 4, 3, '#efe2bf'); b.rect(6, 9, 4, 2, '#efe2bf'); b.set(5, 5, '#c8342c'); b.set(10, 5, '#c8342c'); b.set(11, 7, '#57c7e6'); b.set(9, 10, '#79c24e'); b.set(4, 8, '#ffd24a');
});

/* ---------- Handbuch: Kapitel „Aufträge und Ruf“ ---------- */
if (typeof HB_BLD !== 'undefined') { HB_BLD.auftrag = () => _t('Hier hängen deine Tages- und Wochenaufträge. Abholen bringt Gold, Material und Ruf bei einer der vier Fraktionen – und Ruf-Marken für ihre Tauschangebote.'); HB_BLDGO.auftrag = 'auftraege'; }
if (typeof HBGO !== 'undefined') HBGO.auftraege = { l: () => _t('Zur Auftragstafel'), c: 'map hide', f: x => x === 'map' ? aufOpen('map') : openStation('auftrag') };
function hbAuf() {
  hbChap('auf', _t('Aufträge und Ruf'), ['pa', 'tafel'], _t('Tages- und Wochenaufträge, Fraktionen, Ruf-Marken'));
  const ex = (k, wk) => { const D = AUFDEF[k], lv = P ? P.lv : 10, n = aufTry(() => (wk ? D.w : D.d)(lv), 0); return n > 0 ? aufTry(() => D.t({ k, n, c: 0, x: D.x ? 'holz' : null }), '') : ''; };
  E('auf:auftraege', _t('Aufträge'), { ic: ['pa', 'tafel'], kw: 'auftrag aufträge quest täglich wöchentlich tagesauftrag wochenauftrag neu würfeln belohnung auftragstafel', see: ['auf:arten', 'auf:ruf', 'auf:marken', 'bld:auftrag'], go: ['auftraege'],
    s: _t('Jeden Tag drei neue Aufträge, jede Woche drei größere – mit Gold, Material und Ruf als Belohnung.'),
    b: () => hUl([_t('Die Auftragstafel steht im Versteck zwischen Bibliothek und Lagerfeuer. Auf der Weltkarte findest du sie unter „Mehr“ → „Aufträge & Ruf“.'), _t('Tagesaufträge gibt es um Mitternacht neu, Wochenaufträge am Montag. Jeder Held hat seine eigenen.'), _t('Die Ziele wachsen mit deinem Level. Es kommen nur Aufträge, die du gerade schaffen kannst – die Endlosen Lande zum Beispiel erst ab Level 5.'), _t('Einmal am Tag darfst du einen Tagesauftrag gratis neu würfeln.'), _t('Ist ein Auftrag erfüllt, bekommst du sofort eine Meldung. Abholen musst du ihn an der Tafel. Erfüllte Aufträge verfallen nicht – sie warten unter „Noch abzuholen“.'), _t('Belohnung: Gold, manchmal Glücksmünzen, Material (auch Holz, Eisenholz, Marmor …), Bauteile, ab und zu ein Mod oder ein Ei – dazu Ruf und Ruf-Marken. Wochenaufträge bringen etwa fünfmal so viel.')]) });
  E('auf:arten', _t('Alle Auftragsarten'), { ic: ['pa', 'l_auftrag'], kw: 'auftragsarten liste gegner elite champion boss sammeln ernten basar schmieden eier', see: ['auf:auftraege'].concat(FKORDER.map(f => 'fk:' + f)),
    s: _t('Was eine Fraktion von dir will – Beispiele für dein Level.'),
    b: () => FKORDER.map(f => hH(esc(FK[f].n).toLocaleUpperCase(LOCALE)) + hRows(Object.keys(AUFDEF).filter(k => AUFDEF[k].f === f).map(k => { const d = ex(k, false), w = ex(k, true), t = d || w || aufTry(() => AUFDEF[k].t({ k, n: 2, c: 0, x: AUFDEF[k].x ? 'holz' : null }), k); return { ic: ['pa', 'fk_' + f], t: esc(t), d: d && w ? _t('Tag und Woche · Woche: {t}', { t: esc(w) }) : w ? _t('Wochenauftrag') : d ? _t('Tagesauftrag') : _t('für dich gerade noch nicht dabei') }; }))).join('')
      + hP(_t('Die Zahlen passen zu deinem Level – höhere Level bekommen größere Ziele und mehr Belohnung.')) });
  E('auf:ruf', _t('Fraktionen, Ruf und Ränge'), { ic: ['pa', 'fk_orden'], kw: 'fraktion ruf rang ränge vorteil orden kundschafter gilde wildnis', see: FKORDER.map(f => 'fk:' + f).concat(['auf:marken']),
    s: _t('Vier Fraktionen – jeder Auftrag bringt Ruf bei einer von ihnen.'),
    b: () => hRows(FKORDER.map(f => ({ id: 'fk:' + f, ic: ['pa', 'fk_' + f], t: esc(FK[f].n), d: _t('{n} Ränge · {s}', { n: fkRanks(f).length, s: esc(FK[f].s) }) })))
      + hUl([_t('Ruf bekommst du für Aufträge der Fraktion. Bei den Kundschaftern zählen auch Elwas Aufträge in den Landen.'), _t('Mit genug Ruf steigst du im Rang. Jeder Rang bringt einen kleinen, dauerhaften Vorteil – für alle deine Helden.'), _t('Ruf geht nie verloren.')]) });
  E('auf:marken', _t('Ruf-Marken und Quartiermeister'), { ic: ['pa', 'fkm_orden'], kw: 'ruf-marken marke marken token quartiermeister tausch tauschangebot woche', see: ['auf:ruf', 'auf:auftraege'], go: ['auftraege'],
    s: _t('Jede Fraktion zahlt mit eigenen Marken – getauscht wird an der Auftragstafel unter „TAUSCH“.'),
    b: () => hUl([_t('Für jeden Auftrag gibt es Ruf-Marken seiner Fraktion: 2 bis 3 für einen Tagesauftrag, 8 bis 10 für einen Wochenauftrag.'), _t('Jede Woche hat jede Fraktion fünf andere Tauschangebote. Bezahlt wird mit Ruf-Marken und etwas Gold.'), _t('Bessere Angebote gibt es erst ab einem bestimmten Rang: seltene Eier, Mods, seltene Rohstoffe, Leuchtfeuersteine, magische Vögel – und ganz oben ein Titel für deinen Helden.'), _t('Jedes Angebot gibt es nur ein paarmal pro Woche.')]) });
  for (const f of FKORDER) {
    const F = FK[f];
    E('fk:' + f, F.n, { ic: ['pa', 'fk_' + f], kw: 'fraktion ruf rang ' + F.who() + ' ' + Object.keys(AUFDEF).filter(k => AUFDEF[k].f === f).join(' '), see: ['auf:ruf', 'auf:marken', 'auf:arten'].concat(f === 'kund' ? ['lande:ruf'] : f === 'gilde' ? ['han:basar'] : f === 'wild' ? ['pet:pflege', 'ver:acker'] : ['en:tausend']), go: ['auftraege'], s: esc(F.s),
      b: () => hRows([{ ic: ['sp', F.sp], t: esc(F.who()), d: _t('spricht für die Fraktion.') }]) + hKv([[_t('DEIN RANG'), esc(fkRanks(f)[fkRank(f)].n)], [_t('RUF'), hbNum(fkRep(f))], [_t('RUF-MARKEN'), hbNum(fkTok(f))]])
        + hH(_t('RÄNGE UND VORTEILE')) + fkRanks(f).map((x, i) => `<div class="hblv"><b>${i <= fkRank(f) ? '✓ ' : ''}${_t('RANG {n}', { n: i + 1 })} · ${esc(x.n)}</b><i>${_t('ab {n} Ruf', { n: hbNum(x.at) })}</i><div>${esc(x.d)}</div></div>`).join('')
        + hH(_t('TAUSCHANGEBOTE (ABWECHSELND JE WOCHE)')) + hRows(FKQ[f].map(o => { const e = aufTry(() => o.e(mulberry(1), P ? P.lv : 10), null); return e ? { ic: () => rwIcon(e), t: esc(rwName(e)), d: _t('ab Rang {n} · {tok} Ruf-Marken', { n: o.r + 1, tok: o.tok }) + (o.g ? ' + ' + _t('{n} Gold', { n: hbNum(o.g) }) : ''), r: '' } : null; })) });
  }
}
if (typeof HB_BUILD !== 'undefined') HB_BUILD.push(['auf', hbAuf]);
