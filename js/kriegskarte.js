'use strict';
/* =========================================================
   KLINGENHORT – Krieg der Kronen, Kapitel 3 „Die Kriegskarte“ (6.9). Bauplan: docs/KRIEG-DER-KRONEN.md
   Hängt sich über HOOK/ON (js/core.js) an js/krieg.js.
   - 40 Provinzen auf einem Wabenfeld (KK_COLS × KK_ROWS), jede gehört einem Reich. Jedes Reich hat eine Festung (KK_FEST), die nie fällt –
     so verschwindet kein Reich, der Krieg endet nie. Zwei Provinzen in der Mitte liegen im Nebel des Schattenkonzils (gehören niemandem, 7.1).
   - Wandernde Fronten: alle KK_TICK Millisekunden ein Kriegstag. An jedem Kriegstag greifen Reiche an der Grenze an (fester Zufall je Tag,
     kleinere Reiche wehren sich besser). Läuft auch, wenn das Spiel zu ist – beim Öffnen werden bis zu KK_NACH Tage nachgerechnet.
   - Feldzug: Du wählst eine Grenz-Provinz und eine Seite (erobern oder halten). Jeder Sieg für diese Seite zählt, ein Sieg gegen sie zieht einen ab.
     Nach KK_FZ Siegen wechselt die Provinz (erobern) oder wird befestigt (halten: KK_BEF Tage sicher). Schlachten direkt von der Karte
     (Raum 'krieg' mit extra.fz) oder in den Kriegsgebieten der Weltkarte – die zeigen jetzt echte Grenzen der Kriegskarte (kkFront).
   - Kriegsjahre: alle KK_JAHR Kriegstage beginnt ein neues Jahr (endlos).
   Spielstand: SAVE.meta.krieg.karte = { v, o: [Reich je Provinz, '' = Nebel], t: letzter Kriegstag (absolut), tag: Kriegstage seit Beginn,
     fz: null | { p, s (Seite), f (Gegner), n (Siege), auf (1 = erobern) }, fest: { Provinz: bis Tag }, log: [{ d, k, a, b, p, n }], nb: Provinzen, die
     seit dem letzten Blick den Besitzer gewechselt haben }
   Schnittstelle: kkKarte(), kkTick(), kkFront(reihe), kkSchlacht(sieg), kkOpen(von), KK_NAMEN, KK_FEST
   ========================================================= */

const KK_COLS = 8, KK_ROWS = 5, KK_N = KK_COLS * KK_ROWS;
const KK_TICK = 3 * 3600 * 1000;   // ein Kriegstag = 3 Stunden
const KK_NACH = 56;                // höchstens so viele Kriegstage nachrechnen (eine Woche)
const KK_FZ = 3, KK_BEF = 8, KK_JAHR = 30, KK_SEED = 690069;
// Startaufteilung: Nordmark oben links, Aurelien oben rechts, Sylvara unten links, Karth unten rechts, Nebel in der Mitte
const KK_START = (() => {
  const o = [];
  for (let r = 0; r < KK_ROWS; r++) for (let c = 0; c < KK_COLS; c++) {
    let k = r < 2 ? (c < 4 ? 'nordmark' : 'aurelien') : r > 2 ? (c < 4 ? 'sylvara' : 'karth') : ['nordmark', 'sylvara', 'sylvara', '', '', 'karth', 'karth', 'aurelien'][c];
    o.push(k);
  }
  return o;
})();
const KK_FEST = { nordmark: 1, aurelien: 6, sylvara: 33, karth: 38 };   // Festungen (Provinz-Nummer = Reihe · 8 + Spalte)
const KK_IST_FEST = p => Object.values(KK_FEST).includes(p);
// Namen in Lesereihenfolge je Reich (die Festung ist die mit dem Turm)
const KK_NAMEN = (() => {
  const L = {
    nordmark: [_t('Graufjord'), _t('Hroalds Halle'), _t('Wolfsgrat'), _t('Schneewacht'), _t('Eisfurt'), _t('Runenstein'), _t('Bärenpass'), _t('Kaltenbruch'), _t('Weißmoor')],
    aurelien: [_t('Morgentor'), _t('Glockenhain'), _t('Sonnenburg'), _t('Goldwacht'), _t('Lichtenau'), _t('Ährental'), _t('Löwenfurt'), _t('Weißenstein'), _t('Sonnenfeld')],
    sylvara: [_t('Nebelau'), _t('Farnsenke'), _t('Moosgrund'), _t('Eibenhain'), _t('Silberquell'), _t('Dornenthron'), _t('Wurzeltiefe'), _t('Schlehenhag'), _t('Mistelgrund'), _t('Dornwald')],
    karth: [_t('Glutfurt'), _t('Rußgrat'), _t('Aschenbruch'), _t('Glutkessel'), _t('Schlackenfeld'), _t('Brandwall'), _t('Schwarzschmiede'), _t('Kohlental'), _t('Funkenstadt'), _t('Eisenesse')],
    '': [_t('Hohler Grund'), _t('Schattenmark')]
  }, i = {}, n = [];
  for (let p = 0; p < KK_N; p++) { const k = KK_START[p]; i[k] = i[k] || 0; n.push(L[k][i[k]++]); }
  return n;
})();
// Nachbarn im Wabenfeld (ungerade Reihen sind um eine halbe Wabe nach rechts versetzt)
const KK_NB = (() => {
  const A = [];
  for (let r = 0; r < KK_ROWS; r++) for (let c = 0; c < KK_COLS; c++) {
    const s = r % 2 ? [0, 1] : [-1, 0], L = [[r, c - 1], [r, c + 1], [r - 1, c + s[0]], [r - 1, c + s[1]], [r + 1, c + s[0]], [r + 1, c + s[1]]];
    A.push(L.filter(([y, x]) => y >= 0 && y < KK_ROWS && x >= 0 && x < KK_COLS).map(([y, x]) => y * KK_COLS + x));
  }
  return A;
})();
const kkJetzt = () => Math.floor(Date.now() / KK_TICK);

/* ---------- Spielstand ---------- */
function kkDef() { return { v: 1, o: KK_START.slice(), t: kkJetzt(), tag: 0, fz: null, fest: {}, log: [], nb: [] }; }
function kkFix(d) {
  const o = kkDef(), num = (v, max) => clamp(Math.floor(+v) || 0, 0, max);
  if (!d || typeof d !== 'object') return o;
  if (Array.isArray(d.o) && d.o.length === KK_N) o.o = d.o.map((k, p) => KK_START[p] === '' ? '' : KK_IST_FEST(p) ? KK_START[p] : KR_AKTIV.includes(k) ? k : KK_START[p]);
  if (d.t > 0) o.t = Math.min(num(d.t, 1e9), kkJetzt()); o.tag = num(d.tag, 1e7);
  const f = d.fz; if (f && typeof f === 'object' && f.p >= 0 && f.p < KK_N && !KK_IST_FEST(+f.p) && KK_START[+f.p] && KR_AKTIV.includes(f.s) && KR_AKTIV.includes(f.f) && f.s !== f.f) o.fz = { p: num(f.p, KK_N - 1), s: f.s, f: f.f, n: num(f.n, KK_FZ - 1), auf: f.auf ? 1 : 0 };
  if (d.fest && typeof d.fest === 'object') for (const k in d.fest) if (+k >= 0 && +k < KK_N) o.fest[+k] = num(d.fest[k], 1e7);
  if (Array.isArray(d.log)) o.log = d.log.filter(e => e && typeof e === 'object' && /^(nimmt|du|duh|jahr)$/.test(e.k)).slice(-12).map(e => ({ d: num(e.d, 1e7), k: e.k, a: REICHE[e.a] ? e.a : '', b: REICHE[e.b] ? e.b : '', p: num(e.p, KK_N - 1), n: num(e.n, 1e6) }));
  if (Array.isArray(d.nb)) o.nb = d.nb.filter(p => p >= 0 && p < KK_N).slice(0, KK_N).map(p => num(p, KK_N - 1));
  // Feldzug ungültig geworden (Provinz gehört schon der Seite, die sie erobern wollte)?
  if (o.fz && (o.fz.auf ? o.o[o.fz.p] !== o.fz.f : o.o[o.fz.p] !== o.fz.s)) o.fz = null;
  return o;
}
HOOK.meta.push(m => { try { if (m.krieg) m.krieg.karte = kkFix(m.krieg.karte); } catch (e) { if (m.krieg) m.krieg.karte = kkDef(); } });
function kkKarte() { const M = krM(); if (!M.karte || !Array.isArray(M.karte.o)) M.karte = kkDef(); return M.karte; }
const kkZahl = (K, r) => K.o.reduce((n, k) => n + (k === r ? 1 : 0), 0);
function kkLog(K, e) { K.log.push(Object.assign({ d: K.tag, a: '', b: '', p: 0, n: 0 }, e)); if (K.log.length > 12) K.log.splice(0, K.log.length - 12); }

/* ---------- Wandernde Fronten ---------- */
// Grenzen: [Provinz, Angreifer] – Provinz gehört einem Reich, ein Nachbar einem anderen; Festungen, Nebel und befestigte Provinzen nie
function kkGrenzen(K) {
  const L = [];
  for (let p = 0; p < KK_N; p++) {
    const a = K.o[p]; if (!a || KK_IST_FEST(p) || (K.fest[p] || 0) > K.tag) continue;
    const seen = {}; for (const q of KK_NB[p]) { const b = K.o[q]; if (b && b !== a && !seen[b]) { seen[b] = 1; L.push([p, b]); } }
  }
  return L;
}
// Ein Kriegstag: zwei Angriffe an der Grenze (fester Zufall je Tag – für alle gleich gewürfelt). Kleinere Reiche wehren sich besser.
function kkTag(K, abs) {
  const R = mulberry(KK_SEED + abs * 7919);
  K.tag++;
  if (K.tag % KK_JAHR === 0) kkLog(K, { k: 'jahr', n: K.tag / KK_JAHR + 1 });
  for (let j = 0; j < 2; j++) {
    const L = kkGrenzen(K).filter(([p]) => !K.fz || p !== K.fz.p); if (!L.length) return;
    const [p, b] = L[Math.floor(R() * L.length)], a = K.o[p], na = kkZahl(K, a), nb = kkZahl(K, b);
    if (R() < .9 * na / (na + nb)) { K.o[p] = b; kkLog(K, { k: 'nimmt', a: b, b: a, p }); if (!K.nb.includes(p)) K.nb.push(p); }
  }
}
// Nachrechnen bis jetzt (höchstens KK_NACH Tage; was darüber liegt, verfällt) → Zahl der gerechneten Tage
function kkTick() {
  const K = kkKarte(), now = kkJetzt(); if (now <= K.t) { K.t = Math.min(K.t, now); return 0; }
  const n = Math.min(now - K.t, KK_NACH); for (let i = n; i >= 1; i--) kkTag(K, now - i + 1);
  K.t = now; return n;
}
const kkJahr = K => 1 + Math.floor(K.tag / KK_JAHR);

/* ---------- Fronten für die Kriegsgebiete der Weltkarte ---------- */
// Läuft ein Feldzug: dessen Front. Sonst eine echte Grenze der Kriegskarte (fest je Held, Akt und Reihe, solange sich die Grenzen nicht ändern).
function kkFront(row) {
  if (!SAVE || !SAVE.meta.krieg) return null;
  const K = kkKarte(); if (K.fz) return [K.fz.s, K.fz.f];
  const pairs = []; for (const [p, b] of kkGrenzen(K)) { const a = K.o[p], f = REICH_ORDER.indexOf(a) < REICH_ORDER.indexOf(b) ? [a, b] : [b, a]; if (!pairs.some(x => x[0] === f[0] && x[1] === f[1])) pairs.push(f); }
  if (!pairs.length) return null;
  pairs.sort((x, y) => (REICH_ORDER.indexOf(x[0]) * 9 + REICH_ORDER.indexOf(x[1])) - (REICH_ORDER.indexOf(y[0]) * 9 + REICH_ORDER.indexOf(y[1])));
  return pairs[((P ? P.act : 3) * 2 + (row >= 3 ? 1 : 0) + (P ? Math.floor(P.created / 1000) % 7 : 0)) % pairs.length];
}

/* ---------- Feldzug ---------- */
function kkLohn() { const st = stageNum(); return { gold: Math.round((12 + st * 9) * 6 * (1 + (P ? P.st.gold : 0))), ruf: 60, mk: 6 }; }
// nach jeder Schlacht (aus krEnd): Fortschritt des Feldzugs → Text für den Ergebnis-Bildschirm oder null
function kkSchlacht(win) {
  const K = kkKarte(), F = K.fz; if (!F || !win) return null;
  if (KR.side === F.s) F.n++; else if (KR.foe === F.s) F.n = Math.max(0, F.n - 1); else return null;
  const name = KK_NAMEN[F.p], S = REICHE[F.s];
  if (F.n < KK_FZ) return { n: F.n, t: KR.side === F.s ? _t('Feldzug {p}: {n} von {m} Siegen für {reich}.', { p: name, n: F.n, m: KK_FZ, reich: S.n }) : _t('Feldzug {p}: Du hast gegen {reich} gekämpft – ein Sieg weniger ({n} von {m}).', { p: name, n: F.n, m: KK_FZ, reich: S.n }) };
  const L = kkLohn(); P.gold += L.gold; stat('goldTotal', L.gold); krGain(F.s, L.ruf, L.mk); stat('kkFz');
  if (F.auf) { K.o[F.p] = F.s; kkLog(K, { k: 'du', a: F.s, b: F.f, p: F.p }); } else { K.fest[F.p] = K.tag + KK_BEF; kkLog(K, { k: 'duh', a: F.s, b: F.f, p: F.p }); }
  K.fz = null;
  return { n: KK_FZ, done: 1, t: (F.auf ? _t('Feldzug gewonnen: {reich} erobert {p}!', { reich: S.n, p: name }) : _t('Feldzug gewonnen: {reich} hält {p} – die Provinz ist {n} Kriegstage befestigt.', { reich: S.n, p: name, n: KK_BEF })) + ' ' + _t('Lohn: {g} Gold, +{r} Kriegsruf, +{m} {marken}.', { g: fmt(L.gold), r: L.ruf, m: L.mk, marken: S.mk }) };
}
// Feldzug beginnen: id = 'provinz:seite:auf'
ON.kk_fz = id => {
  const [p, s, auf] = String(id).split(':'), K = kkKarte(), pp = +p, a = K.o[pp];
  if (!(pp >= 0 && pp < KK_N) || !a || KK_IST_FEST(pp) || !KR_AKTIV.includes(s)) { sfx('deny'); return; }
  const f = auf === '1' ? a : KK_NB[pp].map(q => K.o[q]).find(b => b && b !== a);
  if (!f || f === s || (auf === '1' ? !KK_NB[pp].some(q => K.o[q] === s) : a !== s)) { sfx('deny'); return; }
  K.fz = { p: pp, s, f, n: 0, auf: auf === '1' ? 1 : 0 }; KKV.sel = pp; sfx('spec'); persist(); kkOpen();
};
ON.kk_ab = () => { kkKarte().fz = null; sfx('click'); persist(); kkOpen(); };
// Schlacht direkt von der Kriegskarte (zählt für den Feldzug, ohne einen Ort der Weltkarte zu verbrauchen)
ON.kk_los = () => {
  const K = kkKarte(), F = K.fz; if (!F || !kriegOffen()) { sfx('deny'); return; }
  const go = () => { sfx('spec'); KR.row = 3; startRoom('krieg', 3, { krSeite: F.s, krFeind: F.f, fz: 1 }); };
  const M = krM(); if (!M.pro) { M.pro = 1; persist(); setState('menu'); dialog(krProlog(), go, _t('Chronik der Kronen · Prolog')); return; }
  go();
};

/* ---------- Bildschirm ---------- */
const KKV = { sel: -1, von: 'map' };
document.head.insertAdjacentHTML('beforeend', `<style>
.kkmap{position:relative;display:grid;grid-template-columns:repeat(${KK_COLS * 2 + 1},minmax(0,1fr));gap:3px 0;margin:8px 0;max-width:560px;margin-inline:auto}
.kkp{position:relative;grid-column:span 2;min-height:44px;margin:0 1.5px;padding:0;border:0;background:var(--c);color:#120e18;cursor:pointer;clip-path:polygon(50% 0,100% 22%,100% 78%,50% 100%,0 78%,0 22%);display:grid;place-items:center;font-family:var(--f-display);font-size:8px}
.kkp.nebel{background:repeating-linear-gradient(45deg,#2a2038 0 4px,#3a2c52 4px 8px);color:#a070f0;cursor:default}
.kkp.sel{outline:none;filter:brightness(1.25);box-shadow:inset 0 0 0 4px #fff}.kkp.neu{animation:kkneu 1s steps(2) 3}
.kkp.ziel::after{content:'';position:absolute;inset:6px;border:3px dashed #120e18;clip-path:inherit}
.kkp img{width:22px;height:22px;image-rendering:pixelated}.kkp .bef{position:absolute;bottom:4px;font-size:7px}
@keyframes kkneu{50%{filter:brightness(1.8)}}
.kkleg{display:flex;flex-wrap:wrap;gap:4px 10px;justify-content:center;font-size:16px}.kkleg span{display:inline-flex;gap:4px;align-items:center}.kkleg i{width:12px;height:12px;background:var(--c);display:inline-block}
.kklog{font-size:16px;line-height:1.2;color:var(--parch-dim);margin:0;padding-left:18px}
.kkfz{background:var(--night);padding:8px 10px;box-shadow:inset 3px 0 0 var(--c);font-size:17px;line-height:1.15;margin:8px 0}.kkfz b{display:block;font-family:var(--f-display);font-weight:400;font-size:8px;color:var(--c);margin-bottom:4px}
</style>`);
function kkLogTxt(e) {
  const a = REICHE[e.a] ? REICHE[e.a].n : '', b = REICHE[e.b] ? REICHE[e.b].n : '', p = KK_NAMEN[e.p];
  if (e.k === 'jahr') return _t('Tag {d}: Kriegsjahr {n} beginnt.', { d: e.d, n: e.n });
  if (e.k === 'du') return _t('Tag {d}: Dein Feldzug – {a} erobert {p} von {b}.', { d: e.d, a, b, p });
  if (e.k === 'duh') return _t('Tag {d}: Dein Feldzug – {a} hält {p} gegen {b}.', { d: e.d, a, b, p });
  return _t('Tag {d}: {a} nimmt {p} von {b}.', { d: e.d, a, b, p });
}
function kkOpen(von) {
  if (von) KKV.von = von; setState('menu');
  const n = kkTick(), K = kkKarte(), neu = K.nb.slice(); K.nb = []; persist();
  if (n > 0 && neu.length) toast(neu.length === 1 ? _t('Seit deinem letzten Blick hat 1 Provinz den Besitzer gewechselt.') : _t('Seit deinem letzten Blick haben {n} Provinzen den Besitzer gewechselt.', { n: neu.length }));
  const F = K.fz, gr = kkGrenzen(K), offen = kriegOffen();
  let map = '';
  for (let p = 0; p < KK_N; p++) {
    const r = Math.floor(p / KK_COLS), c = p % KK_COLS, k = K.o[p], R = REICHE[k], col = c * 2 + 1 + (r % 2);
    map += k ? `<button class="kkp${KKV.sel === p ? ' sel' : ''}${neu.includes(p) ? ' neu' : ''}${F && F.p === p ? ' ziel' : ''}" style="--c:${R.c};grid-column:${col} / span 2;grid-row:${r + 1}" data-act="kk_sel" data-id="${p}" aria-label="${esc(KK_NAMEN[p])}">${KK_IST_FEST(p) ? `<img src="${iconURL(['pa', 'kr_w_' + k])}" alt="">` : ''}${(K.fest[p] || 0) > K.tag ? '<span class="bef">■</span>' : ''}</button>`
      : `<button class="kkp nebel" style="grid-column:${col} / span 2;grid-row:${r + 1}" data-act="kk_sel" data-id="${p}" aria-label="${esc(KK_NAMEN[p])}">?</button>`;
  }
  const leg = KR_AKTIV.map(k => `<span style="--c:${REICHE[k].c}"><i></i>${esc(REICHE[k].n)} ${kkZahl(K, k)}</span>`).join('') + `<span style="--c:#3a2c52"><i></i>${_t('Nebel')}</span>`;
  // Feldzug
  let fz = '';
  if (F) { const S = REICHE[F.s]; fz = `<div class="kkfz" style="--c:${S.c}"><b>${_t('DEIN FELDZUG')} · ${esc(KK_NAMEN[F.p]).toLocaleUpperCase(LOCALE)}</b>${F.auf ? _t('{reich} will {p} von {feind} erobern.', { reich: esc(S.n), p: esc(KK_NAMEN[F.p]), feind: esc(REICHE[F.f].n) }) : _t('{reich} will {p} gegen {feind} halten.', { reich: esc(S.n), p: esc(KK_NAMEN[F.p]), feind: esc(REICHE[F.f].n) })} ${_t('Siege: {n} von {m}.', { n: F.n, m: KK_FZ })}
    <div class="krks"><button class="btn" data-act="kk_los"${offen ? '' : ' disabled'}>${_t('Zur Schlacht')}</button><button class="btn alt" data-act="kk_ab">${_t('Feldzug abbrechen')}</button></div>${offen ? '' : `<div class="st">${_t('Schlachten gibt es ab Akt 3.')}</div>`}</div>`; }
  // gewählte Provinz
  let det = `<p class="sub" style="margin:4px 0">${_t('Tippe auf eine Provinz.')}</p>`;
  const p = KKV.sel;
  if (p >= 0 && p < KK_N) {
    const k = K.o[p], R = REICHE[k];
    if (!k) det = `<div class="kkfz" style="--c:#a070f0"><b>${esc(KK_NAMEN[p]).toLocaleUpperCase(LOCALE)}</b>${_t('Im Nebel. Niemand weiß, wer hier herrscht – und niemand, der hineinging, hat es erzählt.')}</div>`;
    else {
      const feinde = gr.filter(g => g[0] === p).map(g => g[1]), bef = (K.fest[p] || 0) > K.tag;
      let txt = KK_IST_FEST(p) ? _t('Festung von {reich}. Sie fällt nie – solange sie steht, gibt dieses Reich nicht auf.', { reich: esc(R.n) })
        : bef ? _t('Befestigt: noch {n} Kriegstage sicher.', { n: K.fest[p] - K.tag }) : feinde.length ? _t('Grenzt an: {list}.', { list: feinde.map(f => esc(REICHE[f].n)).join(', ') }) : _t('Hinterland – hier wird gerade nicht gekämpft.');
      const bt = !F && feinde.length ? feinde.map(f => `<button class="btn" data-act="kk_fz" data-id="${p}:${f}:1" style="--c:${REICHE[f].c}">${_t('Für {reich} erobern', { reich: esc(REICHE[f].n) })}</button>`).join('') + `<button class="btn alt" data-act="kk_fz" data-id="${p}:${k}:0">${_t('Für {reich} halten', { reich: esc(R.n) })}</button>` : '';
      det = `<div class="kkfz" style="--c:${R.c}"><b>${esc(KK_NAMEN[p]).toLocaleUpperCase(LOCALE)} · ${esc(R.n).toLocaleUpperCase(LOCALE)}</b>${txt}${bt ? `<div class="st" style="margin-top:4px">${_t('Feldzug: {n} Siege für eine Seite – dann wechselt die Provinz oder wird befestigt.', { n: KK_FZ })}</div><div class="krks">${bt}</div>` : F && feinde.length ? `<div class="st" style="margin-top:4px">${_t('Du führst schon einen Feldzug.')}</div>` : ''}</div>`;
    }
  }
  const log = K.log.slice(-6).reverse().map(e => `<li>${esc(kkLogTxt(e))}</li>`).join('');
  showOverlay(`<div class="head"><h2>${_t('KRIEGSKARTE')}</h2><div class="hbtns"><button class="btn alt sm" data-act="kk_zu">${_t('Zurück')}</button></div></div>
  <p class="sub" style="margin:0">${_t('Kriegsjahr {j} · Tag {t}', { j: kkJahr(K), t: K.tag % KK_JAHR + 1 })} · ${_t('Alle drei Stunden ein Kriegstag – die Fronten wandern auch, wenn du nicht spielst.')}</p>
  ${fz}<div class="kkmap">${map}</div><div class="kkleg">${leg}</div>${det}
  ${log ? `<h3>${_t('KRIEGSBERICHT')}</h3><ul class="kklog">${log}</ul>` : ''}`, true);
}
ON.kk_sel = id => { KKV.sel = +id; sfx('click'); kkOpen(); };
ON.kk_open = id => { sfx('click'); kkOpen(id || 'map'); };
ON.kk_zu = () => { if (KKV.von === 'chr') kriegChronik(); else if (KKV.von === 'hb' && typeof hbOpen === 'function') hbOpen(); else openMap(); };
HOOK.mapMore.push(() => SAVE && P && kriegOffen() ? `<button class="btn alt" data-act="kk_open" data-id="map">${_t('Kriegskarte')}${kkKarte().fz ? ' · ' + kkKarte().fz.n + '/' + KK_FZ : ''}</button>` : '');

/* ---------- Handbuch ---------- */
if (typeof HBGO !== 'undefined') HBGO.kkarte = { l: () => _t('Zur Kriegskarte'), c: 'map', f: () => kkOpen('hb') };
function hbKarte() {
  HB.chap = 'krieg';
  E('krieg:karte', _t('Die Kriegskarte'), { ic: ['pa', 'kr_w_karth'], kw: 'kriegskarte karte provinz provinzen grenze front fronten feldzug erobern halten befestigt festung kriegstag kriegsjahr offline nebel', see: ['krieg:gebiete', 'krieg:reiche'], go: ['kkarte'],
    s: _t('Vierzig Provinzen, vier Reiche – und die Grenzen wandern, auch wenn du nicht spielst.'),
    b: () => hUl([_t('Jede Provinz gehört einem Reich. Alle drei Stunden ist ein Kriegstag: An den Grenzen greifen die Reiche an und nehmen sich Provinzen. Kleine Reiche wehren sich besser.'), _t('Jedes Reich hat eine Festung, die nie fällt – kein Reich verschwindet, der Krieg endet nie. Alle {n} Kriegstage beginnt ein neues Kriegsjahr.', { n: KK_JAHR }), _t('In der Mitte liegt der Nebel. Niemand weiß, wem er gehört.')])
      + hH(_t('FELDZUG')) + hUl([_t('Tippe eine Provinz an der Grenze an und wähle: für ein Reich erobern oder für den Besitzer halten.'), _t('Jeder Sieg für deine Seite zählt – direkt von der Kriegskarte („Zur Schlacht“) oder in den Kriegsgebieten der Weltkarte. Ein Sieg gegen deine Seite zieht einen ab.'), _t('Nach {n} Siegen gehört die Provinz deiner Seite – oder sie ist {b} Kriegstage befestigt. Dazu gibt es Gold, Kriegsruf und Marken.', { n: KK_FZ, b: KK_BEF }), _t('Die Kriegsgebiete der Weltkarte liegen an echten Grenzen der Kriegskarte. Während eines Feldzugs zeigen sie dessen Front.')]) });
}
if (typeof HB_BUILD !== 'undefined') HB_BUILD.push(['krieg2', hbKarte]);
