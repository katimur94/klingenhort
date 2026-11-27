'use strict';
/* =========================================================
   KLINGENHORT – Krieg der Kronen, Kapitel 1 „Die Front“ (6.6) und Kapitel 2 „Fünf Kronen“ (6.8). Kapitel 3 „Die Kriegskarte“ (6.9) in js/kriegskarte.js. Bauplan: docs/KRIEG-DER-KRONEN.md
   Hängt sich über HOOK/ON (js/core.js) ein.
   - Kriegsgebiet: Raumart 'krieg' auf der Weltkarte ab Akt 3 (kriegMap) und drei Kriegs-Biome in den Endlosen Landen (KR_LANDE, js/lande.js).
   - Zwei Heere kämpfen wirklich: Soldaten sind Gegner mit KI 'krieg' (EN.kr_*, js/data.js) – feindliche stehen in enemies (alle Waffen und
     Fähigkeiten treffen sie), verbündete in KR.al. Eine KI für alle (krAI): nächstes Ziel der Gegenseite, Nahkampf, Schütze, Magier.
     Soldaten, die von Soldaten oder Beschuss fallen, bringen weder Erfahrung noch Beute. Obergrenze KR_CAP Soldaten auf dem Feld.
   - Beschuss (krShot): Pfeilhagel, Katapult, Magiehagel (Meteore, brennender Boden), dazu Flammenring und Sturmbahn der Hauptleute.
     Immer angekündigt (mindestens KR_WARN_MIN Sekunden sichtbar), Treffer nur innerhalb der gezeichneten Fläche. KR.log merkt sich Treffer (Tests).
   - Deckung (krCover): hinter Schildwall und Wagen und im Graben – Pfeile treffen nicht, Katapult und Meteor nur halb.
   - Kriegsmaschinen am Feldrand: feindliche lassen sich zerstören oder erobern (daneben stehen, kein Feind in der Nähe).
   - Vier Schlacht-Ziele im Wechsel (KR_ZIELE): Linie halten, Maschine nehmen, Bannerträger schützen, Hauptmann besiegen. Moral 0 = verloren.
   - Reiche als Daten (REICHE): alle fünf aus dem Bauplan; vier stehen an der Front (6.8: Nordmark und Sylvara dazu), das Schattenkonzil noch nicht.
   - Fronten (6.8): jedes Kriegsgebiet ist eine Front zwischen zwei Reichen (KR_FRONT, krFront) – du wählst eine der beiden Seiten. Wer gegen ein Reich
     gewinnt, verliert dort KR_VERRAT Kriegsruf. Ränge bringen Vorteile (KR_VORTEIL), die Chronik hat Akt 1 je Reich (KR_AKT1, Kapitel nach Siegen).
   - Balliste (6.8): Bolzen entlang einer angekündigten Linie (Beschuss-Art 'bolzen', wie die Sturmbahn ohne Läufer).
   Spielstand: SAVE.meta.krieg = { v, r: { Reich: { ruf (Kriegsruf), mk (Marken), sg (Siege), nl (Niederlagen) } }, n: Schlachten begonnen, sg: Siege,
     pro: Prolog gesehen, seite: zuletzt gewählt, kasse: { w: Woche, b: { 'reich:id': gekauft } }, ch: { 'a1_<reich>_<i>': 1 = Kapitel gelesen } }
   Karte: P.map.kr = 1 (Kriegsgebiete eingetragen), Knoten t: 'krieg'. Raum: startRoom('krieg', reihe, { krSeite, krZiel })
   Schnittstelle: REICHE, REICH_ORDER, KR (laufende Schlacht), kriegOffen(), kriegMap(M, saat), kriegEnter(reihe), krShot(art, x, y, o), krCover(x, y),
     krRuf(reich), krRang(reich), krGain(reich, ruf, marken), krEnd(sieg, grund), kriegChronik(von)
   ========================================================= */

const KR_WARN_MIN = .8;          // Sekunden: nie weniger sichtbare Vorwarnung vor einem Einschlag
const KR_CAP = 22, KR_SIDE = 10; // Soldaten beider Heere zusammen / je Heer (Kriegsmaschinen extra, höchstens 3)
const KR_ZIELE = ['linie', 'maschine', 'banner', 'hauptmann'];

/* ---------- Die fünf Reiche ---------- */
// raenge: [ab Kriegsruf, Name] – Vorteile je Rang kommen in Kapitel 2 · einh: Einheiten (EN) · masch: Kriegsmaschinen (die erste ist das Wahrzeichen)
const REICHE = {
  aurelien: { n: _t('Aurelien'), krone: _t('Sonnenkrone'), c: '#ffd24a', c2: '#f4efe0', dk: '#a0701a', aktiv: 1, sp: 'knightf', who: () => _t('Marschallin Isaure'), stil: _t('Ritter und Paladine, Schildwälle, Katapulte'),
    einh: ['kr_a_schild', 'kr_a_ritter', 'kr_a_schuetze', 'kr_a_schild'], hpt: 'kr_a_hauptmann', hptN: _t('Hauptmann Leoric'), hptK: 'Leoric', masch: ['katapult', 'pfeil'], mk: _t('Sonnenmarken'),
    ruft: _t('Halte mit uns die Linie, Söldner. Aurelien vergisst keinen, der unter der Sonne stand.'), lohn: _t('+30 % Gold für den Sieg'), heer: _t('Schildträger, Sonnenritter, Kronschützen – und ein eigenes Katapult') },
  nordmark: { n: _t('Nordmark'), krone: _t('Eisenkrone'), c: '#6aa0d8', c2: '#c8d0e0', dk: '#2e4a7a', aktiv: 1, sp: 'dwarf', who: () => _t('Jarl Hroald'), stil: _t('Axtkämpfer und Schildmaiden, Ballisten, Katapulte'),
    einh: ['kr_n_axt', 'kr_n_schild', 'kr_n_jaeger', 'kr_n_axt'], hpt: 'kr_n_hauptmann', hptN: _t('Schildbrecherin Ragna'), hptK: 'Ragna', masch: ['ballista', 'katapult'], mk: _t('Eisenmarken'),
    ruft: _t('In der Nordmark zählt ein Wort mehr als Gold. Gib uns deins, und wir geben dir unseres.'), lohn: _t('+25 % Kriegsruf für den Sieg'), heer: _t('Axtkämpfer, Schildmaiden, Eisjäger – und eine eigene Balliste') },
  sylvara: { n: _t('Sylvara'), krone: _t('Dornenkrone'), c: '#6ac24e', c2: '#d8e8a8', dk: '#2a5a26', aktiv: 1, sp: 'elff', who: () => _t('Dornenkönigin Ilvaine'), stil: _t('Waldläufer und Druiden, Pfeilhagel'),
    einh: ['kr_s_dorn', 'kr_s_laeufer', 'kr_s_druide', 'kr_s_laeufer'], hpt: 'kr_s_hauptmann', hptN: _t('Waldmeisterin Eryn'), hptK: 'Eryn', masch: ['pfeil', 'pfeil'], mk: _t('Dornenmarken'),
    ruft: _t('Der Wald sieht, wer über seine Wurzeln läuft. Lauf für uns, und er vergisst dich nicht.'), lohn: _t('+2 Bannerstoff für den Sieg'), heer: _t('Dornenwächter, Waldläuferinnen, Druiden – und ein eigener Pfeilwerfer') },
  karth: { n: _t('Karth'), krone: _t('Aschekrone'), c: '#ff5a3a', c2: '#2a2028', dk: '#7a1e18', aktiv: 1, sp: 'wizard', who: () => _t('Aschefürst Varn'), stil: _t('Feuermagier und Söldner, Meteore'),
    einh: ['kr_k_soeldner', 'kr_k_klinge', 'kr_k_pyro', 'kr_k_soeldner'], hpt: 'kr_k_hauptmann', hptN: _t('Hauptfrau Sareth'), hptK: 'Sareth', masch: ['magie', 'pfeil'], mk: _t('Aschemarken'),
    ruft: _t('Karth fragt nicht, wem du gestern gedient hast. Nur, ob du heute triffst.'), lohn: _t('+2 Kriegseisen für den Sieg'), heer: _t('Aschesöldner, Brandklingen, Flammenrufer – und ein eigener Glutwerfer') },
  konzil: { n: _t('Das Schattenkonzil'), krone: _t('Hohle Krone'), c: '#a070f0', c2: '#1e1630', dk: '#3e2470', aktiv: 0, sp: 'doc', who: () => _t('niemand, den man kennt'), stil: _t('Assassinen und Beschwörer, Schattenrisse'), einh: [], masch: ['riss'], mk: _t('Hohle Marken') }
};
const REICH_ORDER = ['aurelien', 'nordmark', 'sylvara', 'karth', 'konzil'];
const KR_RAENGE = [[0, _t('Söldner')], [150, _t('Hauptmann')], [600, _t('Marschall')], [1500, _t('Kronfeldherr')]];
// Vorteile der Ränge (gelten zusammen ab dem Rang, beim Reich, für das du kämpfst)
const KR_VORTEIL = [null, () => _t('+10 % Gold und Kriegsruf für jeden Sieg'), () => _t('Deine Soldaten haben 20 % mehr Leben'), () => _t('Deine Kriegsmaschine feuert öfter')];
const KR_VERRAT = 5;   // so viel Kriegsruf verlierst du bei dem Reich, gegen das du gewinnst
for (const k of REICH_ORDER) { REICHE[k].key = k; REICHE[k].raenge = KR_RAENGE; }
const KR_AKTIV = REICH_ORDER.filter(k => REICHE[k].aktiv);
// Fronten: jedes Kriegsgebiet steht zwischen zwei Reichen · Erzfeind: wenn keine Front vorgegeben ist
const KR_FRONT = [['aurelien', 'karth'], ['nordmark', 'sylvara'], ['aurelien', 'nordmark'], ['karth', 'sylvara'], ['aurelien', 'sylvara'], ['nordmark', 'karth']];
const KR_RIVAL = { aurelien: 'karth', karth: 'aurelien', nordmark: 'sylvara', sylvara: 'nordmark' };
const krGegner = s => KR_RIVAL[s] || KR_AKTIV.find(k => k !== s);
// Front des Kriegsgebiets in Reihe row (fest je Held, Akt und Reihe)
// 6.9: echte Grenze der Kriegskarte (js/kriegskarte.js, kkFront) – nur ohne Karte die feste Liste
function krFront(row) { const kf = typeof kkFront === 'function' ? kkFront(row) : null; if (kf) return kf; return KR_FRONT[((P ? P.act : 3) * 2 + (row >= 3 ? 1 : 0) + (P ? Math.floor(P.created / 1000) % 7 : 0)) % KR_FRONT.length]; }
const KR_MASCH = {
  katapult: { n: _t('Katapult'), d: _t('Schleudert Steine: großer Kreis, Krater, wirft dich zurück.'), cd: [6.5, 9] },
  pfeil: { n: _t('Pfeilwerfer'), d: _t('Pfeilhagel: viele kleine Schatten in einer Fläche. Deckung hält ihn ganz auf.'), cd: [5, 7.5] },
  magie: { n: _t('Glutwerfer'), d: _t('Magiehagel: Meteore, danach brennt der Boden ein paar Sekunden.'), cd: [6.5, 9] },
  ballista: { n: _t('Balliste'), d: _t('Schießt schwere Bolzen entlang einer Linie am Boden. Raus aus dem Streifen!'), cd: [5.5, 8] }
};
const KR_ZIEL = {
  linie: { n: _t('Linie halten'), d: _t('Halte 70 Sekunden durch. Feinde, die durchbrechen, drücken die Moral.') },
  maschine: { n: _t('Kriegsmaschine nehmen'), d: _t('Erobere oder zerstöre die große Maschine des Feindes am anderen Ende des Feldes.') },
  banner: { n: _t('Bannerträger schützen'), d: _t('Dein Bannerträger trägt das Banner über das Feld. Fällt er, ist die Schlacht verloren.') },
  hauptmann: { n: _t('Hauptmann besiegen'), d: _t('Der feindliche Hauptmann führt selbst an. Besiege ihn.') }
};
// Kriegs-Biome der Lande: womit dort geschossen wird
const KR_LANDE = { kr_schildgraben: ['pfeil', 'pfeil', 'katapult'], kr_brandmark: ['katapult', 'katapult', 'pfeil'], kr_aschefront: ['magie', 'magie', 'katapult'] };
// Kriegskasse: Tausch gegen Marken des Reichs und Kriegsbeute, je Woche begrenzt
const KR_KASSE = [
  { id: 'gold', mk: 3, max: 3, e: () => ({ t: 'gold', n: 150 + (P ? P.lv : 1) * 40 }) },
  { id: 'stein', mk: 5, m: { kriegseisen: 4 }, max: 2, e: r => ({ t: 'gem', k: ({ karth: 'rubin', nordmark: 'saphir', sylvara: 'smaragd' }[r] || 'topas') + ':' + (P && P.lv >= 35 ? 3 : P && P.lv >= 15 ? 2 : 1), n: 1 }) },
  { id: 'glueck', mk: 8, m: { bannerstoff: 3 }, max: 2, e: () => ({ t: 'fate', n: 2 }) }
];
if (typeof LMATV !== 'undefined') { LMATV.kriegseisen = 30; LMATV.bannerstoff = 45; }
if (typeof MK_MATV !== 'undefined') { MK_MATV.kriegseisen = 35; MK_MATV.bannerstoff = 50; }
if (typeof EN_EL !== 'undefined') { EN_EL.kr_k_pyro = 'feuer'; EN_EL.kr_k_hauptmann = 'feuer'; EN_EL.kr_n_jaeger = 'frost'; EN_EL.kr_n_hauptmann = 'frost'; EN_EL.kr_s_druide = 'gift'; EN_EL.kr_s_hauptmann = 'gift'; }
// Hauptleute, die aus der Ferne kämpfen · wer Feuer wirft statt Pfeile
const krFernH = D => D.kr[1] === 'hauptmann' && (D.kr[0] === 'karth' || D.kr[0] === 'sylvara');
const krFeuer = (k, D) => k.rolle === 'magier' || (k.rolle === 'hauptmann' && D.kr[0] === 'karth');

document.head.insertAdjacentHTML('beforeend', `<style>
#krhud{position:fixed;left:50%;transform:translateX(-50%);top:calc(env(safe-area-inset-top,0px) + 52px);width:min(250px,calc(100vw / var(--ui) - 150px));min-width:150px;zoom:var(--ui);pointer-events:none;z-index:5;font-family:var(--f-display);text-shadow:1px 1px 0 #000,0 0 3px #000;text-align:center}
#krhud .t{font-size:8px;line-height:1.5;color:var(--gold);margin-bottom:3px}
#krhud .l{display:grid;grid-template-columns:54px minmax(0,1fr);gap:5px;align-items:center;font-size:6px;color:var(--parch);margin-top:3px;text-align:right}
#krhud .l.z{color:var(--c,#ff8a5a)}
#krhud .b{position:relative;height:7px;background:rgba(10,8,14,.75);box-shadow:0 0 0 1px #000,inset 0 0 0 1px rgba(255,255,255,.12)}
#krhud .b i{position:absolute;left:1px;top:1px;bottom:1px;max-width:calc(100% - 2px);background:var(--c,#79c24e)}
#krhud .b.low i{background:#e8463c;animation:krlow .5s steps(2) infinite}
@keyframes krlow{50%{opacity:.55}}
@media (orientation:portrait){#krhud{top:calc(env(safe-area-inset-top,0px) + 74px);width:min(250px,calc(100vw / var(--ui) - 40px))}}
.krsides{display:grid;gap:8px;grid-template-columns:repeat(auto-fit,minmax(230px,1fr));margin:8px 0}
.krside{background:var(--stone-lo);padding:10px;box-shadow:inset 0 3px 0 var(--c);display:flex;flex-direction:column;gap:6px;min-width:0}
.krside .hd{display:flex;gap:10px;align-items:center}.krside .hd img{width:40px;height:40px;image-rendering:pixelated;flex:none}
.krside .nm{font-family:var(--f-display);font-size:11px;color:var(--c);line-height:1.4}.krside .kr{font-size:16px;color:var(--parch-dim);line-height:1}
.krside p{margin:0;font-size:17px;line-height:1.15}.krside p.q{color:var(--parch);font-style:italic}
.krside .lo{font-size:16px;color:var(--gold)}.krside .btn{min-height:46px;margin-top:auto}
.krziel{background:var(--night);padding:8px 10px;box-shadow:inset 3px 0 0 var(--gold);font-size:17px;line-height:1.15}.krziel b{display:block;font-family:var(--f-display);font-weight:400;font-size:8px;color:var(--gold);margin-bottom:4px;line-height:1.5}
.krbar{position:relative;height:12px;background:var(--night);box-shadow:inset 0 0 0 2px var(--stone-hi);margin-top:4px}.krbar i{position:absolute;left:2px;top:2px;bottom:2px;max-width:calc(100% - 4px);background:var(--c)}
.krbar span{position:absolute;inset:0;display:grid;place-items:center;font-family:var(--f-display);font-size:6px;text-shadow:1px 1px 0 #000;white-space:nowrap}
.krrow{grid-template-columns:44px minmax(0,1fr)}.krrow.aus{opacity:.5}
.krks{display:flex;flex-wrap:wrap;gap:6px;margin:6px 0 2px}.krks .btn{flex:1 1 150px;min-height:46px;display:inline-flex;align-items:center;justify-content:center;gap:5px;flex-wrap:wrap}.krks .btn img{width:18px;height:18px;image-rendering:pixelated}
.krlohn{max-width:520px;margin:6px auto;text-align:left}
body.touch .panel .krks .btn,body.touch .panel [data-act="kr_prolog"]{min-height:44px}
.krks .rwc{font-family:var(--f-body);font-size:18px}
@media (max-height:480px){.krside p.q{display:none}.krsides{margin:6px 0}}
</style>`);
document.body.insertAdjacentHTML('beforeend', '<div id="krhud" hidden><div class="t" id="krT"></div><div class="l"><span id="krMl"></span><div class="b" id="krMb"><i id="krMf"></i></div></div><div class="l z" id="krZr"><span id="krZl"></span><div class="b"><i id="krZf"></i></div></div></div>');

/* ---------- Spielstand ---------- */
function krDef() { const r = {}; for (const k of REICH_ORDER) r[k] = { ruf: 0, mk: 0, sg: 0, nl: 0 }; return { v: 1, r, n: 0, sg: 0, pro: 0, seite: '', kasse: { w: 0, b: {} }, ch: {} }; }
// Alte und kaputte Spielstände: fehlende Felder ergänzen, Unsinn auf gültige Werte bringen
function krFix(d) {
  const o = krDef(), num = (v, max) => clamp(Math.floor(+v) || 0, 0, max);
  if (!d || typeof d !== 'object') return o;
  for (const k of REICH_ORDER) { const s = d.r && typeof d.r === 'object' && d.r[k] && typeof d.r[k] === 'object' ? d.r[k] : {}; o.r[k] = { ruf: num(s.ruf, 1e7), mk: num(s.mk, 99999), sg: num(s.sg, 1e7), nl: num(s.nl, 1e7) }; }
  o.n = num(d.n, 1e7); o.sg = num(d.sg, 1e7); o.pro = d.pro ? 1 : 0; o.seite = KR_AKTIV.includes(d.seite) ? d.seite : '';
  const ks = d.kasse && typeof d.kasse === 'object' ? d.kasse : {}; o.kasse.w = num(ks.w, 1e6);
  if (ks.b && typeof ks.b === 'object') for (const k in ks.b) { const [r, id] = String(k).split(':'); if (REICHE[r] && KR_KASSE.some(x => x.id === id)) o.kasse.b[k] = num(ks.b[k], 99); }
  if (d.karte && typeof d.karte === 'object') o.karte = d.karte;   // Kriegskarte (6.9): geprüft in js/kriegskarte.js (kkFix)
  if (d.ch && typeof d.ch === 'object' && !Array.isArray(d.ch)) for (const k in d.ch) if (/^[a-z0-9_]{1,24}$/.test(k) && Object.keys(o.ch).length < 200) o.ch[k] = num(d.ch[k], 1e6);
  return o;
}
HOOK.meta.push(m => { try { m.krieg = krFix(m.krieg); } catch (e) { m.krieg = krDef(); } });
const krM = () => SAVE.meta.krieg;
function krRuf(r) { return krM().r[r] ? krM().r[r].ruf : 0; }
function krRang(r) { const v = krRuf(r); let i = 0; KR_RAENGE.forEach((x, j) => { if (v >= x[0]) i = j; }); return i; }
function krGain(r, ruf, mk) { const R = krM().r[r]; if (!R) return; R.ruf = Math.min(1e7, R.ruf + Math.max(0, Math.round(ruf || 0))); R.mk = Math.min(99999, R.mk + Math.max(0, Math.round(mk || 0))); }
function kriegOffen() { return !!P && ((P.maxAct || P.act || 1) >= 3 || krM().n > 0); }

/* ---------- Weltkarte: Kriegsgebiete ab Akt 3 ---------- */
// Eigener Zufall (verschiebt keine anderen Orte): je ein Kampf in den Reihen 2–3 und 4–6 wird zum Kriegsgebiet. Auch für Karten, die schon laufen (nur Orte, die noch vor dem Helden liegen).
function kriegMap(M, saat) {
  if (!M || M.kr || !Array.isArray(M.rows) || M.act < 3) return; M.kr = 1;
  const R = mulberry((saat != null ? saat : P ? P.created % 100000 : 1) + M.act * 4201 + 66), at = M.pos ? M.pos.r : -1;
  for (const [a, b] of [[1, 2], [3, 5]]) {
    let c = []; for (let r = a; r <= b; r++) if (r > at && M.rows[r]) M.rows[r].forEach(n => { if (n.t === 'kampf' && !n.done) c.push(n); });
    if (!c.length) for (let r = a; r <= b; r++) if (r > at && M.rows[r]) M.rows[r].forEach(n => { if ((n.t === 'dunkel' || n.t === 'ueberleben' || n.t === 'elite') && !n.done) c.push(n); });
    if (c.length) c[Math.floor(R() * c.length)].t = 'krieg';
  }
}
HOOK.activate.push(c => { try { if (c && c.map) kriegMap(c.map, c.created % 100000); } catch (e) { } });
HOOK.artIcon.push((name, b) => {
  if (name === 'kr_banner') {   // gekreuzte Banner: Gold und Rot
    b.line(3, 14, 12, 2, WOOD[1]); b.line(12, 14, 3, 2, WOOD[1]); b.rect(9, 2, 5, 5, '#d8433a'); b.rect(9, 2, 5, 1, '#ff7a6a'); b.rect(11, 7, 3, 1, '#7a1e22'); b.rect(2, 2, 5, 5, '#ffd24a'); b.rect(2, 2, 5, 1, '#fff3c0'); b.rect(2, 7, 3, 1, '#a0701a'); b.set(7, 8, '#efe2bf'); b.set(8, 8, '#efe2bf');
  } else if (name === 'kr_schild') { b.rect(4, 3, 8, 7, '#ffd24a'); b.rect(5, 10, 6, 2, '#ffd24a'); b.rect(6, 12, 4, 1, '#e8b04a'); b.rect(7, 13, 2, 1, '#e8b04a'); b.rect(4, 3, 8, 1, '#fff3c0'); b.rect(7, 4, 2, 8, '#a0701a'); b.rect(5, 6, 6, 2, '#a0701a');
  } else if (name.startsWith('kr_w_')) {   // Wappen: Schild in den Farben des Reichs mit Zeichen
    const R = REICHE[name.slice(5)]; if (!R) return;
    b.rect(3, 2, 10, 8, R.c2); b.rect(4, 10, 8, 2, R.c2); b.rect(5, 12, 6, 1, R.c2); b.rect(7, 13, 2, 1, R.c2); b.rect(3, 2, 10, 2, R.c); b.rect(3, 2, 1, 8, R.dk); b.rect(12, 2, 1, 8, R.dk);
    switch (R.key) {
      case 'aurelien': b.disc(8, 7, 2.2, R.c); for (let k = 0; k < 8; k++) { const a = k / 8 * 6.283; b.set(8 + Math.cos(a) * 4, 7 + Math.sin(a) * 4, R.dk); } b.set(8, 7, '#fff'); break;
      case 'karth': b.rect(7, 5, 2, 6, R.c); b.rect(6, 7, 4, 3, R.c); b.set(8, 4, R.c); b.rect(7, 8, 2, 2, '#ffd24a'); break;
      case 'nordmark': b.rect(8, 4, 1, 8, R.dk); b.rect(5, 5, 3, 3, R.c); b.rect(9, 5, 3, 3, R.c); break;
      case 'sylvara': b.line(5, 11, 11, 5, R.dk); b.set(6, 8, R.c); b.set(9, 9, R.c); b.set(8, 5, R.c); b.set(10, 7, R.c); break;
      default: b.rect(5, 6, 6, 3, R.c); b.set(5, 5, R.c); b.set(8, 5, R.c); b.set(10, 5, R.c); b.rect(6, 7, 4, 1, R.c2);
    }
  }
});

/* ---------- Prolog der Chronik ---------- */
function krProlog() {
  const herold = { n: _t('Herold Caspian von Aurelien'), sp: 'knight', c: REICHE.aurelien.c }, nessa = { n: _t('Zahlmeisterin Nessa von Karth'), sp: 'wizf', c: REICHE.karth.c };
  return [
    ['erz', _t('Östlich von Klingenhort lag ein Reich, das keinen Namen brauchte. Es hatte einen Thron, eine Krone, einen König. Dann bebte das Weltentor – und der Thron zersprang wie Glas.')],
    ['erz', _t('Fünf Splitter, fünf Kronen. Aurelien trägt die Sonnenkrone und nennt sich Erbe. Die Nordmark schmiedete sich eine aus Eisen, Sylvara flocht ihre aus Dornen, Karth hob seine aus der Asche. Die fünfte, die Hohle Krone, hat noch niemand auf einem Kopf gesehen.')],
    [herold, _t('Du da, mit der Klinge! Aurelien zahlt in Gold und in Ehre. Marschallin Isaure hält den Schildgraben seit vierzig Tagen. Vierzig! Mit einem Arm wie deinem werden es einundvierzig.')],
    [nessa, _t('Ehre. Hübsch. Davon wird keiner satt. Karth zahlt in Eisen, sofort, und fragt nicht, woher du kommst. Die Sonnenritter nennen uns Brandstifter – dabei haben wir nur aufgehört, um Erlaubnis zu frieren.')],
    ['borin', _t('Hör zu, {name}. Der Orden hat nie einer Krone gedient, und du fängst heute nicht damit an. Aber Kronen zahlen gut, und unsere Esse frisst Kohle. Sei Söldner. Kämpf, für wen du willst – und wechsle, wenn es dir stinkt.')],
    ['borin', _t('Nur eins: Auf dem Schlachtfeld regnet es. Pfeile, Steine, Feuer. Schau auf den Boden – wo ein Kreis leuchtet, stehst du falsch. Und ein Schildwall ist kein Schmuck. Stell dich dahinter.')],
    ['erz', _t('So beginnt die Chronik der Kronen: nicht mit einem König, sondern mit einem Söldner ohne Krone. Die Front wartet.')]
  ];
}

/* ---------- Chronik Akt 1: drei Kapitel je Reich, freigeschaltet durch Siege für dieses Reich (ab) ---------- */
const KR_WHO = {
  isaure: () => ({ n: _t('Marschallin Isaure'), sp: 'knightf', c: REICHE.aurelien.c }), varn: () => ({ n: _t('Aschefürst Varn'), sp: 'wizard', c: REICHE.karth.c }),
  nessa: () => ({ n: _t('Zahlmeisterin Nessa von Karth'), sp: 'wizf', c: REICHE.karth.c }), hroald: () => ({ n: _t('Jarl Hroald'), sp: 'dwarf', c: REICHE.nordmark.c }),
  ragna: () => ({ n: _t('Schildbrecherin Ragna'), sp: 'dwarff', c: REICHE.nordmark.c }), ilvaine: () => ({ n: _t('Dornenkönigin Ilvaine'), sp: 'elff', c: REICHE.sylvara.c }),
  eryn: () => ({ n: _t('Waldmeisterin Eryn'), sp: 'elff', c: REICHE.sylvara.c })
};
const KR_AKT1 = {
  aurelien: [
    { ab: 1, t: () => _t('Einundvierzig Tage'), L: () => [[KR_WHO.isaure(), _t('Einundvierzig Tage. Der Herold hatte recht – du hast uns einen geschenkt. Aurelien zählt solche Tage. Und die, die sie bringen.')], ['erz', _t('Hinter dem Schildgraben liegt das Feldlager der Sonnenkrone: Zelte, Gebete, Verbände. Und zu viele leere Feldbetten.')]] },
    { ab: 3, t: () => _t('Der wahre Erbe?'), L: () => [[KR_WHO.isaure(), _t('Man sagt, der letzte König hatte keinen Erben. Aurelien sagt etwas anderes. Ich glaube es – meistens. In langen Nächten weniger.')], ['borin', _t('Eine Krone, die beweisen muss, dass sie die richtige ist, {name}, hat meistens schon verloren. Kämpf trotzdem gut. Gold ist Gold.')]] },
    { ab: 6, t: () => _t('Ein Brief ohne Siegel'), L: () => [['erz', _t('Am Morgen nach dem Sieg liegt ein Brief in Isaures Zelt. Kein Siegel, keine Unterschrift – nur ein Kreis aus violetter Tinte.')], [KR_WHO.isaure(), _t('„Die Sonne wirft den längsten Schatten.“ Mehr steht nicht darin. Wer kommt in mein Zelt, ohne dass meine Wachen ihn sehen? … Behalte das für dich, Söldner.')]] }
  ],
  nordmark: [
    { ab: 1, t: () => _t('Der Schwur am Eis'), L: () => [[KR_WHO.hroald(), _t('Du hast für uns gekämpft, also bist du unser Gast, bis der Schnee taut. Hier oben taut er nie.')], ['erz', _t('Die Eisenkrone ist aus den Ketten des alten Kerkers geschmiedet. Hroald trägt sie, damit niemand vergisst, wer einst darin saß.')]] },
    { ab: 3, t: () => _t('Ragnas Hammer'), L: () => [[KR_WHO.ragna(), _t('Du schlägst nicht schlecht für einen aus dem Süden. Komm wieder, wenn die Ballisten singen.')], [KR_WHO.hroald(), _t('Sylvara nennt uns Holzfäller. Sollen sie. Wer im Winter friert, fällt Bäume – und wer im Krieg friert, fällt Dornenhecken.')]] },
    { ab: 6, t: () => _t('Wölfe ohne Spur'), L: () => [['erz', _t('Drei Wolfsreiter kehren nicht von der Grenze zurück. Ihre Spuren enden mitten im Schnee, als hätte die Luft sie verschluckt.')], [KR_WHO.hroald(), _t('Kein Tier und kein Reich, das ich kenne, holt einen Reiter so. Halt die Augen offen, Söldner. Da spielt noch jemand mit.')]] }
  ],
  sylvara: [
    { ab: 1, t: () => _t('Unter den Dornen'), L: () => [[KR_WHO.ilvaine(), _t('Der Wald hat dich gesehen, Söldner. Er sieht alles, was über seine Wurzeln läuft. Heute mochte er, was er sah.')], ['erz', _t('Sylvaras Dornenkrone wächst noch. Jedes Jahr treibt sie einen neuen Trieb – und jedes Jahr sticht sie ihre Trägerin ein wenig tiefer.')]] },
    { ab: 3, t: () => _t('Die Waldmeisterin'), L: () => [[KR_WHO.eryn(), _t('Die Nordmark schlägt unsere Bäume, Aurelien betet sie an, Karth verbrennt sie. Wir wollen nur, dass sie stehen bleiben.')], ['borin', _t('Klingt vernünftig, {name}. Nur ist im Krieg selten jemand vernünftig, der es sich leisten kann.')]] },
    { ab: 6, t: () => _t('Das stumme Holz'), L: () => [['erz', _t('Im ältesten Hain ist ein Baum verstummt: keine Vögel, kein Wind in den Blättern. Seine Rinde ist violett geworden.')], [KR_WHO.ilvaine(), _t('Das war kein Feuer und keine Axt. Das ist etwas, das sich versteckt. Wenn du es findest, Söldner – sag es zuerst mir.')]] }
  ],
  karth: [
    { ab: 1, t: () => _t('Eisen statt Ehre'), L: () => [[KR_WHO.nessa(), _t('Pünktlich bezahlt, wie versprochen. Siehst du? Karth lügt nicht. Karth rechnet nur genauer als die anderen.')], [KR_WHO.varn(), _t('Man nennt uns Brandstifter. Gut. Wer die Asche fürchtet, sollte nicht auf ihr bauen.')]] },
    { ab: 3, t: () => _t('Die Glutschmieden'), L: () => [['erz', _t('Unter Karth brennen die Glutschmieden Tag und Nacht. Aus Asche wird Eisen, aus Eisen werden Meteore.')], [KR_WHO.varn(), _t('Der Thron hat uns hungern lassen, als er noch ganz war. Zerbrochen gefällt er mir besser.')]] },
    { ab: 6, t: () => _t('Der Gast in Violett'), L: () => [['erz', _t('An Varns Feuer sitzt ein Gast. Niemand hat ihn kommen sehen, seine Maske ist violett, und er trinkt nicht.')], [KR_WHO.varn(), _t('Er bietet mir Aurelien an. Ganz. Für einen Preis, den er nicht nennt. Ich habe abgelehnt – noch. Sag niemandem, dass du ihn gesehen hast.')]] }
  ]
};

/* ---------- Seite wählen ---------- */
function krZielNext() { return KR_ZIELE[krM().n % KR_ZIELE.length]; }
function kriegEnter(row) {
  const M = krM(); setState('menu'); showHud(false);
  if (!M.pro) { M.pro = 1; persist(); dialog(krProlog(), () => krWahl(row), _t('Chronik der Kronen · Prolog')); return; }
  krWahl(row);
}
function krWahl(row) {
  setState('menu'); KR.row = row;
  const z = krZielNext(), Z = KR_ZIEL[z], FR = krFront(row); KR.front = FR;
  const card = s => {
    const R = REICHE[s], F = REICHE[FR.find(k => k !== s)], D = krM().r[s], rg = krRang(s);
    return `<div class="krside" style="--c:${R.c}"><div class="hd"><img src="${iconURL(['pa', 'kr_w_' + s])}" alt=""><div><div class="nm">${esc(R.n).toLocaleUpperCase(LOCALE)}</div><div class="kr">${esc(R.krone)} · ${esc(KR_RAENGE[krRang(s)][1])} · ${_t('Kriegsruf {n}', { n: fmt(D.ruf) })}</div></div></div>
    <p class="q">„${esc(R.ruft)}“</p><p>${esc(R.heer)}</p><p style="color:var(--parch-dim)">${_t('Der Feind schießt mit: {list}', { list: F.masch.map(m => esc(KR_MASCH[m].n)).join(', ') })}</p><p class="lo">${_t('Lohn: {l}', { l: esc(R.lohn) })} · ${esc(R.mk)}</p>${rg ? `<p class="lo" style="color:${R.c}">${_t('Rang-Vorteil: {v}', { v: KR_VORTEIL.slice(1, rg + 1).map(f => esc(f())).join(' · ') })}</p>` : ''}
    <button class="btn" data-act="kr_seite" data-id="${s}">${_t('Für {reich} kämpfen', { reich: esc(R.n) })}</button></div>`;
  };
  showOverlay(`<div class="head"><h2>${_t('KRIEGSGEBIET')}</h2><div class="hbtns"><button class="btn alt sm" data-act="kr_zurueck">${_t('Zurück')}</button></div></div>
  <div class="krziel"><b>${_t('ZIEL DIESER SCHLACHT')} · ${esc(Z.n).toLocaleUpperCase(LOCALE)}</b>${esc(Z.d)}</div>
  <p class="sub" style="margin:8px 0 0">${_t('An dieser Front stehen {a} und {b} gegeneinander. Du bist Söldner – wähle für diese Schlacht eine Seite.', { a: esc(REICHE[FR[0]].n), b: esc(REICHE[FR[1]].n) })} ${_t('Wer gegen ein Reich gewinnt, verliert dort {n} Kriegsruf.', { n: KR_VERRAT })}</p>
  ${typeof kkKarte === 'function' && kkKarte().fz ? `<p class="sub" style="margin:4px 0 0;color:${REICHE[kkKarte().fz.s].c}">${_t('Dein Feldzug: Siege für {reich} zählen ({n} von {m}).', { reich: esc(REICHE[kkKarte().fz.s].n), n: kkKarte().fz.n, m: KK_FZ })}</p>` : ''}
  <div class="krsides">${FR.map(card).join('')}</div>`, true);
}
ON.kr_seite = id => { if (!REICHE[id] || !REICHE[id].aktiv) return; const FR = KR.front || [id, krGegner(id)]; krM().seite = id; sfx('spec'); startRoom('krieg', KR.row, { krSeite: id, krFeind: FR.includes(id) ? FR.find(k => k !== id) : krGegner(id) }); };
ON.kr_zurueck = () => { undoRoomEntry(); saveChar(); openMap(); };

/* ---------- Laufende Schlacht ---------- */
const KR = { on: false, row: 0, side: null, foe: null, ziel: null, geo: null, al: [], list: [], machs: [], shots: [], fires: [], bolts: [], rauch: [], cover: [], graben: [], fahnen: [], feuer: [], decals: [], log: [], moral: 60, t: 0, zt: 0, aus: 0, endT: 0, fx: 0, lt: 6, nF: 0, nA: 0 };
function krReset() { KR.on = false; KR.al = []; KR.list = []; KR.machs = []; KR.shots = []; KR.fires = []; KR.bolts = []; KR.rauch = []; KR.cover = []; KR.graben = []; KR.fahnen = []; KR.feuer = []; KR.decals = []; KR.aus = 0; KR.endT = 0; KR.traeger = null; KR.hpt = null; KR.zm = null; KR.caps = 0; KR.gef = 0; KR.t = 0; KR.ban = 0; KR.mwarn = 0; KR.lohn = null; $('krhud').hidden = true; KRH.on = false; }
// Güte der Effekte: HD mehr, Pixel-Modus (Handy) weniger, „Ruhiges Bild“ halbiert
function krQ() { return (HD ? 1 : .6) * (SAVE && SAVE.meta.settings.calm ? .5 : 1); }
function krVis(x, y, m) { m = m || 20; return x > cam.x - m && x < cam.x + VW + m && y > cam.y - m && y < cam.y + VH + m; }
function krDmgBase() { return 11 * scaleOf(stageNum()).am; }
// Feld: u = 0 eigenes Ende … 1 Ende des Feindes (lange Seite der Arena), v = quer.
// Hochformat: Feind oben – aber unterhalb der Anzeige (46 px Luft), das eigene Ende etwas über den Knöpfen.
// Querformat: Feind links, denn rechts liegen die Angriffs-Knöpfe; oben Luft für die Anzeige.
function krGeo() { const hz = AW > AH; return KR.geo = hz ? { hz, a0: BD.x1 - 18, a1: BD.x0 + 18, b0: BD.y0 + 30, b1: BD.y1 - 12 } : { hz, a0: BD.y1 - 34, a1: BD.y0 + 46, b0: BD.x0 + 18, b1: BD.x1 - 18 }; }
function krPos(u, v) { const g = KR.geo, a = lerp(g.a0, g.a1, u), b = lerp(g.b0, g.b1, v); return g.hz ? { x: a, y: b } : { x: b, y: a }; }
function krU(x, y) { const g = KR.geo; return ((g.hz ? x : y) - g.a0) / (g.a1 - g.a0); }

/* ---------- Bilder: Kulissen und Maschinen (einmal gemalt) ---------- */
const KSPR = {};
function krSpr(key, w, h, fn, noOut) { if (KSPR[key]) return KSPR[key]; const b = PB(w, h); fn(b); return KSPR[key] = pbCanvas(noOut ? b : pbOutline(b)); }
function krZelt(r) { const R = REICHE[r]; return krSpr('zelt' + r, 28, 22, b => { for (let y = 0; y < 16; y++) { const w = 2 + Math.round(y * .8); b.rect(14 - w, 4 + y, w * 2, 1, y % 5 === 4 ? R.c : '#d8cdb0'); b.set(14 - w, 4 + y, '#a89a7a'); } b.rect(12, 12, 4, 8, '#2a2028'); b.rect(13, 0, 1, 5, WOOD[1]); b.rect(14, 0, 3, 2, R.c); b.rect(2, 20, 24, 1, '#5a4a36'); }); }
function krPalis() { return krSpr('palis', 14, 18, b => { for (let i = 0; i < 3; i++) { const x = 1 + i * 4, t = i === 1 ? 1 : 3; b.rect(x, t + 2, 4, 15 - t, WOOD[1]); b.rect(x, t + 2, 1, 15 - t, WOOD[2]); b.rect(x + 3, t + 2, 1, 15 - t, WOOD[0]); b.rect(x + 1, t, 2, 2, WOOD[1]); b.set(x + 1, t, WOOD[2]); } b.rect(1, 9, 12, 1, '#4a3a2a'); }); }
function krWagen() { return krSpr('wagen', 28, 18, b => { b.rect(2, 5, 22, 8, WOOD[1]); b.rect(2, 5, 22, 1, WOOD[2]); b.rect(2, 9, 22, 1, WOOD[0]); b.rect(2, 12, 22, 1, WOOD[0]); for (const x of [7, 13, 19]) b.rect(x, 5, 1, 8, WOOD[0]); b.line(24, 9, 27, 4, WOOD[1]); b.disc(7, 14, 3.2, '#3a3028'); b.disc(7, 14, 1.2, '#8a7a5a'); b.disc(19, 13, 3.2, '#3a3028'); b.disc(19, 13, 1.2, '#8a7a5a'); b.rect(4, 2, 7, 3, '#d8cdb0'); b.rect(12, 3, 5, 2, '#a89a7a'); b.line(15, 5, 18, 1, '#c8b88a'); b.set(18, 1, '#8a90a0'); }); }
// Schildwall: quer (liegend, vier Schilde nebeneinander) oder längs (drei Schilde hintereinander, von der Seite)
function krWall(r, hz) {
  const R = REICHE[r];
  if (hz) return krSpr('wallv' + r, 12, 40, b => { for (let i = 0; i < 3; i++) { const y = 2 + i * 12; b.rect(3, y, 6, 11, R.c2); b.rect(3, y, 6, 2, R.c); b.rect(3, y, 1, 11, R.dk); b.rect(5, y + 4, 2, 4, R.c); b.rect(9, y + 3, 2, 1, WOOD[0]); b.rect(10, y + 3, 1, 8, WOOD[0]); } b.rect(2, 38, 9, 1, '#3a3028'); });
  return krSpr('wall' + r, 38, 16, b => { for (let i = 0; i < 4; i++) { const x = 1 + i * 9; b.rect(x, 2, 8, 9, R.c2); b.rect(x + 1, 11, 6, 2, R.c2); b.rect(x + 2, 13, 4, 1, R.c2); b.rect(x, 2, 8, 2, R.c); b.rect(x, 2, 1, 9, R.dk); b.rect(x + 3, 5, 2, 5, R.c); b.set(x + 3, 6, '#fff'); } b.rect(0, 14, 38, 1, '#3a3028'); });
}
// Maschinen: f = 0 gespannt, 1 gerade gefeuert
function krMaschSpr(art, r, f) {
  const R = REICHE[r] || { c: '#c8c0b0', c2: '#8a8478', dk: '#4a4640' };
  return krSpr('m' + art + r + f, 32, 28, b => {
    if (art === 'katapult') {
      b.rect(3, 19, 26, 3, WOOD[1]); b.rect(3, 19, 26, 1, WOOD[2]); b.disc(7, 23, 3.4, '#3a3028'); b.disc(7, 23, 1.2, '#8a7a5a'); b.disc(25, 23, 3.4, '#3a3028'); b.disc(25, 23, 1.2, '#8a7a5a');
      b.line(10, 19, 15, 8, WOOD[0]); b.line(20, 19, 15, 8, WOOD[0]); b.rect(14, 7, 3, 2, '#6a707c');
      if (f) { b.line(15, 9, 25, 3, WOOD[2]); b.line(15, 10, 25, 4, WOOD[1]); b.rect(24, 1, 4, 3, '#4a3a2a'); } else { b.line(15, 9, 5, 14, WOOD[2]); b.line(15, 10, 5, 15, WOOD[1]); b.rect(2, 12, 5, 4, '#4a3a2a'); b.disc(4, 12, 2, '#8a8478'); b.set(3, 11, '#c8c0b0'); }
      b.rect(13, 12, 5, 4, R.c); b.rect(13, 12, 5, 1, R.c2);
    } else if (art === 'pfeil') {
      b.rect(4, 20, 24, 3, WOOD[1]); b.rect(4, 20, 24, 1, WOOD[2]); b.disc(8, 24, 3, '#3a3028'); b.disc(24, 24, 3, '#3a3028'); b.rect(6, 8, 20, 12, WOOD[0]); b.rect(6, 8, 20, 1, WOOD[2]);
      for (let y = 0; y < 3; y++) for (let x = 0; x < 6; x++) { b.set(8 + x * 3, 10 + y * 3, f ? '#2a2028' : '#c8c0b0'); if (!f) b.set(8 + x * 3, 11 + y * 3, '#8a5a32'); }
      b.rect(14, 3, 1, 5, WOOD[1]); b.rect(15, 3, 4, 3, R.c); b.rect(15, 3, 4, 1, R.c2);
    } else if (art === 'ballista') {
      b.rect(4, 20, 24, 3, WOOD[1]); b.rect(4, 20, 24, 1, WOOD[2]); b.disc(8, 24, 3, '#3a3028'); b.disc(24, 24, 3, '#3a3028'); b.disc(8, 24, 1, '#8a7a5a'); b.disc(24, 24, 1, '#8a7a5a');
      b.rect(14, 11, 4, 9, WOOD[0]); b.rect(3, 9, 26, 3, WOOD[1]); b.rect(3, 9, 26, 1, WOOD[2]);
      b.line(9, 10, 5, f ? 3 : 4, '#6a707c'); b.line(23, 10, 27, f ? 3 : 4, '#6a707c'); b.line(5, f ? 3 : 4, f ? 16 : 6, 9, '#c8c0b0'); b.line(27, f ? 3 : 4, f ? 16 : 26, 9, '#c8c0b0');
      if (!f) { b.rect(6, 8, 22, 1, '#c8d0e0'); b.rect(27, 7, 2, 3, '#6a707c'); }
      b.rect(14, 14, 4, 4, R.c); b.rect(14, 14, 4, 1, R.c2);
    } else {
      b.line(8, 25, 14, 12, '#3a3440'); b.line(24, 25, 18, 12, '#3a3440'); b.line(16, 26, 16, 14, '#4a4450'); b.rect(6, 25, 5, 2, '#2a2630'); b.rect(21, 25, 5, 2, '#2a2630');
      b.disc(16, 9, 6.4, '#2a2028'); b.disc(16, 9, 5, f ? '#ffe27a' : '#e8401e'); b.disc(16, 9, 3, f ? '#ffffff' : '#ff9a2a'); b.set(14, 7, '#ffe27a'); b.rect(9, 14, 14, 2, '#4a4450'); b.rect(9, 14, 14, 1, R.c);
      b.rect(15, 0, 2, 3, '#4a4450'); b.rect(10, 8, 2, 2, '#4a4450'); b.rect(20, 8, 2, 2, '#4a4450');
    }
  });
}
const KRAUCH = [];
function krRauchSpr(i) { if (KRAUCH[i]) return KRAUCH[i]; const s = [7, 10, 14][i]; return KRAUCH[i] = mk(s, s, g => { for (let y = 0; y < s; y++) for (let x = 0; x < s; x++) { const d = Math.hypot(x - s / 2 + .5, y - s / 2 + .5) / (s / 2); if (d < 1 && (d < .6 || (x + y) % 2 === 0)) { g.fillStyle = d < .45 ? '#6a6068' : '#4a424c'; g.fillRect(x, y, 1, 1); } } }); }
// Boden-Spuren: g = Zeichenfläche des Bodens (Kampagne) oder der Bildschirm (Lande), Koordinaten schon passend
function krMalKrater(g, x, y, r) {
  g.fillStyle = 'rgba(14,10,10,.5)'; g.beginPath(); g.ellipse(x, y, r * .95, r * .55, 0, 0, 7); g.fill();
  g.fillStyle = 'rgba(8,6,8,.6)'; g.beginPath(); g.ellipse(x, y + 1, r * .62, r * .34, 0, 0, 7); g.fill();
  g.fillStyle = 'rgba(120,104,86,.5)'; g.fillRect(Math.round(x - r * .7), Math.round(y - r * .42), Math.round(r * .8), 1); g.fillRect(Math.round(x - r * .9), Math.round(y - r * .2), 2, 1);
  g.fillStyle = 'rgba(20,14,12,.6)'; for (let k = 0; k < 6; k++) { const a = k * 1.05 + r; g.fillRect(Math.round(x + Math.cos(a) * r * 1.05), Math.round(y + Math.sin(a) * r * .62), 2, 1); }
}
function krMalBrand(g, x, y, r) { g.fillStyle = 'rgba(10,6,6,.42)'; g.beginPath(); g.ellipse(x, y, r, r * .6, 0, 0, 7); g.fill(); g.fillStyle = 'rgba(120,40,16,.3)'; g.beginPath(); g.ellipse(x, y, r * .5, r * .3, 0, 0, 7); g.fill(); }
function krMalPfeil(g, x, y, s) { x = Math.round(x); y = Math.round(y); g.fillStyle = 'rgba(0,0,0,.35)'; g.fillRect(x, y, 3, 1); g.fillStyle = '#c8b88a'; g.fillRect(x, y - 2, 1, 2); g.fillRect(x + 1, y - 4, 1, 2); g.fillRect(x + 2, y - 6, 1, 2); g.fillStyle = s ? '#d8433a' : '#efe2bf'; g.fillRect(x + 2, y - 8, 2, 2); g.fillStyle = '#2a2028'; g.fillRect(x, y, 1, 1); }
function krMalSchild(g, x, y, c) { x = Math.round(x); y = Math.round(y); g.fillStyle = 'rgba(0,0,0,.35)'; g.fillRect(x - 3, y + 2, 8, 1); g.fillStyle = '#3a3028'; g.fillRect(x - 3, y - 2, 7, 5); g.fillStyle = c; g.fillRect(x - 2, y - 2, 3, 4); g.fillRect(x + 2, y - 1, 2, 3); g.fillStyle = '#1a1420'; g.fillRect(x + 1, y - 2, 1, 5); }
function krDecal(art, x, y, r) {
  if (bg && bg.c && !bg.draw) { const g = bg.c.getContext('2d'); if (art === 'krater') krMalKrater(g, x, y, r); else if (art === 'brand') krMalBrand(g, x, y, r); else krMalPfeil(g, x, y, r); return; }
  KR.decals.push({ art, x, y, r }); if (KR.decals.length > 16) KR.decals.shift();
}

/* ---------- Schlachtfeld aufbauen ---------- */
function krFeld() {
  const g = bg.c.getContext('2d'), geo = krGeo(), R = mulberry((P.created % 9973) + G.row * 31 + krM().n * 7), S = REICHE[KR.side], F = REICHE[KR.foe];
  const ell = (p, rx, ry, col) => { g.fillStyle = col; g.beginPath(); g.ellipse(p.x, p.y, geo.hz ? rx : ry, geo.hz ? ry : rx, 0, 0, 7); g.fill(); };
  // Erde über dem Steinboden und weniger Dunkel: das Schlachtfeld liegt unter freiem Himmel (nur dieser Raum: Kopie der Gebiets-Daten)
  bg.b = Object.assign({}, bg.b, { dark: Math.min(bg.b.dark, .3), dust: '#8a7458' });
  g.fillStyle = 'rgba(74,56,38,.46)'; g.fillRect(16, WALL, AW - 32, AH - WALL - 16);
  for (let i = 0; i < 560; i++) { const x = 16 + R() * (AW - 40), y = WALL + R() * (AH - WALL - 22), t = R(); g.fillStyle = t < .4 ? 'rgba(40,28,20,.3)' : t < .75 ? 'rgba(104,80,54,.26)' : t < .93 ? 'rgba(128,104,70,.22)' : 'rgba(78,98,46,.42)'; g.fillRect(x | 0, y | 0, 2 + (R() * 5 | 0), 1 + (R() * 2 | 0)); }
  for (const v of [.36, .41, .62, .67]) { const a = krPos(.02, v), b = krPos(.98, v + (R() - .5) * .08); g.fillStyle = 'rgba(30,20,14,.22)'; for (let k = 0; k < 60; k++) { if (R() < .25) continue; g.fillRect(lerp(a.x, b.x, k / 60) | 0, lerp(a.y, b.y, k / 60) | 0, geo.hz ? 6 : 2, geo.hz ? 2 : 6); } }
  // zertrampelter Boden in der Mitte, alte Krater, Brandflecken, Pfeile, zerbrochene Schilde
  for (let i = 0; i < 9; i++) ell(krPos(.3 + R() * .4, .08 + R() * .84), 26 + R() * 26, 30 + R() * 40, 'rgba(58,44,30,.2)');
  for (let i = 0; i < 6; i++) { const p = krPos(.34 + R() * .34, .08 + R() * .84); krMalKrater(g, p.x, p.y, 9 + R() * 9); }
  for (let i = 0; i < 5; i++) { const p = krPos(.25 + R() * .5, .06 + R() * .88); krMalBrand(g, p.x, p.y, 8 + R() * 8); }
  for (let i = 0; i < 16; i++) { const p = krPos(.2 + R() * .62, .05 + R() * .9); krMalPfeil(g, p.x, p.y, R() < .5); }
  for (let i = 0; i < 7; i++) { const p = krPos(.3 + R() * .42, .06 + R() * .88); krMalSchild(g, p.x, p.y, R() < .5 ? S.c : F.c); }
  // Gräben: zwei Stücke quer vor der eigenen Linie – wer darin steht, ist gedeckt
  const lk = .36 + R() * .08, wv = R() * .1, wu = R() * .08;   // jede Schlacht etwas anders: Lücke im Graben, Wälle, Wagen
  for (const [v0, v1] of [[.04, lk], [lk + .2, .96]]) {
    const a = krPos(.4, v0), b = krPos(.4, v1), th = 15, rc = geo.hz ? { x0: a.x - th / 2, x1: a.x + th / 2, y0: Math.min(a.y, b.y), y1: Math.max(a.y, b.y) } : { x0: Math.min(a.x, b.x), x1: Math.max(a.x, b.x), y0: a.y - th / 2, y1: a.y + th / 2 };
    KR.graben.push(rc);
    g.fillStyle = '#120c0c'; g.fillRect(rc.x0, rc.y0, rc.x1 - rc.x0, rc.y1 - rc.y0); g.fillStyle = '#2a1e18'; g.fillRect(rc.x0 + 1, rc.y0 + 2, rc.x1 - rc.x0 - 2, rc.y1 - rc.y0 - 4);
    g.fillStyle = '#6a5642'; if (geo.hz) { g.fillRect(rc.x0 - 1, rc.y0, 2, rc.y1 - rc.y0); g.fillRect(rc.x1 - 1, rc.y0, 2, rc.y1 - rc.y0); } else { g.fillRect(rc.x0, rc.y0 - 1, rc.x1 - rc.x0, 2); }
    g.fillStyle = '#3a2c22'; if (!geo.hz) g.fillRect(rc.x0, rc.y1 - 1, rc.x1 - rc.x0, 2);
    // Pfähle am Rand zum Feind
    g.fillStyle = WOOD[1]; const n = Math.floor(((geo.hz ? rc.y1 - rc.y0 : rc.x1 - rc.x0)) / 12);
    for (let i = 0; i <= n; i++) { if (geo.hz) g.fillRect(rc.x0 - 5, rc.y0 + 2 + i * 12, 4, 2); else g.fillRect(rc.x0 + 2 + i * 12, rc.y0 - 5, 2, 5); }
  }
  // Deckung: Schildwall der eigenen Seite, Wagen im Niemandsland (alle fest, halten Pfeile auf)
  const fest = (x, y, r, draw) => obs.push({ k: 'col', x, y, r, solid: true, draw: draw || krLeer });
  const wall = (u, v) => { const p = krPos(u, v), hz = geo.hz, spr = krWall(KR.side, hz); for (const d of [-11, 0, 11]) fest(p.x + (hz ? 0 : d), p.y + (hz ? d : 0), 6, d === 0 ? (o, x, y) => { ctx.fillStyle = 'rgba(0,0,0,.3)'; ctx.fillRect(x - spr.width / 2 + 1, y + (hz ? 17 : 3), spr.width - 2, 2); ctx.drawImage(spr, x - spr.width / 2, y - (hz ? 21 : 12)); } : null); KR.cover.push({ x: p.x, y: p.y, hw: 20, dp: 24 }); };
  const wagen = (u, v) => { const p = krPos(u, v), spr = krWagen(); fest(p.x - 7, p.y, 7); fest(p.x + 7, p.y, 7, (o, x, y) => { ctx.fillStyle = 'rgba(0,0,0,.3)'; ctx.fillRect(x - 20, y + 4, 26, 2); ctx.drawImage(spr, x - 21, y - 13); }); KR.cover.push({ x: p.x, y: p.y, hw: 15, dp: 24 }); };
  wall(.27, .2 + wv); wall(.27, .7 + wv); wagen(.52 + wu, .16 + wv); wagen(.6 + wu, .86 - wv);
  // Lager an beiden Enden: Zelte, Palisaden, Banner, Feuer
  const deko = (u, v, spr, oy, r) => { const p = krPos(u, v); fest(p.x, p.y, r || 8, (o, x, y) => { ctx.fillStyle = 'rgba(0,0,0,.3)'; ctx.beginPath(); ctx.ellipse(x, y + 1, spr.width * .45, 3, 0, 0, 7); ctx.fill(); ctx.drawImage(spr, x - (spr.width >> 1), y - spr.height + oy); }); };
  deko(.0, .2, krZelt(KR.side), 4, 10); deko(1, .8, krZelt(KR.foe), 4, 10);
  for (const v of [.02, .98]) { deko(.14, v, krPalis(), 2, 5); deko(.86, v, krPalis(), 2, 5); }
  for (const [u, v, r] of [[.03, .5, KR.side], [.1, .93, KR.side], [.97, .5, KR.foe], [.9, .07, KR.foe]]) { const p = krPos(u, v); KR.fahnen.push({ x: p.x, y: p.y, r, ph: R() * 6 }); }
  for (const [u, v] of [[.05, .78], [.95, .22], [.5, .01], [.5, .99]]) { const p = krPos(u, v); KR.feuer.push({ x: p.x, y: p.y, ph: R() * 6 }); }
}
function krLeer() { }

function krStart() {
  krReset();
  const side = G.extra && REICHE[G.extra.krSeite] && REICHE[G.extra.krSeite].aktiv ? G.extra.krSeite : krM().seite || 'aurelien', M = krM();
  const fe = G.extra && G.extra.krFeind; KR.on = true; KR.side = side; KR.foe = fe && fe !== side && REICHE[fe] && REICHE[fe].aktiv ? fe : krGegner(side); KR.ziel = G.extra && KR_ZIEL[G.extra.krZiel] ? G.extra.krZiel : krZielNext(); KR.moral = 60; KR.log = [];
  if (!(G.extra && G.extra.krProbe)) { M.n++; M.seite = side; }
  if (G.extra) { G.extra.krSeite = side; G.extra.krFeind = KR.foe; G.extra.krZiel = KR.ziel; }   // „Raum wiederholen“ nach dem Tod: gleiche Seite, gleiches Ziel
  krFeld();
  const p0 = krPos(.16, .5); P.x = p0.x; P.y = p0.y; cam.x = clamp(P.x - VW / 2, 0, Math.max(0, AW - VW)); cam.y = clamp(P.y - VH / 2, 0, Math.max(0, AH - VH));
  // Maschinen: eigene am eigenen Ende, zwei feindliche am anderen (die erste ist das Wahrzeichen)
  const S = REICHE[side], F = REICHE[KR.foe];
  krMasch(S.masch[0], side, .04, .32);
  KR.zm = krMasch(F.masch[0], KR.foe, .95, .64); krMasch(F.masch[1], KR.foe, .93, .3);
  // Aufstellung: je sechs, dann Verstärkung im Takt
  for (let i = 0; i < 6; i++) { const a = krPos(.24 + (i % 2) * .08, .12 + i * .152), b = krPos(.7 - (i % 2) * .08, .12 + i * .152); krAlly(S.einh[i % S.einh.length], a.x, a.y); krFoe(F.einh[i % F.einh.length], b.x, b.y); }
  const Z = KR.ziel;
  KR.vres = Z === 'linie' || Z === 'banner' ? 999 : Z === 'maschine' ? 16 : 14; KR.vt = 2.5; KR.at = 4; KR.vr = Z === 'linie' ? 2.2 : Z === 'banner' ? 2.7 : 3.2; KR.ar = 4.6;
  if (Z === 'linie') KR.zt = 70;
  if (Z === 'maschine') for (let i = 0; i < 3; i++) { const p = krPos(.84, .46 + i * .16), e = krFoe(F.einh[i], p.x, p.y); e.kr.wache = 1; e.kr.hold = .84; e.kr.slot = .46 + i * .16; }
  if (Z === 'banner') { const p = krPos(.07, .5), u = krAlly(S.einh[0], p.x, p.y, { rolle: 'banner' }); u.hp = u.maxHp = Math.round(u.maxHp * 4.5); u.spd = 14; KR.traeger = u; KR.bz = krPos(.8, .5); }
  if (Z === 'hauptmann') KR.ht = 8;
  $('objective').textContent = ''; $('bossbar').hidden = true;
}
HOOK.room.push(type => { krReset(); KR.lt = 6; if (type === 'krieg') { try { krStart(); } catch (e) { console.error('Krieg (Aufbau):', e); KR.on = false; } } });

/* ---------- Soldaten ---------- */
function krStrip(D) { return charStrip({ body: D.body, at: 3, ht: 3, dye: D.dye, hair: -1, skin: -1, accent: -1 }); }
function krInit(u, team, rolle) { u.kr = { team, rolle, tt: Math.random() * .4, tg: null, slot: Math.random(), hold: .5, turn: u.turn || 1, str: Math.random() < .5 ? 1 : -1, mt: rnd(3, 5), sp: null }; return u; }
// jeder Gegner mit Soldaten-Daten bekommt Aussehen und Reich – auch die aus den Lagern der Lande
HOOK.spawn.push(e => { const D = e.def; if (!D || !D.kr) return; e.tint = null; e.strip = krStrip(D); krInit(e, D.kr[0], D.kr[1]); });
function krCount() { let n = KR.al.length; for (const e of enemies) if (e.kr && !e.dead) n++; return n; }
function krFoe(type, x, y) { if (krCount() >= KR_CAP) return null; return spawnEnemy(type, { x, y, instant: true }); }
function krAlly(type, x, y, o) {
  if (krCount() >= KR_CAP) return null;
  const D = EN[type], S = scaleOf(stageNum());
  const u = { t: type, def: D, sp: D.sp, ai: 'krieg', ally: true, x, y, z: 0, kbx: 0, kby: 0, r: D.r, sc: D.sc || 1, mass: D.mass || 1, st: 'move', stT: 0, cd: rnd(.3, 1), turn: 1, face: 1, phase: 0, squash: 0, flash: 0, stun: 0, freeze: 0, seed: rnd(0, 9), spd: D.spd * rnd(.9, 1.1), reach: D.reach || 14, alpha: null, lean: 0, aim: 0, windDur: .5, moving: false, tint: null, burn: 0, poison: 0, chill: 0, affixes: [], under: 0, fade: 0, strip: krStrip(D), dead: false };
  u.hp = u.maxHp = Math.round(D.hp * S.hm * 1.1 * (krRang(KR.side) >= 2 ? 1.2 : 1)); u.atk = D.atk * S.am;
  krInit(u, KR.side, (o && o.rolle) || D.kr[1]); u.di = { y: 0, draw: () => krDrawUnit(u) };
  KR.al.push(u); return u;
}
function krGone(t) { return t === P ? (state !== 'play' || P.hp <= 0 || P.stealth > 0) : !!t.dead || t.hp <= 0; }
// Nächstes Ziel der Gegenseite. Feindliche Soldaten nehmen auch den Helden (etwas bevorzugt), den Bannerträger noch lieber.
function krTarget(u) {
  const k = u.kr, rg = k.wache ? 110 : 170; let best = null, bd = rg * rg;
  for (const o of KR.list) { if (o === u || o.dead || o.kr.team === k.team || o.st === 'spawn' || o.kr.flucht) continue; let d = (o.x - u.x) * (o.x - u.x) + (o.y - u.y) * (o.y - u.y); if (o === KR.traeger) d *= .6; if (d < bd) { bd = d; best = o; } }
  if (!u.ally && state === 'play' && P.hp > 0 && !(P.stealth > 0)) { const d = ((P.x - u.x) * (P.x - u.x) + (P.y - u.y) * (P.y - u.y)) * .7; if (d < bd) { bd = d; best = P; } }
  return best;
}
// Schaden zwischen Soldaten und durch Beschuss (nicht durch den Helden): ohne Zahlen, Erfahrung und Beute
function krDmg(t, dmg, nx, ny) {
  if (t.dead) return; t.hp -= Math.max(1, Math.round(dmg)); t.flash = .1; t.squash = .15;
  const m = t.mass || 1; t.kbx += (nx || 0) * 50 / m; t.kby += (ny || 0) * 50 / m;
  if (KR.fx > 0 && krVis(t.x, t.y)) { KR.fx--; for (let i = 0; i < 3; i++) part(t.x, t.y, 8 * t.sc, (nx || 0) * rnd(20, 60) + rnd(-15, 15), (ny || 0) * rnd(10, 30) + rnd(-8, 8), rnd(20, 60), t.def.blood || '#b8302a', rnd(.25, .5), 1); }
  if (t.hp <= 0) krFall(t, nx, ny);
}
function krFall(t, nx, ny) {
  if (t.dead) return; t.dead = true; t.hp = 0;
  const [fx0, fy0, fw, fh] = frameRect(t.sp, 'idle', 0);
  if (krVis(t.x, t.y, 40)) corpses.push({ sp: t.sp, fr: [fx0, fy0, fw, fh], x: t.x, y: t.y, z: t.z || 0, vz: 100, vx: (nx || 0) * 70, vy: (ny || 0) * 35, rot: 0, vr: (nx || 1) * rnd(5, 10), turn: t.turn, sc: t.sc, life: .55, max: .55, blood: t.def.blood, boss: false, tint: null, strip: t.strip });
  if (t.ally) { if (KR.on && !KR.aus) { krMoral(-4); if (t === KR.traeger) krEnd(false, 'banner'); } return; }
  if (KR.on && !KR.aus) { krMoral(1.5); KR.gef++; if (t === KR.hpt) krEnd(true); if (t.mach) krMaschWeg(t.mach, false); }
  // Lande: das Lager des Soldaten merkt sich, dass er fort ist (kommt später wieder)
  if (!KR.on && t.lw && typeof lDespawn === 'function') { try { t.dead = false; lDespawn(t); } catch (e) { t.dead = true; } }
}
function krMoral(d) {
  if (!KR.on || KR.aus) return; KR.moral = clamp(KR.moral + d, 0, 100);
  if (KR.moral < 25 && !KR.mwarn) { KR.mwarn = 1; toast(_t('Die Moral bricht! Besiege Feinde, dann fasst dein Heer wieder Mut.'), '#ff8a7a'); sfx('deny'); } else if (KR.moral > 40) KR.mwarn = 0;
  if (KR.moral <= 0) krEnd(false, 'moral');
}
HOOK.kill.push(e => {
  if (!e || !e.def) return;
  if (e.kr) { stat('krSold'); if (KR.on && !KR.aus) { KR.gef++; krMoral(2.5); if (e === KR.hpt) { stat('krHaupt'); krEnd(true); } } }
  if (e.mach && KR.on) { stat('krZerst'); krMaschWeg(e.mach, false); }
});
// zerstörte Maschine: kein fliegender Körper (die Trümmer malt krMaschWeg)
HOOK.loot.push(e => { if (e && e.mach) { const c = corpses[corpses.length - 1]; if (c && c.x === e.x && c.y === e.y) corpses.pop(); } });

// Eine KI für alle Soldaten. Feindliche (in enemies) hat updEnemy schon bewegt (Rückstoß, Brennen, Betäubung) – hier nur Ziel, Weg und Angriff.
function krAI(u, dt) {
  const k = u.kr, D = u.def;
  if (u.ally) { u.flash -= dt; u.squash *= Math.pow(.001, dt); u.cd -= dt; u.x += u.kbx * dt; u.y += u.kby * dt; const kd = Math.pow(.003, dt); u.kbx *= kd; u.kby *= kd; }
  else if (u.st === 'spawn' || u.stun > 0 || u.freeze > 0) { u.turn = k.turn; return; }
  let mvx = 0, mvy = 0; const spd = u.spd * (u.chill > 0 ? .5 : 1), R = u.r * u.sc;
  if (k.flucht) {   // Schlacht entschieden: zum eigenen Ende laufen und verschwinden
    const h = krPos(u.ally ? .01 : .99, k.slot), dx = h.x - u.x, dy = h.y - u.y, d = Math.hypot(dx, dy) || 1; mvx = dx / d * spd * 1.35; mvy = dy / d * spd * 1.35; u.st = 'move';
    if (d < 14) { u.dead = true; return; }
  } else if (k.sp) { krSonder(u, dt); mvx = k.mvx || 0; mvy = k.mvy || 0; }
  else if (k.rolle === 'banner') {   // trägt das Banner zum Ziel, bleibt stehen, wenn ein Feind nah ist
    let nah = false; for (const o of KR.list) if (!o.ally && !o.dead && !o.kr.flucht && Math.abs(o.x - u.x) < 56 && Math.abs(o.y - u.y) < 50) { nah = true; break; }
    const dx = KR.bz.x - u.x, dy = KR.bz.y - u.y, d = Math.hypot(dx, dy) || 1;
    if (d < 8) { if (!KR.aus) { const p = KR.bz; KR.fahnen.push({ x: p.x, y: p.y, r: KR.side, ph: 0, gross: 1 }); krEnd(true); } } else if (!nah) { mvx = dx / d * spd; mvy = dy / d * spd; }
  } else {
    k.tt -= dt; if (k.tt <= 0 || (k.tg && krGone(k.tg))) { k.tt = .4 + Math.random() * .3; k.tg = krTarget(u); }
    const t = k.tg;
    if (u.st === 'move') {
      if (!t) { if (KR.on) { const h = krPos(k.hold, k.slot), dx = h.x - u.x, dy = h.y - u.y, d = Math.hypot(dx, dy); if (d > 10) { mvx = dx / d * spd * .8; mvy = dy / d * spd * .8; k.fx = dx; } } }
      else {
        const dx = t.x - u.x, dy = t.y - u.y, d = Math.hypot(dx, dy) || 1, tr = t === P ? P.r : t.r * t.sc; k.fx = dx; u.aim = Math.atan2(dy, dx);
        if (k.rolle === 'hauptmann' && !u.ally && (k.mt -= dt) <= 0 && t === P && d < 190) { krSonderStart(u); }
        else if (k.rolle === 'fern' || k.rolle === 'magier' || krFernH(D)) {
          if (d < 55) { mvx = -dx / d * spd; mvy = -dy / d * spd; } else if (d > 128) { mvx = dx / d * spd; mvy = dy / d * spd; } else { mvx = -dy / d * spd * .3 * k.str; mvy = dx / d * spd * .3 * k.str; }
          if (u.cd <= 0 && d < 150) { u.st = t === P ? 'wind' : 'kwind'; u.stT = u.windDur = D.wind || .6; k.lock = t; }
        } else {
          const rng = R + tr + u.reach;
          if (d > rng * .75) { mvx = dx / d * spd; mvy = dy / d * spd; }
          if (d < rng && u.cd <= 0) { u.st = t === P ? 'wind' : 'kwind'; u.stT = u.windDur = D.wind || .42; k.lock = t; }
        }
      }
    } else if (u.st === 'wind' || u.st === 'kwind') { u.stT -= dt; if (k.lock && !krGone(k.lock)) { k.fx = k.lock.x - u.x; u.aim = Math.atan2(k.lock.y - u.y, k.lock.x - u.x); } if (u.stT <= 0) { krStrike(u, k.lock); u.st = 'act'; u.stT = .18; } }
    else if (u.st === 'act') { u.stT -= dt; if (u.stT <= 0) { u.st = 'move'; u.cd = (D.cd || 1.1) * rnd(.8, 1.2); if (Math.random() < .4) k.str *= -1; } }
    else u.st = 'move';
  }
  u.x += mvx * dt; u.y += mvy * dt; u.moving = Math.hypot(mvx, mvy) > 5; if (u.moving) { u.phase += dt * (8 + u.spd / 10); if (!k.tg || k.flucht || k.rolle === 'banner') k.fx = mvx; }
  u.face = (k.fx || 0) >= 0 ? 1 : -1; k.turn = approach(k.turn, u.face, dt * 7); u.turn = k.turn; u.lean = -clamp(mvx / 120, -1, 1) * .12;
  clampE(u);
}
function krStrike(u, t) {
  if (!t || krGone(t)) return;
  const k = u.kr, dx = t.x - u.x, dy = t.y - u.y, d = Math.hypot(dx, dy) || 1, vis = krVis(u.x, u.y);
  if (k.rolle === 'fern' || k.rolle === 'magier' || krFernH(u.def)) {
    const fire = krFeuer(k, u.def), sp = fire ? 135 : 175;
    if (t === P) {
      const a = Math.atan2(P.y + P.vy * .2 - u.y, P.x + P.vx * .2 - u.x);
      if (fire) projs.push({ k: 'kfeuer', fxn: 'fireball', x: u.x + Math.cos(a) * 8, y: u.y + Math.sin(a) * 6, h: 11 * u.sc, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 2.2, max: 2.2, dmg: u.atk, from: 'e', r: 4, src: u }); else enemyArrow(u, a, sp);
    } else if (KR.bolts.length < 16) KR.bolts.push({ x: u.x, y: u.y - 8, vx: dx / d * sp, vy: dy / d * sp, life: d / sp, tg: t, dmg: u.atk * rnd(.85, 1.15), fire, team: k.team });
    if (vis && T - (KR.sfxT || 0) > .25) { KR.sfxT = T; sfx(fire ? 'cast' : 'bow'); }
  } else if (d < u.r * u.sc + (t === P ? P.r : t.r * t.sc) + u.reach + 6) {
    if (t === P) hurtPlayer(u.atk, u); else krDmg(t, u.atk * rnd(.85, 1.15), dx / d, dy / d);
    u.squash = -.14; if (vis && T - (KR.sfxT || 0) > .2) { KR.sfxT = T; sfx('swing'); }
  }
}

/* ---------- Hauptleute: Sonderangriffe, immer mit Ankündigung ---------- */
function krSonderStart(u) {
  const k = u.kr, r = u.def.kr[0], A = r === 'aurelien', N = r === 'nordmark'; k.n = (k.n || 0) + 1; k.mt = u.hp < u.maxHp * .5 ? 3.6 : 4.8;
  const dx = P.x - u.x, dy = P.y - u.y, a = Math.atan2(dy, dx);
  if ((A || N) && k.n % 2) { const s = krShot('bahn', u.x, u.y, { team: k.team, ang: a, src: u, t: .9 }); if (!s) return; k.sp = { art: 'bahn', t: s.max, s, bis: T + s.max + .25 }; u.aim = a; krRuf2(u, A ? _t('Schildstoß!') : _t('Für die Eisenkrone!')); }
  else if (N) { krShot('ballista', P.x, P.y, { team: k.team, sx: u.x, sy: u.y, src: u }); k.sp = { art: 'ruf', t: .7 }; krRuf2(u, _t('Balliste – zielt!')); }
  else if (r === 'sylvara') { if (k.n % 2) { krShot('pfeil', P.x, P.y, { team: k.team }); krRuf2(u, _t('Dornenregen!')); } else { krShot('ring', u.x, u.y, { team: k.team, src: u }); krRuf2(u, _t('Dornen!')); } k.sp = { art: 'ruf', t: k.n % 2 ? .7 : 1.1 }; }
  else if (A) { krShot('pfeil', P.x, P.y, { team: k.team }); k.sp = { art: 'ruf', t: .7 }; for (const o of KR.list) if (!o.dead && o.kr.team === k.team && Math.hypot(o.x - u.x, o.y - u.y) < 80) { o.hp = Math.min(o.maxHp, o.hp + o.maxHp * .15); } rings.push({ x: u.x, y: u.y, r: 4, max: 80, life: .5, max2: .5, col: '#ffe08a' }); krRuf2(u, _t('Schützen – Feuer!')); }
  else if (k.n % 2) { krShot('ring', u.x, u.y, { team: k.team, src: u }); k.sp = { art: 'ring', t: 1.1 }; krRuf2(u, _t('Brennt!')); }
  else { krShot('magie', P.x, P.y, { team: k.team, n: u.hp < u.maxHp * .5 ? 4 : 3 }); k.sp = { art: 'ruf', t: .7 }; krRuf2(u, _t('Asche zu Asche!')); }
  u.st = 'move'; sfx('spec');
}
function krRuf2(u, s) { if (krVis(u.x, u.y)) txt(u.x, u.y - 30 * u.sc, s, '#ffd24a'); }
function krSonder(u, dt) {
  const k = u.kr, S = k.sp; S.t -= dt; k.mvx = k.mvy = 0;
  if (S.art === 'bahn' && S.t <= 0) {   // Sturm entlang der angekündigten Bahn
    if (!S.lauf) { if (T > S.bis) { k.sp = null; return; } S.lauf = .34; S.ang = S.s.ang; S.hit = false; sfx('lunge'); }   // zu spät (betäubt)? Dann ohne Ankündigung kein Sturm
    S.lauf -= dt; const v = S.s.len / .34; k.mvx = Math.cos(S.ang) * v; k.mvy = Math.sin(S.ang) * v; k.fx = k.mvx; if (Math.random() < .6) dust(u.x, u.y, 1);
    if (!S.hit && state === 'play' && krIn(S.s, P.x, P.y) && Math.hypot(P.x - u.x, P.y - u.y) < u.r * u.sc + P.r + 6) { S.hit = true; const h0 = P.hp; hurtPlayer(S.s.dmg, u); if (P.hp < h0) krLog('bahn', S.s.max, 0); }
    for (const o of KR.al) if (!o.dead && !S['h' + o.seed] && Math.hypot(o.x - u.x, o.y - u.y) < 14) { S['h' + o.seed] = 1; krDmg(o, o.maxHp * .3, Math.cos(S.ang), Math.sin(S.ang)); }
    if (S.lauf <= 0) { k.sp = null; u.cd = .8; }
  } else if (S.art !== 'bahn' && S.t <= 0) { k.sp = null; u.cd = .6; }
}

/* ---------- Kriegsmaschinen ---------- */
function krMasch(art, team, u, v) {
  const p = krPos(u, v), m = { art, team, x: p.x, y: p.y, cd: rnd(4.5, 7), e: null, cap: 0, an: 0, weg: false };
  if (team !== KR.side) {
    const e = spawnEnemy('kr_maschine', { x: p.x, y: p.y, instant: true }); e.name = KR_MASCH[art].n; e.mach = m; e.draw = krMaschDrawE; e.spd = 0; m.e = e;
    e.hp = e.maxHp = Math.round(e.maxHp * 5);   // zerstören dauert – erobern geht schneller, wenn die Wachen fort sind
  } else m.di = { y: p.y, draw: () => krMaschDraw(m) };
  KR.machs.push(m); return m;
}
function krMaschWeg(m, erobert) {
  if (m.weg) return; m.weg = true;
  if (erobert) { m.weg = false; m.team = KR.side; m.cap = 0; m.cd = 2.5; if (m.e) { m.e.dead = true; m.e = null; } m.di = { y: m.y, draw: () => krMaschDraw(m) }; KR.caps++; stat('krCap'); krMoral(12); banner(_t('{name} EROBERT', { name: KR_MASCH[m.art].n.toLocaleUpperCase(LOCALE) }), _t('Sie feuert jetzt für {reich}.', { reich: REICHE[KR.side].n })); sfx('clear'); }
  else { m.e = null; krMoral(8); krDecal('krater', m.x, m.y, 14); for (let i = 0; i < 14; i++) part(m.x, m.y, rnd(2, 12), rnd(-70, 70), rnd(-40, 40), rnd(40, 110), pick(WOOD), rnd(.4, .9), 2); krRauch(m.x, m.y, 6); shake(5); sfx('boom'); if (m !== KR.zm) toast(_t('{name} zerstört!', { name: KR_MASCH[m.art].n }), '#ffd24a'); }
  if (m === KR.zm && KR.ziel === 'maschine') krEnd(true);
}
function krMaschUpd(dt) {
  let ziel = 0; for (const s of KR.shots) if (!s.own && s.aufP) ziel++;
  for (const m of KR.machs) {
    if (m.weg) continue; m.an = Math.max(0, m.an - dt * 1.6);
    const eig = m.team === KR.side;
    if (m.e) {
      m.e.x = m.x; m.e.y = m.y; m.e.kbx = m.e.kby = 0;
      // Erobern: daneben stehen, kein feindlicher Soldat in der Nähe
      const nah = state === 'play' && Math.hypot(P.x - m.x, P.y - m.y) < 30; let wache = false;
      if (nah) for (const e of enemies) if (e.kr && !e.dead && !e.kr.flucht && Math.hypot(e.x - m.x, e.y - m.y) < 70) { wache = true; break; }
      m.block = nah && wache;
      if (nah && !wache) { m.cap += dt / 3.2; if (m.cap >= 1) { krMaschWeg(m, true); continue; } } else m.cap = Math.max(0, m.cap - dt * .5);
      if (m.cap > 0) continue;   // die Besatzung hat anderes zu tun
    }
    if (KR.aus) continue;
    m.cd -= dt; if (m.cd > 0) continue;
    const C = KR_MASCH[m.art].cd; m.cd = rnd(C[0], C[1]) * (eig ? (krRang(KR.side) >= 3 ? .95 : 1.25) : 1); m.an = 1;
    let x, y, aufP = false;
    if (eig) { const fs = KR.list.filter(o => !o.ally && !o.dead && !o.mach); const t = fs.length ? pick(fs) : null, p = t || krPos(rnd(.6, .85), rnd(.15, .85)); x = p.x + rnd(-10, 10); y = p.y + rnd(-8, 8); }
    else if (ziel < 2 && state === 'play' && Math.random() < .55) { x = P.x + P.vx * .3 + rnd(-8, 8); y = P.y + P.vy * .3 + rnd(-6, 6); aufP = true; ziel++; }
    else { const t = KR.al.length && Math.random() < .6 ? pick(KR.al) : krPos(rnd(.12, .55), rnd(.1, .9)); x = t.x + rnd(-12, 12); y = t.y + rnd(-10, 10); }
    const s = krShot(m.art, x, y, { team: m.team, from: m }); if (s && aufP) s.aufP = 1;
    if (krVis(m.x, m.y, 60)) sfx(m.art === 'magie' ? 'cast' : m.art === 'pfeil' || m.art === 'ballista' ? 'bow' : 'wood');
  }
}

/* ---------- Beschuss: ankündigen, einschlagen ---------- */
// Trifft nur, wer bei Einschlag in der gezeichneten Fläche steht (Ellipse wie am Boden, Bahn als Streifen)
function krIn(s, x, y) {
  if (s.k === 'bahn' || s.k === 'bolzen') { const c = Math.cos(s.ang), n = Math.sin(s.ang), dx = x - s.x, dy = y - s.y, l = dx * c + dy * n, q = -dx * n + dy * c; return l > -4 && l < s.len + 6 && Math.abs(q) < s.w / 2 + 2; }
  const dx = (x - s.x) / s.r, dy = (y - s.y) / (s.r * .6); return dx * dx + dy * dy < 1;
}
function krShot(art, x, y, o) {
  o = o || {}; const team = o.team || KR.foe || 'x', own = KR.on && team === KR.side, base = krDmgBase();
  if (!bg || bg.draw == null) { x = clamp(x, BD.x0 + 6, BD.x1 - 6); y = clamp(y, BD.y0 + 4, BD.y1 - 4); }
  const mkS = (k, px_, py_, r, t, m, ex) => { const s = Object.assign({ k, x: px_, y: py_, r, t: Math.max(KR_WARN_MIN, t), dmg: base * m, team, own, hit: 0 }, ex); s.max = s.t; KR.shots.push(s); return s; };
  if (KR.shots.length > 14) return null;
  if (art === 'pfeil') { const n = krQ() > .8 ? 14 : 10, s = mkS('pfeil', x, y, 34, 1.3, .55, { pf: [], from: o.from }); for (let i = 0; i < n; i++) { const a = i * 2.4 + rnd(0, .5), q = Math.sqrt((i + .5) / n); s.pf.push([Math.cos(a) * q * 30, Math.sin(a) * q * 17, rnd(0, .3)]); } return s; }
  if (art === 'katapult') return mkS('katapult', x, y, 38, 1.7, 1.5, { from: o.from });
  if (art === 'magie') { let f = null; const n = o.n || 3; for (let i = 0; i < n; i++) { const a = rnd(0, 6.283), d = i ? rnd(24, 60) : 0, s = mkS('meteor', x + Math.cos(a) * d, y + Math.sin(a) * d * .7, 21, 1.2 + i * .3, 1, { from: o.from }); f = f || s; } return f; }
  if (art === 'ring') return mkS('ring', x, y, o.r || 46, o.t || 1, 1.2, { src: o.src });
  if (art === 'bahn') return mkS('bahn', x, y, 0, o.t || .9, 1.3, { ang: o.ang || 0, len: o.len || 150, w: 14, src: o.src });
  // Balliste: Bolzen von der Maschine (oder sx/sy) bis über das Ziel hinaus, angekündigt als Streifen am Boden
  if (art === 'ballista') { const sx = o.sx != null ? o.sx : o.from ? o.from.x : x - 120, sy = o.sy != null ? o.sy : o.from ? o.from.y : y, a = Math.atan2(y - sy, x - sx), len = clamp(Math.hypot(x - sx, y - sy) + 50, 60, 260); return mkS('bolzen', sx + Math.cos(a) * 10, sy + Math.sin(a) * 10, 0, 1.1, 1.2, { ang: a, len, w: 12, from: o.from, src: o.src }); }
  return null;
}
function krLog(k, warn, cov) { KR.log.push({ k, warn, cov, t: T }); if (KR.log.length > 60) KR.log.shift(); }
// Deckung: im Graben, oder dicht hinter Schildwall/Wagen (auf der eigenen Seite davon)
function krCover(x, y) {
  if (!KR.on) return 0;
  for (const g of KR.graben) if (x > g.x0 - 1 && x < g.x1 + 1 && y > g.y0 - 2 && y < g.y1 + 2) return 1;
  const geo = KR.geo, dir = geo.a1 > geo.a0 ? 1 : -1;
  for (const c of KR.cover) { const da = ((geo.hz ? c.x - x : c.y - y)) * dir, db = Math.abs(geo.hz ? c.y - y : c.x - x); if (da > 0 && da <= c.dp && db <= c.hw) return 1; }
  return 0;
}
function krImpact(s) {
  const x = s.x, y = s.y, nah = Math.hypot(P.x - x, P.y - y), vis = krVis(x, y, 50), q = krQ();
  // Held
  if (!s.own && s.k !== 'bahn' && state === 'play' && P.hp > 0 && !(P.z > 6) && krIn(s, P.x, P.y)) {
    const cov = krCover(P.x, P.y); let d = s.dmg;
    if (cov && s.k === 'pfeil') { d = 0; txt(P.x, P.y - 26, _t('GEDECKT'), '#8ee6ea'); spark(P.x, P.y - 14, -1.57, '#fff3c0'); sfx('deflect'); } else if (cov) d *= .5;
    if (d > 0) { const h0 = P.hp; hurtPlayer(d, { x, y }); if (P.hp < h0) { krLog(s.k, s.max, cov); krMoral(-2); if (s.k === 'katapult') { const n = nah || 1; P.vx += (P.x - x) / n * 220; P.vy += (P.y - y) / n * 220; } } }
  }
  // Soldaten der anderen Seite (Lande: alle)
  if (s.k !== 'bahn') for (const u of KR.list) if (!u.dead && u.kr.team !== s.team && !u.mach && krIn(s, u.x, u.y)) { const n = Math.hypot(u.x - x, u.y - y) || 1; krDmg(u, u.maxHp * (s.k === 'katapult' ? .5 : s.k === 'pfeil' ? .22 : .34) * (u.ally && krCover(u.x, u.y) ? .5 : 1), (u.x - x) / n, (u.y - y) / n); }
  if (s.k === 'bahn') return;
  if (s.k === 'bolzen') { if (vis) { sfx('hit'); for (let i = 0; i < 6; i++) if (Math.random() < q) { const l = rnd(0, s.len); dust(x + Math.cos(s.ang) * l, y + Math.sin(s.ang) * l, 1); } } if (nah < 60) shake(3); return; }
  // Wucht: je näher, desto stärker (Wackeln und Blitzen achten auf „Ruhiges Bild“)
  const w = nah < 60 ? 1 : nah < 150 ? .55 : .25;
  if (s.k === 'katapult') {
    krDecal('krater', x, y, 15); shake(9 * w); if (nah < 90) { hitStop = Math.max(hitStop, .05); buzz(40); flash = { a: Math.max(flash.a || 0, .28), c: '255,220,170' }; }
    if (vis) { sfx('boom'); rings.push({ x, y, r: 5, max: s.r * 1.1, life: .4, max2: .4, col: '#e8d8a8' }); fx.push({ k: 'boom', x, y, r: 20, life: .3, max: .3 }); for (let i = 0; i < Math.round(22 * q); i++) { const a = rnd(0, 6.28), v = rnd(40, 150); part(x, y, rnd(2, 8), Math.cos(a) * v, Math.sin(a) * v * .6, rnd(60, 150), pick(['#6a5e52', '#8a7e70', '#4a4038', '#3a3028']), rnd(.4, .9), Math.random() < .5 ? 2 : 1); } krRauch(x, y, 5); }
  } else if (s.k === 'meteor' || s.k === 'ring') {
    krDecal('brand', x, y, s.k === 'ring' ? 30 : 15); shake(6 * w); if (nah < 80) { buzz(25); flash = { a: Math.max(flash.a || 0, .22), c: '255,150,70' }; }
    if (vis) { sfx('fire'); fxAnim('boom', x, y - 8, { sc: s.k === 'ring' ? 1.6 : 1, dur: .5 }); fx.push({ k: 'boom', x, y, r: s.r, life: .45, max: .45 }); rings.push({ x, y, r: 4, max: s.r * 1.15, life: .35, max2: .35, col: '#ffb03a' }); for (let i = 0; i < Math.round(16 * q); i++) { const a = rnd(0, 6.28), v = rnd(30, 120); part(x, y, rnd(2, 10), Math.cos(a) * v, Math.sin(a) * v * .6, rnd(50, 130), pick(['#fff0a0', '#ffb03a', '#ff6a2a', '#e8402a']), rnd(.3, .8), 1, 160, 1); } krRauch(x, y, 3); }
    KR.fires.push({ x, y, r: s.k === 'ring' ? 30 : 17, life: 4.6, max: 4.6, tick: KR_WARN_MIN + .05, dmg: s.dmg * .3, team: s.team, own: s.own }); if (KR.fires.length > 7) KR.fires.shift();
  } else if (s.k === 'pfeil') {
    if (vis) { sfx('hit'); for (const p of s.pf) if (Math.random() < q) dust(x + p[0], y + p[1], 1); }
    if (nah < 50) shake(2);
  }
}
function krShotUpd(dt) {
  for (const s of KR.shots) {
    s.t -= dt;
    if (s.src && s.src.dead && !s.hit) { s.t = -9; s.hit = 1; continue; }   // Hauptmann gefallen: sein Angriff verfällt
    if (s.t <= 0 && !s.hit) { s.hit = 1; krImpact(s); }
    if (s.k === 'meteor' && s.t < .55 && s.t > 0 && Math.random() < .6 * krQ()) { const h = s.t / .55 * 170; part(s.x + h * .35 + rnd(-2, 2), s.y, h, rnd(-10, 10), 0, rnd(-10, 20), pick(['#ffb03a', '#ff6a2a']), .35, 1, 0, 1); }
  }
  let w = 0; for (const s of KR.shots) { if (s.hit && s.t < (s.k === 'pfeil' ? -.45 : 0)) { if (s.k === 'pfeil' && krVis(s.x, s.y, 40)) for (let i = 0; i < s.pf.length; i += 2) krDecal('pfeil', s.x + s.pf[i][0], s.y + s.pf[i][1], i % 4 === 0); continue; } KR.shots[w++] = s; } KR.shots.length = w;
  // brennender Boden
  for (const f of KR.fires) {
    f.life -= dt; f.tick -= dt;
    if (f.tick <= 0) {
      f.tick = .6;
      if (!f.own && state === 'play' && P.hp > 0 && P.z < 2 && krIn(f, P.x, P.y)) { const h0 = P.hp; hurtPlayer(f.dmg * (krCover(P.x, P.y) ? .5 : 1), null); if (P.hp < h0) krLog('feuer', f.max - f.life, 0); }
      for (const u of KR.list) if (!u.dead && u.kr.team !== f.team && !u.mach && krIn(f, u.x, u.y)) krDmg(u, u.maxHp * .07, 0, 0);
    }
    if (krVis(f.x, f.y, 30)) { if (Math.random() < .5 * krQ()) part(f.x + rnd(-f.r, f.r) * .7, f.y + rnd(-f.r, f.r) * .35, rnd(2, 10), rnd(-6, 6), 0, rnd(20, 50), pick(['#ffd24a', '#ff8a3a', '#ff6a2a']), rnd(.5, 1), 1, -30, 1); if (Math.random() < .12 * krQ()) krRauch(f.x + rnd(-8, 8), f.y, 1); }
  }
  KR.fires = KR.fires.filter(f => f.life > 0);
  // Geschosse zwischen Soldaten
  for (const b of KR.bolts) { b.life -= dt; b.x += b.vx * dt; b.y += b.vy * dt; if (b.life <= 0) { if (b.tg && !b.tg.dead && b.tg !== P) { const n = Math.hypot(b.vx, b.vy) || 1; krDmg(b.tg, b.dmg, b.vx / n, b.vy / n); } } }
  KR.bolts = KR.bolts.filter(b => b.life > 0);
  // Rauch
  for (const r of KR.rauch) { r.life -= dt; r.z += r.vz * dt; r.x += r.vx * dt; }
  if (KR.rauch.length && KR.rauch[0].life <= 0) KR.rauch = KR.rauch.filter(r => r.life > 0);
}
function krRauch(x, y, n) { const max = Math.round(56 * krQ()); for (let i = 0; i < n && KR.rauch.length < max; i++) { const l = rnd(1.4, 2.6); KR.rauch.push({ x: x + rnd(-6, 6), y: y + rnd(-3, 3), z: rnd(2, 10), vx: rnd(4, 12), vz: rnd(12, 24), life: l, max: l, s: i % 3 }); } }

/* ---------- Ziele, Verstärkung, Ende ---------- */
function krUpd(dt) {
  KR.fx = HD ? 10 : 6;
  // Liste aller Soldaten (für Ziele, Beschuss, Abstand)
  const L = KR.list; L.length = 0; let nF = 0;
  for (const e of enemies) if (e.kr && !e.dead) { L.push(e); if (!e.kr.wache) nF++; }
  if (KR.al.length) { let w = 0; for (const u of KR.al) if (!u.dead) { KR.al[w++] = u; L.push(u); } KR.al.length = w; }
  KR.nF = nF; KR.nA = KR.al.length;
  if (!L.length && !KR.shots.length && !KR.fires.length && !KR.on && !KR.rauch.length && !KR.bolts.length) return;
  if (state === 'play' || state === 'dead') {
    for (const u of L) krAI(u, dt);
    // Abstand: Verbündete weichen allen aus (Gegner untereinander: separate in js/combat.js)
    for (const a of KR.al) for (const b of L) { if (a === b) continue; const dx = a.x - b.x, dy = a.y - b.y, m = (a.r * a.sc + b.r * b.sc) * .9; if (Math.abs(dx) < m && Math.abs(dy) < m) { const d = Math.hypot(dx, dy) || .01; if (d < m) { const p = (m - d) * .5; a.x += dx / d * p; a.y += dy / d * p; } } }
    krShotUpd(dt);
  }
  if (!KR.on || !G || G.type !== 'krieg') return;
  if (!KR.ban) { KR.ban = 1; banner(KR_ZIEL[KR.ziel].n.toLocaleUpperCase(LOCALE), _t('Kriegsgebiet · du kämpfst für {reich}', { reich: REICHE[KR.side].n })); }   // nach dem Raum-Banner von startRoom
  KR.t += dt; krMaschUpd(dt); krAmbient(dt);
  if (KR.aus) {
    for (const c of pickups) c.mag = 1;
    KR.endT -= dt; if (KR.endT <= 0 && state === 'play') krResult();
    return;
  }
  if (state !== 'play') return;
  // Verstärkung von beiden Enden, bis die Obergrenze erreicht ist
  const S = REICHE[KR.side], F = REICHE[KR.foe];
  if ((KR.vt -= dt) <= 0) { KR.vt = KR.vr * rnd(.8, 1.2) * (KR.ziel === 'linie' ? Math.max(.55, 1 - KR.t / 150) : 1);   // Linie halten: der Druck wächst
    if (KR.vres > 0 && KR.nF < KR_SIDE) { const p = krPos(.98, rnd(.1, .9)), e = krFoe(pick(F.einh), p.x, p.y); if (e) { KR.vres--; e.kr.hold = KR.ziel === 'linie' ? .2 : .45; } } }
  if ((KR.at -= dt) <= 0) { KR.at = KR.ar * rnd(.8, 1.2); if (KR.nA < KR_SIDE - 2) { const p = krPos(.02, rnd(.1, .9)), u = krAlly(pick(S.einh), p.x, p.y); if (u) u.kr.hold = KR.ziel === 'maschine' || KR.ziel === 'hauptmann' ? .6 : .46; } }
  const Z = KR.ziel;
  if (Z === 'linie') {
    KR.zt -= dt; let durch = 0; for (const e of L) if (!e.ally && krU(e.x, e.y) < .3) durch++;
    krMoral(-(.7 + Math.min(3, durch) * 1.5) * dt);   // der Druck auf die Linie: ohne Siege im Feld bröckelt sie
    if (KR.zt <= 0 && !KR.aus) krEnd(true);
  } else if (Z === 'hauptmann' && !KR.hpt && (KR.ht -= dt) <= 0) {
    if (krCount() >= KR_CAP) { const o = L.find(q => !q.ally && !q.kr.wache); if (o) o.dead = true; }   // Platz machen: die Obergrenze gilt auch für den Hauptmann
    const p = krPos(.95, .5), e = krFoe(F.hpt, p.x, p.y); if (!e) { KR.ht = 1; return; }
    e.name = F.hptN; e.hp = e.maxHp = Math.round(e.maxHp * 7.5); e.kr.hold = .55; e.kr.mt = 2.5; KR.hpt = e; banner(F.hptN.toLocaleUpperCase(LOCALE), _t('An der Spitze von {reich} – besiege den Anführer!', { reich: F.n })); shake(4); sfx('spec');
    for (const v of [.4, .6]) { const q = krPos(.93, v); krFoe(F.einh[0], q.x, q.y); }
  } else if (Z !== 'linie') krMoral(-.35 * dt);   // die Zeit arbeitet für den Feind
}
// Lagerfeuer, Glutwerfer, Krater: Rauch und Funken
function krAmbient(dt) {
  const q = krQ();
  for (const f of KR.feuer) if (krVis(f.x, f.y, 30)) { if (Math.random() < dt * 7 * q) part(f.x + rnd(-3, 3), f.y - 2, rnd(4, 10), rnd(-5, 5), 0, rnd(20, 45), Math.random() < .5 ? '#ffd24a' : '#ff8a3a', rnd(.5, 1), 1, -24, 1); if (Math.random() < dt * 1.6 * q) krRauch(f.x, f.y - 4, 1); }
  for (const m of KR.machs) if (!m.weg && m.art === 'magie' && krVis(m.x, m.y, 30) && Math.random() < dt * 5 * q) part(m.x + rnd(-4, 4), m.y, rnd(16, 24), rnd(-6, 6), 0, rnd(15, 35), '#ff9a2a', rnd(.4, .8), 1, -20, 1);
}
function krEnd(win, grund) {
  if (!KR.on || KR.aus) return;
  KR.aus = win ? 1 : -1; KR.endT = win ? 2.6 : 2; KR.grund = grund || ''; KR.shots.length = 0; for (const f of KR.fires) f.own = true;
  const M = krM(), R = M.r[KR.side], S = REICHE[KR.side], st = G.stage || stageNum(), ruf0 = R.ruf, rang0 = krRang(KR.side);
  if (win) { for (const e of enemies) if (e.kr && !e.dead) e.kr.flucht = 1; } else for (const u of KR.al) u.kr.flucht = 1;   // die Verlierer räumen das Feld
  if (win) {
    // Lohn je Reich: Aurelien Gold, Karth Kriegseisen, Nordmark Kriegsruf, Sylvara Bannerstoff · ab Hauptmann +10 % Gold und Kriegsruf
    const rv = rang0 >= 1 ? 1.1 : 1, gold = Math.round((12 + st * 9) * 2.2 * (1 + P.st.gold) * (KR.side === 'aurelien' ? 1.3 : 1) * rv), eisen = 2 + ri(0, 2) + (KR.side === 'karth' ? 2 : 0), stoff = 1 + ri(0, 1) + (KR.side === 'sylvara' ? 2 : 0), mk = 3 + KR.caps,
      ruf = Math.round((25 + KR.caps * 5 + (KR.moral >= 80 ? 5 : 0)) * (KR.side === 'nordmark' ? 1.25 : 1) * rv);
    P.gold += gold; stat('goldTotal', gold); gainMat('kriegseisen', eisen); gainMat('bannerstoff', stoff); krGain(KR.side, ruf, mk);
    // Wer gegen ein Reich gewinnt, verliert dort etwas Kriegsruf
    const FD = M.r[KR.foe], verrat = FD ? Math.min(FD.ruf, KR_VERRAT) : 0; if (FD) FD.ruf -= verrat;
    R.sg++; M.sg++; stat('krWin'); stat('krW_' + KR.side); P.stats.rooms++; SAVE.meta.hide.rooms++;
    const ak = (KR_AKT1[KR.side] || []).findIndex(c => c.ab === R.sg);
    dropLoot(P.x + rnd(-14, 14), P.y + 10, 1); if (KR.ziel === 'hauptmann' || KR.caps) dropLoot(P.x + rnd(-14, 14), P.y + 14, 2);
    KR.lohn = { win: 1, got: [{ t: 'gold', n: gold }, { t: 'mat', k: 'kriegseisen', n: eisen }, { t: 'mat', k: 'bannerstoff', n: stoff }], mk, ruf, ruf0, rang0, verrat, akt: ak >= 0 ? ak : -1 };
    banner(_t('SIEG'), _t('{reich} behauptet das Feld', { reich: S.n })); sfx('clear'); slowmo = .5; if (!(G.extra && G.extra.fz)) markNodeDone();
  } else {
    krGain(KR.side, 5, 0); R.nl++;
    KR.lohn = { win: 0, got: [], mk: 0, ruf: 5, ruf0, rang0 };
    banner(_t('NIEDERLAGE'), grund === 'banner' ? _t('Der Bannerträger ist gefallen') : _t('Die Moral ist gebrochen')); sfx('fail');
  }
  if (typeof kkSchlacht === 'function') KR.lohn.fz = kkSchlacht(win);   // Feldzug der Kriegskarte (6.9)
  P.buffs = P.buffs.filter(b => b.rooms > 0); computeStats(); setMusic(biomeOf(P.act).root, false);
  saveChar(); persist(); checkAch();
}
function krRufBar(s, ruf0) {
  const R = REICHE[s], v = krRuf(s), i = krRang(s), nx = KR_RAENGE[i + 1], lo = KR_RAENGE[i][0], p = nx ? clamp((v - lo) / (nx[0] - lo), 0, 1) : 1;
  return `<div class="krbar" style="--c:${R.c}"><i style="width:${(p * 100).toFixed(1)}%"></i><span>${esc(KR_RAENGE[i][1]).toLocaleUpperCase(LOCALE)} · ${fmt(v)}${nx ? ' / ' + fmt(nx[0]) : ''}${ruf0 != null && v > ruf0 ? ' (+' + (v - ruf0) + ')' : ''}</span></div>`;
}
function krResult() {
  const L = KR.lohn, S = REICHE[KR.side], F = REICHE[KR.foe]; if (!L) return;
  setState('menu'); showHud(false); $('krhud').hidden = true; KRH.on = false;
  const zeit = Math.floor(KR.t / 60) + ':' + String(Math.floor(KR.t % 60)).padStart(2, '0'), auf = krRang(KR.side) > L.rang0;
  const kopf = `<div class="hd" style="display:flex;gap:10px;align-items:center;justify-content:center;margin-bottom:6px"><img src="${iconURL(['pa', 'kr_w_' + KR.side])}" alt="" style="width:40px;height:40px;image-rendering:pixelated"><h2 style="margin:0;color:${L.win ? S.c : 'var(--blood)'}">${L.win ? _t('SIEG FÜR {reich}', { reich: esc(S.n).toLocaleUpperCase(LOCALE) }) : _t('DIE SCHLACHT IST VERLOREN')}</h2></div>`;
  const rgN = krRang(KR.side), ak = L.akt >= 0 ? KR_AKT1[KR.side][L.akt] : null;
  const ruf = `<div class="krlohn"><div class="st" style="font-size:17px">${_t('Kriegsruf bei {reich}: +{n}', { reich: esc(S.n), n: L.ruf })}${L.mk ? ' · ' + _t('+{n} {marken}', { n: L.mk, marken: esc(S.mk) }) : ''}</div>${krRufBar(KR.side, L.ruf0)}${auf ? `<p class="sub" style="color:${S.c};margin:6px 0 0">${_t('Neuer Rang: {rang}', { rang: esc(KR_RAENGE[rgN][1]) })}${KR_VORTEIL[rgN] ? ' · ' + esc(KR_VORTEIL[rgN]()) : ''}</p>` : ''}${L.verrat ? `<p class="sub" style="margin:4px 0 0">${_t('Kriegsruf bei {reich}: −{n}', { reich: esc(F.n), n: L.verrat })}</p>` : ''}</div>`
    + (L.fz ? `<div class="krziel krlohn" style="box-shadow:inset 3px 0 0 ${S.c}"><b>${_t('KRIEGSKARTE')}</b>${esc(L.fz.t)}</div>` : '')
    + (ak ? `<div class="krziel krlohn" style="box-shadow:inset 3px 0 0 ${S.c}"><b>${_t('NEUES KAPITEL IN DER CHRONIK')}</b>${esc(ak.t())}<div class="krks"><button class="btn" data-act="kr_akt" data-id="${KR.side}:${L.akt}:res">${_t('Jetzt lesen')}</button></div></div>` : '');
  if (L.win) showOverlay(`<div class="center">${kopf}<p class="sub">${_t('{ziel} · {zeit} min · {n} Feinde gefallen', { ziel: esc(KR_ZIEL[KR.ziel].n), zeit, n: KR.gef })}${KR.caps ? ' · ' + (KR.caps === 1 ? _t('1 Maschine erobert') : _t('{n} Maschinen erobert', { n: KR.caps })) : ''}</p>
    <h3>${_t('KRIEGSBEUTE')}</h3><div class="krlohn">${L.got.map((e, i) => rwRow(e, i)).join('')}</div>${ruf}
    <div class="menu foot"><button class="btn" data-act="kr_weiter">${_t('Weiter')}</button></div></div>`);
  else showOverlay(`<div class="center">${kopf}<p class="sub">${KR.grund === 'banner' ? _t('Der Bannerträger ist gefallen – {reich} nimmt das Feld.', { reich: esc(F.n) }) : _t('Die Moral deines Heeres ist gebrochen – {reich} nimmt das Feld.', { reich: esc(F.n) })} ${_t('Für deinen Einsatz gibt es trotzdem etwas Kriegsruf.')}</p>${ruf}
    <div class="menu foot"><button class="btn" data-act="kr_nochmal">${_t('Schlacht wiederholen')}</button><button class="btn alt" data-act="kr_rueckzug">${_t('Rückzug zur Karte')}</button></div></div>`);
}
ON.kr_akt = id => {
  const [r, i, von] = String(id).split(':'), C = KR_AKT1[r] && KR_AKT1[r][+i], M = krM(); if (!C || !M.r[r] || M.r[r].sg < C.ab) { sfx('deny'); return; }
  M.ch['a1_' + r + '_' + i] = 1; persist(); sfx('click'); setState('menu');
  dialog(C.L(), () => { if (von === 'res' && KR.lohn) krResult(); else kriegChronik(); }, _t('Chronik der Kronen · Akt 1 · {reich}', { reich: REICHE[r].n }));
};
const krFz = () => !!(G && G.extra && G.extra.fz);   // Schlacht eines Feldzugs, direkt von der Kriegskarte (kein Ort der Weltkarte)
ON.kr_weiter = () => { const h = DIFFS[P.diff].heal, fz = krFz(); P.hp = Math.min(P.st.hp, P.hp + P.st.hp * h); KR.on = false; saveChar(); if (fz && typeof kkOpen === 'function') { G = null; kkOpen(); } else openMap(); };
ON.kr_nochmal = () => { P.hp = Math.max(P.hp, P.st.hp * .7); startRoom('krieg', G.row, { krSeite: KR.side, krFeind: KR.foe, krZiel: KR.ziel, fz: krFz() ? 1 : 0 }); };
ON.kr_rueckzug = () => { const fz = krFz(); P.hp = Math.max(P.hp, P.st.hp * .5); KR.on = false; if (!fz) markNodeDone(); saveChar(); if (fz && typeof kkOpen === 'function') { G = null; kkOpen(); } else openMap(); };

/* ---------- Endlose Lande: Beschuss in den Kriegs-Biomen ---------- */
function krLande(dt) {
  const bk = LW.reg ? LW.reg.biome : null, B = KR_LANDE[bk]; if (!B) { KR.lt = Math.max(KR.lt, 3); return; }
  if ((KR.lt -= dt) > 0) return;
  let kampf = false; for (const e of enemies) if (!e.dead && e.st !== 'spawn' && Math.abs(e.x - P.x) < 220 && Math.abs(e.y - P.y) < 220) { kampf = true; break; }
  KR.lt = kampf ? rnd(4, 6.5) : rnd(9, 14);
  if (state !== 'play' || LW.near || LW.ch > 0) return;   // nicht beim Händler, nicht beim Verlassen
  const auf = Math.random() < .35, a = rnd(0, 6.283), d = auf ? 0 : rnd(34, 86);
  krShot(pick(B), P.x + Math.cos(a) * d, P.y + Math.sin(a) * d * .7, { team: 'x' });
}
function krLandeOn() { return typeof LW !== 'undefined' && LW && LW.on && G && G.type === 'lande'; }
HOOK.update.push(dt => {
  try { if (!G) return; if (krLandeOn()) krLande(dt); krUpd(dt); }
  catch (e) { console.error('Krieg:', e); KR.shots.length = 0; KR.bolts.length = 0; }
});
// Schlacht: der Raum gehört uns (keine Wellen), Tod wie überall
HOOK.roomUpd.push(h => h || (!!G && G.type === 'krieg'));

/* ---------- Zeichnen ---------- */
function krDrawUnit(u) {
  const h = drawActor(u, false), D = u.def, sx = rpx(u.x - CX), sy = rpx(u.y - CY);
  if (D.wpn) {
    const spr = namedWeapon(D.wpn), sgn = Math.cos(u.aim) >= 0 ? 1 : -1; let off = 1.1;
    if (u.st === 'kwind') { const p = 1 - u.stT / u.windDur; off = lerp(1.1, -1.7, easeOut(clamp(p, 0, 1))); } else if (u.st === 'act') off = .6;
    if (spr.bow) drawWeapon(spr, h.x, h.y, u.st === 'kwind' || u.st === 'act' ? u.aim : (u.face > 0 ? .35 : Math.PI - .35), h.sc); else drawWeapon(spr, h.x, h.y, (u.kr.tg ? u.aim : (u.face > 0 ? 0 : Math.PI)) + off * sgn, h.sc);
  }
  // Verbündete: Wimpel in der Farbe des Reichs, Leben nur wenn verletzt
  const R = REICHE[u.kr.team], top = sy - Math.round(h.top) - 4;
  ctx.fillStyle = '#1a1420'; ctx.fillRect(sx - 2, top - 3, 5, 3); ctx.fillRect(sx - 1, top, 3, 1); ctx.fillStyle = R.c; ctx.fillRect(sx - 1, top - 2, 3, 2); ctx.fillRect(sx, top, 1, 1);
  if (u.hp < u.maxHp) { const w = 12; ctx.fillStyle = '#000'; ctx.fillRect(sx - w / 2 - 1, top - 7, w + 2, 3); ctx.fillStyle = '#79c24e'; ctx.fillRect(sx - w / 2, top - 6, Math.max(0, Math.round(w * u.hp / u.maxHp)), 1); }
  if (u === KR.traeger) krFahne(sx - u.turn * 5, sy - 6, u.kr.team, T * 5, 22, 1);
}
// Banner im Wind: Stange und Tuch aus Spalten, die mit einer Welle auf und ab gehen
function krFahne(x, y, r, ph, h, klein) {
  const R = REICHE[r] || REICHE.aurelien, w = klein ? 8 : 11, th = klein ? 7 : 10; x = Math.round(x); y = Math.round(y);
  ctx.fillStyle = '#2a2028'; ctx.fillRect(x - 1, y - h - 1, 3, h + 2); ctx.fillStyle = WOOD[2]; ctx.fillRect(x, y - h, 1, h); ctx.fillStyle = '#ffe08a'; ctx.fillRect(x - 1, y - h - 2, 3, 2);
  for (let i = 0; i < w; i++) { const o = Math.round(Math.sin(ph + i * .7) * (i / w) * 2.2), cy = y - h + 1 + o; ctx.fillStyle = i === w - 1 ? R.dk : R.c2; ctx.fillRect(x + 1 + i, cy, 1, th); ctx.fillStyle = R.c; ctx.fillRect(x + 1 + i, cy, 1, 2); if (i > 2 && i < w - 3) ctx.fillRect(x + 1 + i, cy + 4, 1, klein ? 2 : 3); ctx.fillStyle = R.dk; ctx.fillRect(x + 1 + i, cy + th - 1, 1, 1); }
}
function krMaschDraw(m) {
  const x = Math.round(m.x - CX), y = Math.round(m.y - CY), spr = krMaschSpr(m.art, m.team, m.an > .45 ? 1 : 0), rz = m.an > .7 ? 1 : 0;
  ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.beginPath(); ctx.ellipse(x, y + 1, 15, 4.5, 0, 0, 6.283); ctx.fill();
  ctx.drawImage(spr, x - 16 - rz, y - 26);
  if (m.art === 'magie') addLight(x, y - 17, 34 + Math.sin(T * 7 + m.x) * 3, .8);
  krFahne(x + 13, y - 2, m.team, T * 4 + m.x, 20, 1);
}
function krMaschDrawE(e) {
  const m = e.mach; if (!m) return; krMaschDraw(m);
  const x = Math.round(e.x - CX), y = Math.round(e.y - CY);
  if (e.flash > 0) { ctx.fillStyle = 'rgba(255,255,255,.45)'; ctx.fillRect(x - 13, y - 22, 26, 22); }
  const w = 26; ctx.fillStyle = '#000'; ctx.fillRect(x - w / 2 - 1, y - 32, w + 2, 4); ctx.fillStyle = '#c8463c'; ctx.fillRect(x - w / 2, y - 31, Math.max(0, Math.round(w * e.hp / e.maxHp)), 2);
  if (m.cap > 0) { ctx.strokeStyle = 'rgba(0,0,0,.6)'; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(x, y - 12, 19, 0, 6.283); ctx.stroke(); ctx.strokeStyle = REICHE[KR.side].c; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(x, y - 12, 19, -Math.PI / 2, -Math.PI / 2 + m.cap * 6.283); ctx.stroke(); ctx.lineWidth = 1; ptext(_t('EROBERN'), x, y - 40, REICHE[KR.side].c, 6); }
  else if (m.block) ptext(_t('BEWACHT'), x, y - 40, '#ff8a7a', 6);
  else if (m === KR.zm && KR.ziel === 'maschine' && !KR.aus) ptext(_t('ZIEL'), x, y - 40 + Math.round(Math.sin(T * 4) * 1.5), '#ffd24a', 6);
}
// Ankündigung am Boden: feste Fläche mit hellem Rand, innen wächst die Füllung bis zum Einschlag. Eigener Beschuss: nur ein dünner Rand.
const KR_COL = { pfeil: ['#fff3c0', '200,48,30'], katapult: ['#ffc24a', '214,60,28'], meteor: ['#ff8a5a', '226,52,30'], ring: ['#ff8a5a', '226,52,30'], bahn: ['#ff8a5a', '226,52,30'], bolzen: ['#bfefff', '200,48,30'] };
function krDrawShot(s) {
  const x = s.x - CX, y = s.y - CY; if (x < -160 || x > VW + 160 || y < -160 || y > VH + 160 || s.hit) return;
  const k = clamp(1 - s.t / s.max, 0, 1), spaet = s.t < .3, C = KR_COL[s.k], pu = .82 + .18 * Math.sin(T * (spaet ? 36 : 13));
  if (s.k === 'bahn' || s.k === 'bolzen') {
    if (s.own) { ctx.save(); ctx.translate(x, y); ctx.rotate(s.ang); ctx.globalAlpha = .45; ctx.strokeStyle = REICHE[KR.side].c; ctx.setLineDash([3, 3]); ctx.strokeRect(0, -s.w / 2, s.len, s.w); ctx.setLineDash([]); ctx.restore(); ctx.globalAlpha = 1; return; }
    ctx.save(); ctx.translate(x, y); ctx.rotate(s.ang); ctx.globalAlpha = .2 + .14 * k; ctx.fillStyle = `rgb(${C[1]})`; ctx.fillRect(0, -s.w / 2, s.len, s.w); ctx.globalAlpha = .34 + .3 * k; ctx.fillRect(0, -s.w / 2, s.len * k, s.w);
    ctx.globalAlpha = spaet ? 1 : pu; ctx.strokeStyle = spaet ? '#ffffff' : C[0]; ctx.lineWidth = 2; ctx.strokeRect(0, -s.w / 2, s.len, s.w); ctx.restore(); ctx.globalAlpha = 1; ctx.lineWidth = 1; return;
  }
  const rx = s.r, ry = s.r * .6;
  if (s.own) { ctx.globalAlpha = .45; ctx.strokeStyle = REICHE[KR.side].c; ctx.lineWidth = 1; ctx.setLineDash([3, 3]); ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, 6.283); ctx.stroke(); ctx.setLineDash([]); ctx.globalAlpha = 1; return; }
  ctx.fillStyle = `rgb(${C[1]})`; ctx.globalAlpha = .26 + .1 * k; ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, 6.283); ctx.fill();
  ctx.globalAlpha = .36 + .3 * k; ctx.beginPath(); ctx.ellipse(x, y, rx * k, ry * k, 0, 0, 6.283); ctx.fill();
  ctx.globalAlpha = .6; ctx.strokeStyle = '#120c10'; ctx.lineWidth = 4; ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, 6.283); ctx.stroke();
  ctx.globalAlpha = spaet ? 1 : pu; ctx.strokeStyle = spaet ? '#ffffff' : C[0]; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, 6.283); ctx.stroke();
  ctx.globalAlpha = .5 + .3 * k; ctx.fillStyle = '#0a0608';
  if (s.k === 'pfeil') for (const p of s.pf) ctx.fillRect(Math.round(x + p[0]) - 1, Math.round(y + p[1]), k > .5 ? 3 : 2, 1);
  else if (s.k === 'katapult') { ctx.beginPath(); ctx.ellipse(x, y, 5 + 9 * k, 3 + 5 * k, 0, 0, 6.283); ctx.fill(); }
  else if (s.k === 'meteor') { ctx.fillStyle = '#ffd24a'; ctx.globalAlpha = .5 + .5 * pu; ctx.fillRect(Math.round(x) - 1, Math.round(y) - 1, 3, 2); }
  ctx.globalAlpha = 1; ctx.lineWidth = 1;
}
function krGround() {
  for (const d of KR.decals) { const x = d.x - CX, y = d.y - CY; if (x < -40 || x > VW + 40 || y < -30 || y > VH + 30) continue; if (d.art === 'krater') krMalKrater(ctx, x, y, d.r); else if (d.art === 'brand') krMalBrand(ctx, x, y, d.r); else krMalPfeil(ctx, x, y, d.r); }
  // Ziel des Bannerträgers
  if (KR.on && KR.traeger && !KR.aus) { const x = KR.bz.x - CX, y = KR.bz.y - CY, c = REICHE[KR.side].c; ctx.globalAlpha = .5 + .3 * Math.sin(T * 4); ctx.strokeStyle = c; ctx.lineWidth = 1.5; ctx.setLineDash([4, 3]); ctx.beginPath(); ctx.ellipse(x, y, 16, 9, 0, 0, 6.283); ctx.stroke(); ctx.setLineDash([]); ctx.globalAlpha = 1; ctx.lineWidth = 1; }
  if (KR.on && G && G.type === 'krieg') {
    const c = REICHE[KR.side].c;
    // „Linie halten“: hier darf der Feind nicht durch
    if (KR.ziel === 'linie' && !KR.aus) { const a = krPos(.3, 0), b = krPos(.3, 1); ctx.globalAlpha = .3 + .1 * Math.sin(T * 3); ctx.strokeStyle = c; ctx.lineWidth = 1; ctx.setLineDash([5, 4]); ctx.beginPath(); ctx.moveTo(a.x - CX, a.y - CY); ctx.lineTo(b.x - CX, b.y - CY); ctx.stroke(); ctx.setLineDash([]); }
    // Ring in der Farbe deiner Seite: du findest dich im Getümmel wieder
    if (state === 'play') { ctx.globalAlpha = .6; ctx.strokeStyle = c; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.ellipse(P.x - CX, P.y - CY, 9, 4.5, 0, 0, 6.283); ctx.stroke(); }
    ctx.globalAlpha = 1; ctx.lineWidth = 1;
  }
  for (const s of KR.shots) krDrawShot(s);
  // brennender Boden: Glut-Fläche, Flammen malt krTop
  for (const f of KR.fires) { const x = f.x - CX, y = f.y - CY, a = clamp(f.life / .6, 0, 1); if (x < -40 || x > VW + 40 || y < -40 || y > VH + 40) continue; ctx.globalAlpha = .34 * a; ctx.fillStyle = '#ff5a1e'; ctx.beginPath(); ctx.ellipse(x, y, f.r, f.r * .6, 0, 0, 6.283); ctx.fill(); ctx.globalAlpha = .7 * a; ctx.strokeStyle = '#ffb03a'; ctx.lineWidth = 1; ctx.beginPath(); ctx.ellipse(x, y, f.r, f.r * .6, 0, 0, 6.283); ctx.stroke(); ctx.globalAlpha = 1; }
}
function krTop() {
  let lichter = HD ? 12 : 7;
  // Flammen auf brennendem Boden
  for (const f of KR.fires) {
    const x = f.x - CX, y = f.y - CY, a = clamp(f.life / .6, 0, 1); if (x < -40 || x > VW + 40 || y < -40 || y > VH + 40) continue;
    ctx.globalAlpha = a; const n = f.r > 24 ? 5 : 3; for (let i = 0; i < n; i++) { const an = i / n * 6.283 + f.x, fr = Math.floor(T * 12 + i * 2) % 6; drawFxFrame('fireball', fr, x + Math.cos(an) * f.r * .5, y + Math.sin(an) * f.r * .28 - 5, .7, -Math.PI / 2); }
    ctx.globalAlpha = 1; if (lichter-- > 0) addLight(x, y - 4, f.r * 2.4, .85 * a);
  }
  // was durch die Luft kommt: Stein, Meteor, Pfeile
  for (const s of KR.shots) {
    const x = s.x - CX, y = s.y - CY; if (x < -200 || x > VW + 200 || y < -220 || y > VH + 200) continue;
    if (s.k === 'katapult' && !s.hit) {
      const q = clamp(1 - s.t / s.max, 0, 1); let bx, by, h;
      if (s.from && s.from.x != null) { bx = lerp(s.from.x - CX, x, q); by = lerp(s.from.y - CY, y, q); h = Math.sin(q * Math.PI) * 110 + (1 - q) * 14; } else { bx = x + (1 - q) * 60; by = y; h = (1 - q) * 240; }
      const rx = Math.round(bx), ry = Math.round(by - h), w = Math.floor(T * 10) % 2;
      ctx.fillStyle = '#1a1420'; ctx.fillRect(rx - 4, ry - 4, 8, 8); ctx.fillStyle = '#6a5e52'; ctx.fillRect(rx - 3, ry - 3, 6, 6); ctx.fillStyle = '#9a8e80'; ctx.fillRect(rx - 3 + w, ry - 3, 3, 2); ctx.fillStyle = '#3a3028'; ctx.fillRect(rx + 1 - w, ry + 1, 2, 2);
    } else if (s.k === 'meteor' && !s.hit && s.t < .55) {
      const h = s.t / .55 * 170, mx = x + h * .35, my = y - h;
      drawFxFrame('fireball', Math.floor(T * 14), mx, my, 1.5, Math.PI * .62); if (lichter-- > 0) addLight(mx, my, 40, .9);
    } else if (s.k === 'pfeil') {
      for (const p of s.pf) { const dt_ = s.t + p[2]; if (dt_ > .28) continue; const ax = Math.round(x + p[0]), ay = Math.round(y + p[1]); if (dt_ > 0) { const h = dt_ / .28 * 120; ctx.fillStyle = '#1a1420'; ctx.fillRect(Math.round(ax + h * .22), Math.round(ay - h - 7), 1, 7); ctx.fillStyle = '#efe2bf'; ctx.fillRect(Math.round(ax + h * .22), Math.round(ay - h - 7), 1, 2); } else krMalPfeil(ctx, ax, ay, 0); }
    } else if (s.k === 'ring' && !s.hit && s.src && lichter-- > 0) addLight(x, y - 8, 30 + 30 * (1 - s.t / s.max), .7);
  }
  // Geschosse zwischen Soldaten
  for (const b of KR.bolts) { const x = Math.round(b.x - CX), y = Math.round(b.y - CY); if (x < 0 || x > VW || y < 0 || y > VH) continue; if (b.fire) { ctx.fillStyle = '#ff6a2a'; ctx.fillRect(x - 1, y - 1, 3, 3); ctx.fillStyle = '#ffe27a'; ctx.fillRect(x, y, 1, 1); } else { ctx.fillStyle = '#efe2bf'; ctx.fillRect(x, y, 2, 1); ctx.fillStyle = '#1a1420'; ctx.fillRect(x - Math.sign(b.vx || 1), y, 1, 1); } }
  // Rauch
  for (const r of KR.rauch) { const x = r.x - CX, y = r.y - CY - r.z; if (x < -10 || x > VW + 10 || y < -10 || y > VH + 10) continue; const a = r.life / r.max, sp = krRauchSpr(r.s); ctx.globalAlpha = Math.min(.5, a * .7); ctx.drawImage(sp, Math.round(x - sp.width / 2), Math.round(y - sp.height / 2)); }
  ctx.globalAlpha = 1;
  if (!KR.on) return;
  // Lagerfeuer (Licht) – die Flamme selbst ist klein und billig
  for (const f of KR.feuer) { const x = Math.round(f.x - CX), y = Math.round(f.y - CY); if (x < -40 || x > VW + 40 || y < -40 || y > VH + 40) continue; const fl = Math.floor(T * 12 + f.ph) % 3; ctx.fillStyle = '#3a3028'; ctx.fillRect(x - 4, y - 1, 8, 2); ctx.fillStyle = WOOD[1]; ctx.fillRect(x - 3, y - 2, 6, 1); ctx.fillStyle = '#ff6a2a'; ctx.fillRect(x - 2, y - 6 - fl % 2, 4, 4 + fl % 2); ctx.fillStyle = '#ffd24a'; ctx.fillRect(x - 1, y - 5, 2, 3); ctx.fillStyle = '#fff3c0'; ctx.fillRect(x, y - 4, 1, 1); if (lichter-- > 0) addLight(x, y - 4, 46 + Math.sin(T * 9 + f.ph) * 4, .85); }
}
const KR_DG = { y: -1e9, draw: krGround }, KR_DT = { y: 1e9, draw: krTop };
HOOK.draw.push(list => {
  if (!G) return;
  try {
    if (KR.on) {
      for (const u of KR.al) { u.di.y = u.y; list.push(u.di); }
      for (const m of KR.machs) if (!m.weg && !m.e && m.di) list.push(m.di);
      for (const f of KR.fahnen) { f.di = f.di || { y: f.y, draw: () => krFahne(f.x - CX, f.y - CY, f.r, T * 3.2 + f.ph, f.gross ? 34 : 28) }; list.push(f.di); }
    }
    if (krLandeOn()) krLandeDeko(list);
    if (KR.on || KR.shots.length || KR.fires.length || KR.decals.length || KR.rauch.length || KR.bolts.length) { list.push(KR_DG); list.push(KR_DT); }
  } catch (e) { ctx.globalAlpha = 1; }
});
HOOK.drawEnemy.push(e => { if (e === KR.hpt && e.st !== 'spawn') { const x = Math.round(e.x - CX), y = Math.round(e.y - CY) - Math.round(34 * e.sc); ctx.font = '8px "VT323", monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'bottom'; ctx.fillStyle = '#000'; ctx.fillText(e.name, x + 1, y + 1); ctx.fillStyle = REICHE[e.kr.team].c; ctx.fillText(e.name, x, y); } });
// Kulissen in den Kriegs-Biomen der Lande: fest aus der Welt-Saat (für alle gleich), nur Schmuck
const KR_LD = new Map();
function krLandeDeko(list) {
  const cs = 128, x0 = Math.floor((CX - 30) / cs), x1 = Math.floor((CX + VW + 30) / cs), y0 = Math.floor((CY - 30) / cs), y1 = Math.floor((CY + VH + 50) / cs);
  for (let gy = y0; gy <= y1; gy++) for (let gx = x0; gx <= x1; gx++) {
    const key = gx * 65536 + gy; let d = KR_LD.get(key);
    if (d === undefined) {
      d = null; const h = lH(gx, gy, 6601);
      if ((h & 7) < 4) { const x = gx * cs + 14 + (h >>> 3) % 100, y = gy * cs + 14 + (h >>> 11) % 100; if (KR_LANDE[lBioAt(x, y)] && lWalk(x, y)) { const art = (h >>> 19) % 6, r = (h >>> 23) & 1 ? 'aurelien' : 'karth'; d = { y: art === 2 || art === 3 ? -1e8 : y, draw: () => krDekoDraw(art, x, y, r, h) }; } }
      if (KR_LD.size > 400) KR_LD.clear(); KR_LD.set(key, d);
    }
    if (d) list.push(d);
  }
}
function krDekoDraw(art, wx, wy, r, h) {
  const x = Math.round(wx - CX), y = Math.round(wy - CY);
  if (art === 0) krFahne(x, y, r, T * 3 + (h & 15), 28);
  else if (art === 1) { const s = krPalis(); ctx.drawImage(s, x - 7, y - 16); ctx.drawImage(s, x + 6, y - 15); }
  else if (art === 2) { krMalSchild(ctx, x, y, REICHE[r].c); krMalPfeil(ctx, x + 9, y + 3, 1); krMalPfeil(ctx, x - 8, y - 2, 0); }
  else if (art === 3) krMalKrater(ctx, x, y, 11 + (h & 7));
  else if (art === 4) { const s = krZelt(r); ctx.fillStyle = 'rgba(0,0,0,.3)'; ctx.beginPath(); ctx.ellipse(x, y + 1, 12, 3, 0, 0, 7); ctx.fill(); ctx.drawImage(s, x - 14, y - 18); }
  else { for (let i = 0; i < 4; i++) krMalPfeil(ctx, x + ((h >>> (i * 3)) & 15) - 8, y + ((h >>> (i * 2 + 5)) & 7) - 4, i & 1); }
}

/* ---------- Anzeige: Ziel, Moral, Deckung ---------- */
const KRH = { on: false, c: {} };
function krSet(id, k, v) { const key = id + k; if (KRH.c[key] === v) return; KRH.c[key] = v; const el = $(id); if (k === 't') el.textContent = v; else if (k === 'w') el.style.width = v; else if (k === 'h') el.hidden = v; else if (k === 'c') el.style.setProperty('--c', v); else el.classList.toggle(k, v); }
function krHud() {
  const on = KR.on && !!G && G.type === 'krieg' && (state === 'play' || state === 'dead' || state === 'pause');
  if (on !== KRH.on) { KRH.on = on; $('krhud').hidden = !on; KRH.c = {}; }
  if (!on) return;
  const Z = KR.ziel, F = REICHE[KR.foe]; let t = '', zl = '', zp = -1, zc = F.c;
  if (Z === 'linie') { const s = Math.max(0, Math.ceil(KR.zt)); t = _t('HALTE DIE LINIE'); zl = Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); zp = 1 - KR.zt / 70; zc = '#ffd24a'; }
  else if (Z === 'maschine') { const m = KR.zm; t = m && m.cap > 0 ? _t('EROBERE: {name}', { name: KR_MASCH[m.art].n.toLocaleUpperCase(LOCALE) }) : _t('NIMM: {name}', { name: KR_MASCH[KR.zm.art].n.toLocaleUpperCase(LOCALE) }); zl = _t('MASCHINE'); zp = m && m.e ? m.e.hp / m.e.maxHp : 0; }
  else if (Z === 'banner') { const u = KR.traeger, p0 = krPos(.07, .5), all = Math.hypot(KR.bz.x - p0.x, KR.bz.y - p0.y) || 1, pr = u ? clamp(1 - Math.hypot(KR.bz.x - u.x, KR.bz.y - u.y) / all, 0, 1) : 1; t = _t('SCHÜTZE DEN BANNERTRÄGER · {p} %', { p: Math.round(pr * 100) }); zl = _t('TRÄGER'); zp = u ? u.hp / u.maxHp : 0; zc = '#79c24e'; }
  else { const e = KR.hpt; t = e ? _t('BESIEGE: {name}', { name: F.hptN.toLocaleUpperCase(LOCALE) }) : _t('{name} NAHT · {n}', { name: F.hptN.toLocaleUpperCase(LOCALE), n: Math.max(0, Math.ceil(KR.ht)) }); zl = F.hptK.toLocaleUpperCase(LOCALE); zp = e ? Math.max(0, e.hp) / e.maxHp : -1; }
  if (KR.aus) t = KR.aus > 0 ? _t('SIEG') : _t('NIEDERLAGE');
  krSet('krT', 't', t); krSet('krMl', 't', _t('MORAL')); krSet('krMf', 'w', clamp(KR.moral, 0, 100).toFixed(0) + '%'); krSet('krMb', 'low', KR.moral < 25);
  krSet('krZr', 'h', zp < 0); if (zp >= 0) { krSet('krZl', 't', zl); krSet('krZf', 'w', (clamp(zp, 0, 1) * 100).toFixed(0) + '%'); krSet('krZr', 'c', zc); }
}
HOOK.postRender.push(() => {
  try {
    krHud();
    if (!KR.on || state !== 'play' || !G || G.type !== 'krieg') return;
    // Schild über dem Helden: du stehst in Deckung
    if (krCover(P.x, P.y)) { const x = Math.round(P.x - CX), y = Math.round(P.y - CY - 34 + Math.sin(T * 5)), s = artIcon('kr_schild'); ctx.drawImage(s, 3, 2, 10, 12, x - 5, y - 6, 10, 12); }
    // Pfeil am Bildrand zum Ziel (Maschine, Bannerträger, Hauptmann), wenn es nicht im Bild ist
    const z = KR.ziel === 'maschine' ? KR.zm : KR.ziel === 'banner' ? KR.traeger : KR.ziel === 'hauptmann' ? KR.hpt : null;
    if (z && !KR.aus && !krVis(z.x, z.y, -10)) { const a = Math.atan2(z.y - P.y, z.x - P.x), cx = P.x - CX, cy = P.y - CY - 10, x = Math.round(cx + Math.cos(a) * 38), y = Math.round(cy + Math.sin(a) * 32); ctx.save(); ctx.translate(x, y); ctx.rotate(a); ctx.beginPath(); ctx.moveTo(7, 0); ctx.lineTo(-4, -5); ctx.lineTo(-1, 0); ctx.lineTo(-4, 5); ctx.closePath(); ctx.lineWidth = 3; ctx.strokeStyle = '#120e18'; ctx.lineJoin = 'round'; ctx.stroke(); ctx.fillStyle = '#ffd24a'; ctx.fill(); ctx.restore(); ctx.lineWidth = 1; }
    // warmes Glühen über Feuern
    if (KR.fires.length || KR.feuer.length) { ctx.globalCompositeOperation = 'lighter'; let n = HD ? 8 : 4; for (const f of KR.fires) { if (n-- <= 0) break; const x = f.x - CX, y = f.y - CY; if (x > -40 && x < VW + 40 && y > -40 && y < VH + 40) glow(x, y - 6, f.r * 1.5, '255,120,40', .3 * clamp(f.life / .6, 0, 1)); } for (const f of KR.feuer) { if (n-- <= 0) break; const x = f.x - CX, y = f.y - CY; if (x > -40 && x < VW + 40 && y > -40 && y < VH + 40) glow(x, y - 5, 20 + Math.sin(T * 9 + f.ph) * 2, '255,150,60', .22); } ctx.globalCompositeOperation = 'source-over'; }
  } catch (e) { ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'; }
});

/* ---------- Chronik der Kronen: Geschichte, Reiche, Kriegskasse ---------- */
const KRC = { von: 'map' };
function krKasseWoche() { const K = krM().kasse, w = typeof weekNo === 'function' ? weekNo(Date.now()) : 0; if (K.w !== w) { K.w = w; K.b = {}; } return K; }
function kriegChronik(von) {
  if (von) KRC.von = von; setState('menu');
  const M = krM(), K = krKasseWoche();
  const reich = s => {
    const R = REICHE[s], D = M.r[s];
    if (!R.aktiv) return `<div class="row krrow aus" style="cursor:default"><div class="ic"><img src="${iconURL(['pa', 'kr_w_' + s])}" alt=""></div><div><div class="nm" style="color:${R.c}">${esc(R.n)} · ${esc(R.krone)}</div><div class="st">${esc(R.stil)} · ${_t('Ihre Heere sind noch nicht an der Front.')}</div></div></div>`;
    const kasse = KR_KASSE.map(o => { const e = o.e(s), n = K.b[s + ':' + o.id] || 0, ok = n < o.max && D.mk >= o.mk && (!o.m || hasMats(o.m)); return `<button class="btn alt sm" data-act="kr_kasse" data-id="${s}:${o.id}"${ok ? '' : ' disabled'}>${rwChip(e)} ${_t('für {n} Marken', { n: o.mk })}${o.m ? Object.keys(o.m).map(k => ` + ${o.m[k]} ${esc(MATS[k].n)}`).join('') : ''} <small>(${n}/${o.max})</small></button>`; }).join('');
    const rg = krRang(s), vt = rg ? `<div class="st" style="margin-top:4px;color:${R.c}">${_t('Rang-Vorteil: {v}', { v: KR_VORTEIL.slice(1, rg + 1).map(f => esc(f())).join(' · ') })}</div>` : '';
    return `<div class="row krrow" style="cursor:default;align-items:start"><div class="ic"><img src="${iconURL(['pa', 'kr_w_' + s])}" alt=""></div><div><div class="nm" style="color:${R.c}">${esc(R.n)} · ${esc(R.krone)}</div><div class="st">${esc(R.stil)}</div>${krRufBar(s)}<div class="st" style="margin-top:4px">${_t('{mk}: {n} · Siege {sg} · Niederlagen {nl}', { mk: esc(R.mk), n: D.mk, sg: D.sg, nl: D.nl })}</div>${vt}<div class="krks">${kasse}</div></div></div>`;
  };
  // Akt 1 je Reich: Kapitel nach Siegen für dieses Reich
  const akt = s => {
    const R = REICHE[s], D = M.r[s], L = KR_AKT1[s] || []; if (!L.length) return '';
    const nx = L.find(c => D.sg < c.ab), bt = L.map((c, i) => D.sg >= c.ab ? `<button class="btn ${M.ch['a1_' + s + '_' + i] ? 'alt ' : ''}sm" data-act="kr_akt" data-id="${s}:${i}">${i + 1}. ${esc(c.t())}</button>` : '').join('');
    return `<div class="row krrow krakt" style="cursor:default;align-items:start"><div class="ic"><img src="${iconURL(['pa', 'kr_w_' + s])}" alt=""></div><div><div class="nm" style="color:${R.c}">${_t('Akt 1 · {reich}', { reich: esc(R.n) })} <small>${L.filter(c => D.sg >= c.ab).length}/${L.length}</small></div><div class="st">${nx ? (nx.ab === 1 ? _t('Das erste Kapitel öffnet sich nach dem ersten Sieg für {reich}.', { reich: esc(R.n) }) : _t('Nächstes Kapitel nach {n} Siegen für {reich}.', { n: nx.ab, reich: esc(R.n) })) : _t('Akt 1 ist vollständig – die Chronik geht im nächsten Kapitel weiter.')}</div>${bt ? `<div class="krks">${bt}</div>` : ''}</div></div>`;
  };
  showOverlay(`<div class="head"><h2>${_t('CHRONIK DER KRONEN')}</h2><div class="hbtns"><button class="btn alt sm" data-act="kr_chrzu">${_t('Zurück')}</button></div></div>
  <p class="sub">${_t('Fünf Kronen streiten um den Splitterthron. Du bist Söldner ohne Krone – jede Schlacht wählst du neu, für wen du kämpfst.')}</p>
  ${typeof kkOpen === 'function' && kriegOffen() ? `<div class="krks"><button class="btn" data-act="kk_open" data-id="chr">${_t('Kriegskarte')}</button></div>` : ''}
  <h3>${_t('DIE GESCHICHTE')}</h3>
  <div class="row" style="cursor:default"><div class="ic"><img src="${iconURL(['pa', 'kr_banner'])}" alt=""></div><div><div class="nm">${_t('Prolog: Der Splitterthron')}</div><div class="st">${M.pro ? _t('Wie der Thron zersprang und zwei Werber um deine Klinge stritten.') : _t('Beginnt, wenn du dein erstes Kriegsgebiet betrittst (Weltkarte ab Akt 3).')}</div></div>${M.pro ? `<button class="btn alt sm" data-act="kr_prolog">${_t('Lesen')}</button>` : '<span></span>'}</div>
  ${KR_AKTIV.map(akt).join('')}
  <h3>${_t('DIE FÜNF REICHE')}</h3>${REICH_ORDER.map(reich).join('')}
  <p class="sub">${_t('Kriegsruf und Marken bekommst du für Schlachten. Die Kriegskasse jedes Reichs tauscht jede Woche neu.')}</p>`, true);
}
ON.kr_chronik = id => { sfx('click'); kriegChronik(id || 'map'); };
ON.kr_chrzu = () => { if (KRC.von === 'hb' && typeof hbOpen === 'function') hbOpen(); else openMap(); };
ON.kr_prolog = () => { setState('menu'); dialog(krProlog(), () => kriegChronik(), _t('Chronik der Kronen · Prolog')); };
ON.kr_kasse = id => {
  const [s, oid] = String(id).split(':'), o = KR_KASSE.find(x => x.id === oid), R = REICHE[s], D = krM().r[s], K = krKasseWoche(); if (!o || !R || !R.aktiv || !D) return;
  const key = s + ':' + oid, e = o.e(s);
  if ((K.b[key] || 0) >= o.max || D.mk < o.mk || (o.m && !hasMats(o.m)) || rwCan(e)) { sfx('deny'); return; }
  D.mk -= o.mk; if (o.m) for (const k in o.m) P.mats[k] -= o.m[k]; K.b[key] = (K.b[key] || 0) + 1; rwGive(e); sfx('buy'); toast(_t('Erhalten: {name}', { name: rwName(e) }), R.c); saveChar(); persist(); kriegChronik();
};
HOOK.mapMore.push(() => `<button class="btn alt" data-act="kr_chronik" data-id="map">${_t('Chronik der Kronen')}${SAVE && krM().sg ? ' · ' + krM().sg : ''}</button>`);

/* ---------- Handbuch: Kapitel „Krieg der Kronen“ ---------- */
if (typeof HB_AI !== 'undefined') { HB_AI.krieg = () => _t('Soldat: kämpft gegen das andere Heer und gegen dich'); HB_AI.krmach = () => _t('Kriegsmaschine: schießt angekündigt, lässt sich zerstören oder erobern'); }
if (typeof HBGO !== 'undefined') HBGO.krchronik = { l: () => _t('Zur Chronik der Kronen'), c: 'map', f: () => kriegChronik('map') };
function hbKrieg() {
  hbChap('krieg', _t('Krieg der Kronen'), ['pa', 'kr_banner'], _t('Kriegsgebiete, Beschuss, Deckung, Schlacht-Ziele, die fünf Reiche'));
  E('krieg:gebiete', _t('Kriegsgebiete'), { ic: ['pa', 'kr_banner'], kw: 'krieg kriegsgebiet schlacht front heer heere soldaten seite wählen söldner akt 3 schildgraben verbrannte mark aschefront', see: ['krieg:beschuss', 'krieg:deckung', 'krieg:ziele', 'krieg:reiche', 'krieg:raenge', 'start:karte'], go: ['krchronik'],
    s: _t('Zwei Heere kämpfen gegeneinander – du wählst für jede Schlacht eine Seite.'),
    b: () => hUl([_t('Ab Akt 3 liegen auf jeder Weltkarte Kriegsgebiete: der Ort mit den gekreuzten Bannern.'), _t('Jedes Kriegsgebiet ist eine Front zwischen zwei Reichen. Vor der Schlacht wählst du eine der beiden Seiten. Die Soldaten deiner Seite tragen einen Wimpel in der Farbe ihres Reichs über dem Kopf und kämpfen mit dir.'), _t('Feindliche Soldaten greifen dich und deine Verbündeten an. Nur was du selbst besiegst, bringt Erfahrung und Beute.'), _t('Es stehen höchstens {n} Soldaten zugleich auf dem Feld. Verstärkung rückt von beiden Enden nach.', { n: KR_CAP }), _t('Verlierst du die Schlacht, darfst du sie wiederholen oder dich zurückziehen. Stirbst du, gilt wie überall: Raum wiederholen oder zurück zur Karte.')])
      + hH(_t('IN DEN ENDLOSEN LANDEN')) + hP(_t('Drei Kriegs-Biome liegen in den Landen: Schildgraben (Pfeilhagel), Verbrannte Mark (Katapulte) und Aschefront (Meteore). Dort bekämpfen sich Soldaten beider Reiche – und beide greifen dich an. Beschuss fällt auch dort nur mit Ankündigung.')) });
  E('krieg:beschuss', _t('Beschuss'), { ic: ['fx', 'ring', 10], kw: 'beschuss pfeilhagel pfeile katapult stein krater magiehagel meteor meteore feuer brennender boden ausweichen kreis ankündigung kriegsmaschine glutwerfer pfeilwerfer erobern zerstören', see: ['krieg:deckung', 'krieg:gebiete'],
    s: _t('Jeder Einschlag wird am Boden angekündigt. Raus aus der Fläche, bevor sie sich füllt.'),
    b: () => hUl([_t('Eine Fläche mit hellem Rand zeigt, wo es einschlägt. Innen wächst eine dunkle Füllung – ist sie am Rand, schlägt es ein. Kurz davor wird der Rand weiß.'), _t('Du wirst nur getroffen, wenn du beim Einschlag in der Fläche stehst. Eine Rolle hindurch geht auch.'), _t('Gestrichelte Kreise in der Farbe deines Reichs sind dein eigener Beschuss – der trifft nur Feinde.')])
      + hRows(Object.keys(KR_MASCH).map(k => ({ ic: ['pa', 'kr_banner'], t: esc(KR_MASCH[k].n), d: esc(KR_MASCH[k].d) })))
      + hH(_t('KRIEGSMASCHINEN')) + hUl([_t('Die Maschinen stehen sichtbar am Feldrand. Feindliche kannst du zerstören – oder erobern: Stell dich daneben, solange kein feindlicher Soldat in der Nähe ist. Nach gut drei Sekunden feuert sie für dich.'), _t('Eine eroberte Maschine bringt eine Marke und Kriegsruf mehr.')]) });
  E('krieg:deckung', _t('Deckung'), { ic: ['pa', 'kr_schild'], kw: 'deckung schildwall wagen graben schild schutz pfeile gedeckt', see: ['krieg:beschuss'],
    s: _t('Hinter Schildwall und Wagen und im Graben bist du geschützt.'),
    b: () => hUl([_t('Ein kleiner Schild über deinem Helden zeigt: Du stehst in Deckung.'), _t('Pfeilhagel trifft dich in Deckung gar nicht. Katapult und Meteore treffen nur halb so stark.'), _t('Hinter Schildwall und Wagen musst du auf deiner Seite stehen – also so, dass die Deckung zwischen dir und dem Feind ist. Im Graben reicht es, darin zu stehen.'), _t('Schildwall und Wagen halten auch die Pfeile der feindlichen Schützen auf.')]) });
  E('krieg:ziele', _t('Schlacht-Ziele und Moral'), { ic: ['pa', 'kr_banner'], kw: 'ziel ziele linie halten katapult maschine bannerträger banner hauptmann moral sieg niederlage', see: ['krieg:gebiete', 'krieg:beute'],
    s: _t('Jede Schlacht hat ein Ziel – sie wechseln der Reihe nach.'),
    b: () => hRows(KR_ZIELE.map(k => ({ ic: ['pa', 'kr_banner'], t: esc(KR_ZIEL[k].n), d: esc(KR_ZIEL[k].d) })))
      + hH(_t('MORAL')) + hUl([_t('Der Balken MORAL zeigt, wie es um dein Heer steht. Fällt er auf null, ist die Schlacht verloren.'), _t('Moral sinkt, wenn Verbündete fallen, wenn dich Beschuss trifft und wenn die Schlacht sich hinzieht. Sie steigt mit jedem besiegten Feind – am meisten, wenn du ihn selbst besiegst.'), _t('Hauptleute kündigen ihre Sonderangriffe an: Aureliens Hauptmann stürmt entlang einer Bahn am Boden und ruft Pfeilhagel, Karths Hauptfrau legt einen Flammenring um sich und ruft Meteore.'), _t('Nordmarks Schildbrecherin stürmt ebenfalls entlang einer Bahn und lässt die Balliste auf dich zielen. Sylvaras Waldmeisterin ruft Pfeilhagel und legt einen Dornenring um sich.')]) });
  E('krieg:reiche', _t('Die fünf Reiche'), { ic: ['pa', 'kr_w_aurelien'], kw: 'reich reiche krone kronen aurelien nordmark sylvara karth schattenkonzil splitterthron sonnenkrone eisenkrone dornenkrone aschekrone hohle krone', see: ['krieg:beute', 'krieg:gebiete'], go: ['krchronik'],
    s: _t('Fünf Kronen streiten um den Splitterthron. Vier stehen an der Front, die fünfte zeigt sich noch nicht.'),
    b: () => hRows(REICH_ORDER.map(k => { const R = REICHE[k]; return { ic: ['pa', 'kr_w_' + k], t: esc(R.n) + ' · ' + esc(R.krone), d: esc(R.stil) + (R.aktiv ? '' : ' · ' + _t('noch nicht an der Front')) }; })) });
  E('krieg:beute', _t('Kriegsbeute, Kriegsruf und Marken'), { ic: ['mat', 'kriegseisen'], kw: 'kriegsbeute kriegseisen bannerstoff kriegsruf marken sonnenmarken aschemarken kriegskasse lohn rang söldner', see: ['krieg:reiche', 'mat:kriegseisen', 'mat:bannerstoff'], go: ['krchronik'],
    s: _t('Für einen Sieg gibt es Gold, Kriegseisen, Bannerstoff, Marken und Kriegsruf.'),
    b: () => hUl([_t('Kriegseisen und Bannerstoff lassen auch die Soldaten fallen, die du selbst besiegst.'), _t('Kriegsruf zählt je Reich – für das, für das du gekämpft hast. Auch eine Niederlage bringt ein wenig.'), _t('Marken tauschst du in der Kriegskasse des Reichs: Karte → Mehr → Chronik der Kronen. Jede Woche gibt es jedes Angebot nur ein paarmal.'), _t('Aurelien zahlt mehr Gold, Karth legt Kriegseisen drauf, die Nordmark gibt mehr Kriegsruf und Sylvara mehr Bannerstoff.')])
      + hKv(KR_AKTIV.map(k => [esc(REICHE[k].n).toLocaleUpperCase(LOCALE), _t('{rang} · Kriegsruf {n}', { rang: esc(KR_RAENGE[krRang(k)][1]), n: hbNum(krRuf(k)) })])) });
  E('krieg:raenge', _t('Ränge, Seitenwechsel und Chronik'), { ic: ['pa', 'kr_w_nordmark'], kw: 'rang ränge söldner hauptmann marschall kronfeldherr vorteil seite wechseln verrat front fronten chronik akt kapitel', see: ['krieg:beute', 'krieg:reiche'], go: ['krchronik'],
    s: _t('Mit Kriegsruf steigst du bei jedem Reich im Rang – jeder Rang bringt einen Vorteil.'),
    b: () => hRows(KR_RAENGE.map((r, i) => ({ ic: ['pa', 'kr_banner'], t: esc(r[1]) + ' · ' + _t('ab {n} Kriegsruf', { n: hbNum(r[0]) }), d: KR_VORTEIL[i] ? esc(KR_VORTEIL[i]()) : _t('Der Anfang: kein Vorteil.') })))
      + hH(_t('SEITE WECHSELN')) + hUl([_t('Du kannst in jeder Schlacht neu wählen. Die Vorteile gelten für das Reich, für das du gerade kämpfst.'), _t('Gewinnst du gegen ein Reich, verlierst du dort {n} Kriegsruf – unter null fällt er nie.', { n: KR_VERRAT })])
      + hH(_t('CHRONIK AKT 1')) + hP(_t('Jedes Reich an der Front erzählt seinen ersten Akt in drei Kapiteln. Ein neues Kapitel öffnet sich nach 1, 3 und 6 Siegen für dieses Reich – nachlesen in der Chronik der Kronen.')) });
}
if (typeof HB_BUILD !== 'undefined') HB_BUILD.push(['krieg', hbKrieg]);
