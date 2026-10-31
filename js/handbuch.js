'use strict';
/* =========================================================
   KLINGENHORT – Handbuch: Inhaltsverzeichnis, Suche und Erklärungen zu allem im Spiel
   Hängt sich über HOOK/ON (js/core.js) ein: „?“ im Hauptmenü, Pause, Einstellungen, Karte („Mehr“), Bibliothek im Versteck (Reiter),
   „?“ an fehlenden Materialien (Werkbank, Ausbau). Taste F1 öffnet es, Esc geht zurück, / springt in die Suche.
   Inhalt kommt zum großen Teil aus den Spieldaten (bleibt nach jedem Update richtig): Materialien mit „Wo finden“ und „Wofür“,
   Gebäude mit Stufen, Kosten und Bauzeit, Klassen, Sets, Mythisch, Edelsteine, Elemente, Mods, Gegner, Biome, Werkzeuge, Begleiter …
   Dazu kurze, handgeschriebene Erklärungen in du-Form. Entdecktes (Resonanzen, Begleiter-Arten, Begegnungen) erst nach dem Fund ganz.
   openHandbuch(eintrag?, zurück?) öffnet direkt einen Eintrag ('mat:eisenholz'); zurück = 'title' | 'pause' | 'settings' | 'map' | 'lib' | 'hide' | Funktion.
   Öffnen und Schließen verlässt die Welt nie: aus der Pause bleibt das Spiel angehalten, „Zurück“ führt genau dorthin zurück.
   Knöpfe zu anderen Bildschirmen (HBGO) nur, wo sie ohne Verlassen der Welt gehen (Titel, Weltkarte, Versteck – nicht in Kampf oder Landen).
   Suche: Index einmal je Öffnen (Titel, Stichwörter, Text, deutsche Namen), ohne Groß-/Kleinschreibung, Umlaute und Akzente; Füllwörter zählen nicht.
   Schnittstelle (Tests): hbEntries() → [{ id, ch, t }] · hbSearch(q) → [Eintrag-Id] · hbText(id) → Klartext · hbUses(k) / hbWhere(k) → Zeilen { id, t, d, n }
   ========================================================= */

document.head.insertAdjacentHTML('beforeend', `<style>
/* Handbuch: Steintafel mit Pergamentseite, links Verzeichnis, rechts Seite (Handy: eins von beiden) */
.panel.hbp{width:min(1100px,100%);height:100%;max-height:100%;display:flex;flex-direction:column;overflow:hidden;padding:10px 12px 12px;touch-action:auto}
.hbhead{display:flex;align-items:center;gap:8px;margin:0 0 8px;flex:none}
.hbhead h2{flex:1;min-width:0;display:flex;align-items:center;gap:8px;font-size:14px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.hbhead h2 img{width:28px;height:28px;flex:none;image-rendering:pixelated}
body .hbhead .btn.sm{min-height:44px;min-width:44px;flex:none}
.hbhead .hbx{font-family:var(--f-body);font-size:30px;line-height:1;padding:0 10px}
.hbsrch{position:relative;flex:none;margin:0 0 8px}
.hbsrch input{display:block;width:100%;box-sizing:border-box;min-height:44px;font:20px var(--f-body);padding:6px 46px 6px 40px;background:var(--night);color:var(--parch);border:2px solid var(--stone-hi);border-radius:0;-webkit-appearance:none;appearance:none;user-select:text;-webkit-user-select:text}
.hbsrch input:focus{outline:none;border-color:var(--gold)}
.hbsrch input::-webkit-search-cancel-button{display:none}
.hbsrch .hbl{position:absolute;left:11px;top:12px;width:12px;height:12px;border:3px solid var(--parch-dim);border-radius:50%;pointer-events:none}
.hbsrch .hbl:after{content:"";position:absolute;left:11px;top:11px;width:7px;height:3px;background:var(--parch-dim);transform:rotate(45deg);transform-origin:0 0}
.hbsrch .hbclr{position:absolute;right:0;top:0;width:44px;height:44px;border:0;background:none;color:var(--parch-dim);font:30px var(--f-body);line-height:1;cursor:pointer;padding:0}
.hbcols{flex:1;min-height:0;display:grid;grid-template-columns:minmax(0,1fr);grid-template-rows:minmax(0,1fr);gap:10px}
.hbnav,.hbmain{min-height:0;overflow-y:auto;overflow-x:hidden;overscroll-behavior:contain;-webkit-overflow-scrolling:touch;touch-action:pan-y;scrollbar-width:thin;scrollbar-color:var(--gold-dk) var(--night)}
.hbcols[data-v="list"] .hbmain,.hbcols[data-v="page"] .hbnav{display:none}
@media (min-width:700px){.hbcols{grid-template-columns:minmax(220px,33%) minmax(0,1fr)}.hbcols[data-v] .hbnav,.hbcols[data-v] .hbmain{display:block}.hbnav{padding-right:4px}}
.hbnav{contain:strict}
.hbnav .row{min-height:48px;margin-bottom:4px;content-visibility:auto;contain-intrinsic-size:auto 64px}
.hbnav .row .nm{font-size:19px}
.hbnav .row .st{font-size:15px}
.hbnav .row.sel{box-shadow:inset 0 0 0 2px var(--gold);background:var(--stone-hi)}
.hbnav .hbc{background:var(--stone-hi)}
.hbnav .hbc .nm{font-family:var(--f-display);font-size:9px;line-height:1.5;color:var(--gold)}
.hbnav .hbc.on{box-shadow:inset 3px 0 0 var(--gold)}
.hbnav .hbsub{padding-left:10px;margin:0 0 8px;border-left:2px solid var(--stone-hi)}
.hbnav .hbgh{font-family:var(--f-display);font-size:8px;line-height:1.7;color:var(--parch-dim);margin:10px 0 6px;letter-spacing:1px}
.hbnav .hbar,.hbrow .hbar{font-size:26px;color:var(--parch-dim);line-height:1}
.hbnav mark,.hbpage mark{background:#ffd24a;color:#110e17;padding:0 1px}
.hbsw{display:block;width:30px;height:30px;box-shadow:inset 0 0 0 2px rgba(0,0,0,.35),inset -6px -6px 0 rgba(0,0,0,.18)}
.hbchips{display:flex;flex-wrap:wrap;gap:6px;margin:0 0 8px}
.hbchip{display:inline-flex;align-items:center;gap:6px;min-height:44px;padding:4px 10px;border:0;background:var(--stone-lo);color:var(--parch);font:18px var(--f-body);cursor:pointer;box-sizing:border-box}
.hbchip img{width:24px;height:24px;object-fit:contain;image-rendering:pixelated}
.hbmore{font-size:16px;color:var(--parch-dim);margin:6px 2px}
/* Pergamentseite */
.hbpage{background:linear-gradient(180deg,#f3e7c6,#e8d8ac);color:#2b2016;padding:14px 14px 18px;box-shadow:inset 0 0 0 2px #c8b48a,inset 0 0 26px rgba(120,80,30,.28);font-size:20px;line-height:1.15;min-height:100%;box-sizing:border-box}
.hbph{display:flex;gap:12px;align-items:flex-start;margin-bottom:8px}
.hbpi{flex:none;width:52px;height:52px;display:grid;place-items:center;background:#2a2232;box-shadow:0 0 0 2px #8a6a3a}
.hbpi img{width:40px;height:40px;object-fit:contain;image-rendering:pixelated}
.hbpi .hbsw{width:52px;height:52px}
.hbph small{display:block;font-family:var(--f-display);font-size:7px;color:#8a5a2a;letter-spacing:1px;margin:2px 0 4px}
.hbph h3{font-family:var(--f-display);font-weight:400;font-size:13px;line-height:1.45;color:#6a2a10;margin:0}
.hbps{margin:4px 0 0;font-size:19px;color:#5a4630}
.hbpage h4{font-family:var(--f-display);font-weight:400;font-size:8px;letter-spacing:1px;color:#7a3a14;margin:16px 0 8px;padding-bottom:5px;border-bottom:2px dashed #c8a878}
.hbpage p{margin:0 0 8px}
.hbpage b{font-weight:400;color:#6a2a10}
.hbpage .hbw{background:rgba(255,255,255,.35);padding:8px 10px;box-shadow:inset 3px 0 0 #b8862a}
.hbul{margin:0 0 8px;padding-left:20px}
.hbul li{margin-bottom:4px}
.hbkv{display:flex;flex-wrap:wrap;gap:6px;margin:0 0 8px}
.hbkv span{background:rgba(90,60,30,.12);padding:4px 8px;font-size:18px}
.hbkv span b{display:block;font-family:var(--f-display);font-size:6px;letter-spacing:1px;color:#8a5a2a;margin-bottom:2px}
.hbrow{display:grid;grid-template-columns:40px minmax(0,1fr) auto;gap:10px;align-items:center;width:100%;box-sizing:border-box;padding:6px 8px;margin:0 0 4px;background:rgba(90,60,30,.1);border:0;text-align:left;color:inherit;font:inherit;min-height:48px}
button.hbrow{cursor:pointer;box-shadow:inset 3px 0 0 #b8862a}
button.hbrow:active{background:rgba(90,60,30,.22)}
.hbrow .ic{width:40px;height:40px;display:grid;place-items:center;background:#2a2232}
.hbrow .ic img{width:32px;height:32px;object-fit:contain;image-rendering:pixelated}
.hbrow .ic .hbsw{width:40px;height:40px}
.hbrow .nm{font-size:19px;line-height:1.05;color:#3a2010}
.hbrow .st{font-size:16px;color:#5a4630;line-height:1.1;margin-top:2px}
.hbrow .hbn{font-family:var(--f-display);font-size:8px;color:#6a2a10;white-space:nowrap}
.hbcost{display:flex;flex-wrap:wrap;gap:3px 10px;font-size:17px;margin-top:2px}
.hbcost span{display:inline-flex;align-items:center;gap:3px;white-space:nowrap}
.hbcost img{width:16px;height:16px;image-rendering:pixelated}
.hbcost .coin{margin-right:2px}
.hblv{display:grid;grid-template-columns:auto minmax(0,1fr) auto;gap:2px 10px;align-items:baseline;padding:6px 8px;margin:0 0 4px;background:rgba(90,60,30,.08)}
.hblv>b{font-family:var(--f-display);font-size:8px;color:#6a2a10;white-space:nowrap}
.hblv>i{font-style:normal;font-size:16px;color:#7a5a30;white-space:nowrap}
.hblv>div{grid-column:1/-1;font-size:18px}
.hbgo{display:flex;flex-wrap:wrap;gap:8px;margin:14px 0 4px}
.hbgo .btn{min-height:44px}
.hbsee{display:flex;flex-wrap:wrap;gap:6px}
.hbsee .hbchip{background:#3a3047;color:var(--parch)}
.hbnote{font-size:17px;color:#6a5a40;margin:4px 0 8px}
.hbgrid{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:6px;margin:0 0 8px}
.hbgrid>div{display:flex;gap:8px;align-items:center;background:rgba(90,60,30,.1);padding:6px;min-width:0}
.hbgrid img{width:36px;height:36px;object-fit:contain;image-rendering:pixelated;flex:none;background:#2a2232}
.hbgrid span{font-size:17px;line-height:1.05;min-width:0}
.hbgrid small{display:block;font-size:14px;color:#6a5a40}
.hbhome .hbchips .hbchip{background:#3a3047}
/* „?“ im Hauptmenü und an anderen Stellen */
.btn.hbtbtn{float:right;margin:0 0 8px 10px;min-width:44px;min-height:44px;padding:0 8px;font-size:15px;line-height:1}
body:not(.touch) .btn.hbtbtn{min-width:34px;min-height:32px;font-size:12px}
.hbqi{display:inline-grid;place-items:center;width:20px;height:20px;margin:-4px 6px -4px 0;background:var(--gold);color:var(--night);font-family:var(--f-display);font-size:10px;box-shadow:0 0 0 1px var(--night)}
.btn.alt .hbqi{background:var(--gold)}
.hbml{display:inline-flex;align-items:center;justify-content:center;min-width:32px;min-height:32px;margin:0 0 0 6px;padding:0 8px;border:0;background:var(--gold);color:var(--night);font-family:var(--f-display);font-size:9px;cursor:pointer;vertical-align:middle}
body.touch .hbml{min-width:40px;min-height:40px}
</style>`);

/* ---------- Zustand ---------- */
// list/by: Einträge (bei jedem Öffnen neu, Entdecktes ändert sich), idx: Suchindex gebaut, cur: offene Seite, ch: aufgeklapptes Kapitel, q: Suche
const HB = { open: false, back: 'title', list: null, by: null, idx: false, cur: null, ch: null, q: '', hist: [], deep: false, noImg: false, chap: null, chs: [], rev: null };
const HBK = 'klingenhort.hb';   // zuletzt gesucht (nur auf diesem Gerät)
const hbWide = () => matchMedia('(min-width:700px)').matches;
const hbIsOpen = () => HB.open && !ov.hidden && panel.classList.contains('hbp');
let HBERR = {};
function hbSafe(k, fn) { try { return fn(); } catch (e) { if (!HBERR[k]) { HBERR[k] = 1; console.error('Handbuch (' + k + '):', e); } return null; } }

/* ---------- Suche: Normalisieren (Umlaute, Akzente, ß, ae/oe/ue) ---------- */
const HBFOLD = { 'ä': 'a', 'ö': 'o', 'ü': 'u', 'ß': 'ss', 'ı': 'i', 'æ': 'ae', 'œ': 'oe', 'ø': 'o' };
// mit Zuordnung zur Stelle im Original (für die Markierung); m = null: ohne Zuordnung (schneller, für den Index)
const HBFC = {};
function hbFoldC(c) { if (HBFC[c] != null) return HBFC[c]; const l = c.toLowerCase(); return HBFC[c] = HBFOLD[l] || l.normalize('NFD').replace(/[̀-ͯ]/g, ''); }
function hbNormMap(s, noMap) {
  s = String(s || ''); let o = '', last = 0; const m = noMap ? null : [];
  for (let i = 0; i < s.length; i++) {
    const k = s.charCodeAt(i), c = k < 128 ? (k >= 65 && k <= 90 ? String.fromCharCode(k + 32) : s[i]) : hbFoldC(s[i]);
    for (let j = 0; j < c.length; j++) {
      const ch = c[j], q = c.charCodeAt(j);
      if (q === 101 && (last === 97 || last === 111 || last === 117)) continue;   // ae/oe/ue wie ä/ö/ü
      if (q === 32 || q === 9 || q === 10 || q === 13 || q === 160) { if (last === 32) continue; o += ' '; last = 32; } else { o += ch; last = q; }
      if (m) m.push(i);
    }
  }
  return { s: o, m };
}
const hbNorm = s => hbNormMap(s, true).s;
// Füllwörter in Fragen („Wie macht man Eisenholz?“) – zählen nur, wenn sonst nichts übrig bleibt
const HB_STOP = new Set(hbNorm('wie wo was wer warum wann welche welcher welches macht mache machen man ich du er es mein meine dein deine bekomme bekommt bekommen kriege kriegt gibt finde findet finden hole holt holen kann kannst ist sind der die das den dem des ein eine einen einem einer und oder mit von für zu zum zur im in an am auf aus bei nach über brauche brauchst braucht herstellen stellt stelle her bitte geht gibts mehr how do does i you get make where what which is are the a an to of for can my find obtain craft come cosa come dove como donde que el la los las un una de del y o ne nasil nerede ne bir ve ile comment ou quoi le les des du et est').split(' '));
function hbTerms(q) { const t = hbNorm(q).replace(/[?!.,;:"„“()]/g, ' ').split(' ').filter(Boolean); const u = t.filter(x => !HB_STOP.has(x)); return u.length ? u : t; }

/* ---------- Einträge ---------- */
// Kapitel: k, n (Name), ic (Bild), d (kurz)
function hbChap(k, n, ic, d) { HB.chs.push({ k, n, ic, d }); HB.chap = k; }
// Eintrag: t Titel, s Untertitel, ic Bild (Spec-Array, Farbe '#…' oder Funktion → URL), kw Stichwörter (unsichtbar), b() Seite, see [Ids], go [HBGO-Schlüssel]
function E(id, t, o) { const e = Object.assign({ id, ch: HB.chap, t: String(t), s: '', ic: null, kw: '', see: [], go: [], b: () => '' }, o || {}); if (HB.by[id]) return HB.by[id]; HB.list.push(e); HB.by[id] = e; return e; }
function hbBuild() {
  HB.list = []; HB.by = {}; HB.chs = []; HB.idx = false;
  for (const [k, f] of HB_BUILD) hbSafe(k, f);
}
function hbEntries() { if (!HB.list) hbBuild(); return HB.list.map(e => ({ id: e.id, ch: e.ch, t: e.t })); }
// Deutsche Originale der übersetzten Namen (andere Sprachen): „Holz“ findet auch auf Englisch „Wood“
function hbRev() {
  if (HB.rev) return HB.rev; HB.rev = new Map();
  const d = LANG !== 'de' && I18N[LANG]; if (d) for (const k in d) if (typeof d[k] === 'string' && k.length < 40 && !HB.rev.has(d[k])) HB.rev.set(d[k], k);
  return HB.rev;
}
// Suchindex: Seite ohne Bilder rendern, Klartext merken (einmal je Öffnen)
function hbStrip(h) { return String(h).replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/\s+/g, ' ').trim(); }
function hbPlain(e) {
  if (e.px != null) return e.px;
  HB.noImg = true; let h = ''; try { h = (e.s || '') + ' ' + (hbSafe('b:' + e.id, () => e.b()) || ''); } finally { HB.noImg = false; }
  return e.px = hbStrip(h);
}
// in Häppchen (ms = Zeitbudget, im Hintergrund) oder ganz (ohne Budget, beim ersten Tastendruck)
function hbIndexEntry(e, rev) { if (e.nx != null) return; e.nt = hbNorm(e.t); e.nd = rev.has(e.t) ? hbNorm(rev.get(e.t)) : ''; e.nk = hbNorm(e.kw + ' ' + e.nd + ' ' + (HB.chs.find(c => c.k === e.ch) || {}).n); e.nx = hbNorm(hbPlain(e)); }
function hbIndex(ms) {
  if (HB.idx) return true; if (!HB.list) hbBuild();
  const rev = hbRev(), t0 = performance.now();
  for (const e of HB.list) { hbIndexEntry(e, rev); if (ms && performance.now() - t0 > ms) return false; }
  HB.idx = true; return true;
}
// im Hintergrund: Index in kleinen Schritten, danach die Bilder der Trefferliste
function hbIdle() {
  const go = f => setTimeout(f, 0);   // zwischen den Bildern des Spiels, je ~10 ms
  const step = () => { if (!HB.open || !HB.list) return; if (!hbSafe('index', () => hbIndex(10))) { go(step); return; } let i = 0; const ic = () => { if (!HB.open || !HB.list) return; const t0 = performance.now(); for (; i < HB.list.length && performance.now() - t0 < 8; i++) { const e = HB.list[i]; if (e.ih == null) e.ih = hbIco(e.ic); } if (i < HB.list.length) go(ic); }; go(ic); };
  go(step);
}
// Treffer: alle Suchwörter (ohne Füllwörter) müssen vorkommen, sonst die mit den meisten; Titel vor Stichwort vor Text
function hbFind(q) {
  hbIndex(); const T_ = hbTerms(q); if (!T_.length) return [];
  const res = [];
  for (const e of HB.list) {
    let sc = 0, hit = 0;
    for (const t of T_) {
      let s = 0; const ti = e.nt.indexOf(t);
      if (e.nt === t || e.nd === t) s = 140; else if (ti === 0) s = 100; else if (ti > 0 && /[ \-(]/.test(e.nt[ti - 1])) s = 75; else if (ti > 0) s = 55;
      else if (e.nk.includes(t)) s = 35; else if (e.nx.includes(t)) s = 12;
      if (s) { hit++; sc += s; }
    }
    if (hit) res.push({ e, sc: sc + hit * 300 - e.t.length * .1, hit });
  }
  const all = res.filter(r => r.hit === T_.length);
  return (all.length ? all : res).sort((a, b) => b.sc - a.sc);
}
function hbSearch(q) { return hbFind(q).map(r => r.e.id); }
function hbText(id) { if (!HB.list) hbBuild(); const e = HB.by[id]; return e ? e.t + ' ' + hbPlain(e) : ''; }
// Markierung der Suchwörter in einem Text (Umlaut-unabhängig)
function hbHi(text, terms) {
  text = String(text); if (!terms || !terms.length) return esc(text);
  const N = hbNormMap(text), mark = new Uint8Array(text.length + 1);
  for (const t of terms) { let i = N.s.indexOf(t); while (i >= 0) { const a = N.m[i], b = (N.m[i + t.length - 1] != null ? N.m[i + t.length - 1] : text.length - 1) + 1; for (let k = a; k < b; k++) mark[k] = 1; i = N.s.indexOf(t, i + t.length); } }
  let o = '', on = false;
  for (let i = 0; i < text.length; i++) { if (mark[i] && !on) { o += '<mark>'; on = true; } else if (!mark[i] && on) { o += '</mark>'; on = false; } o += esc(text[i]); }
  return o + (on ? '</mark>' : '');
}
// Ausschnitt um den ersten Treffer im Text – nur ein Fenster um die Stelle wird mit Zuordnung normalisiert (schnell beim Tippen)
function hbSnip(e, terms) {
  const px = hbPlain(e); let ni = -1;
  for (const t of terms) { const i = e.nx ? e.nx.indexOf(t) : -1; if (i >= 0 && (ni < 0 || i < ni)) ni = i; }
  const a0 = Math.max(0, ni - 40), N = hbNormMap(ni < 0 ? '' : px.slice(a0, ni + 400)); let at = -1;
  for (const t of terms) { const i = N.s.indexOf(t); if (i >= 0 && (at < 0 || i < at)) at = i; }
  if (at < 0) return esc(e.s ? hbStrip(e.s).slice(0, 90) : '');
  const p = a0 + N.m[at], a = Math.max(0, px.lastIndexOf(' ', Math.max(0, p - 38))), b = Math.min(px.length, p + 70), cut = px.slice(a, b);
  return (a > 0 ? '… ' : '') + hbHi(cut.trim(), terms) + (b < px.length ? ' …' : '');
}

/* ---------- Bausteine der Seiten ---------- */
// Bild: Spec-Array → iconURL, '#farbe' → Farbfeld, Funktion → URL (z. B. Begleiter); beim Index-Bau keine Bilder
function hbImgURL(ic) { if (!ic) return ''; if (typeof ic === 'function') return hbSafe('ic', ic) || ''; if (Array.isArray(ic)) return hbSafe('ic', () => iconURL(ic)) || ''; return ''; }
function hbIco(ic) { if (HB.noImg || !ic) return ''; if (typeof ic === 'string' && ic[0] === '#') return `<i class="hbsw" style="background:${ic}"></i>`; const u = hbImgURL(ic); return u ? `<img class="px" src="${u}" alt="">` : ''; }
const hP = s => s ? `<p>${s}</p>` : '';
const hH = s => `<h4>${s}</h4>`;
const hUl = a => a && a.length ? `<ul class="hbul">${a.map(x => `<li>${x}</li>`).join('')}</ul>` : '';
const hKv = a => `<div class="hbkv">${a.filter(Boolean).map(([k, v]) => `<span><b>${k}</b>${v}</span>`).join('')}</div>`;
const hNote = s => `<p class="hbnote">${s}</p>`;
const hbNum = n => Math.round(+n || 0).toLocaleString(LOCALE);
const hbRange = (a, b) => a === b ? hbNum(a) : hbNum(a) + '–' + hbNum(b);
// Zeilen: { id (Link), ic, t, d (Zeile darunter, HTML), r (rechts) } – mit id ein Knopf zum Eintrag
function hRow(r) {
  const tag = r.id && HB.by[r.id] ? 'button' : 'div', a = tag === 'button' ? ` data-act="hb_e" data-id="${esc(r.id)}"` : '';
  return `<${tag} class="hbrow"${a}><div class="ic">${hbIco(r.ic)}</div><div><div class="nm">${r.t}</div>${r.d ? `<div class="st">${r.d}</div>` : ''}</div>${r.r != null ? `<span class="hbn">${r.r}</span>` : tag === 'button' ? '<span class="hbar">›</span>' : '<span></span>'}</${tag}>`;
}
const hRows = a => (a || []).filter(Boolean).map(hRow).join('');
// Material als kleines Zeichen (Kosten), Kostenliste
const hMat = (k, n) => MATS[k] ? `<span>${hbIco(['mat', k])}${n != null ? hbNum(n) + ' ' : ''}${esc(MATS[k].n)}</span>` : '';
function hCost(c, gold) { const L = Object.keys(c || {}).map(k => hMat(k, c[k])); if (gold) L.push(`<span><i class="coin"></i>${hbNum(gold)}</span>`); return L.length ? `<div class="hbcost">${L.join('')}</div>` : ''; }
const hbLink = id => HB.by[id] || null;

/* ---------- Knöpfe zu anderen Bildschirmen: nur wo man die Welt dabei nicht verlässt ---------- */
// Wo stehen wir? title (Hauptmenü), map (Weltkarte), hide (Versteck), game (Kampf, Lande, Bosskampf – keine Sprünge)
function hbCtx() {
  const b = HB.back, inG = !!(G && G.type), lande = typeof landeActive === 'function' && landeActive();
  if (!inG && (b === 'title' || b === 'settings')) return 'title';
  if (b === 'map' && !inG) return 'map';
  if (inG && G.type === 'versteck' && !lande && !(typeof BA !== 'undefined' && BA)) return 'hide';
  return 'game';
}
const hbHero = () => !!(P && SAVE && SAVE.active >= 0 && SAVE.chars[SAVE.active]);
const HBGO = {
  kodex: { l: () => _t('Zum Boss-Kodex'), c: 'title map hide', f: x => bossKodex(x === 'hide' ? 'lib' : x) },
  chronik: { l: () => _t('Zur Chronik der Artefakte'), c: 'map hide', f: x => arteChronik(x === 'hide' ? 'lib' : 'map') },
  reso: { l: () => _t('Zum Resonanz-Buch'), c: 'map', ok: () => SAVE.meta.mods && SAVE.meta.mods.found, f: () => ON.mod_book('map') },
  basar: { l: () => _t('Zum Basar'), c: 'map hide', f: x => x === 'map' ? mkOpen('map') : openStation('basar') },
  nest: { l: () => _t('Zum Brutnest'), c: 'map hide', f: x => x === 'map' ? openNest('map') : openStation('brutnest') },
  lande: { l: () => _t('Zum Weltentor'), c: 'map hide', f: x => x === 'map' ? lGate('map') : openStation('weltentor') },
  best: { l: () => _t('Zum Bestiarium'), c: 'title hide', f: x => x === 'title' ? showBestiary() : openStation('bibliothek', 'best') },
  ach: { l: () => _t('Zu den Erfolgen'), c: 'title', f: () => showAch() },
  hall: { l: () => _t('Zur Ruhmeshalle'), c: 'title', f: () => showHall() },
  news: { l: () => _t('Zu den Neuigkeiten'), c: 'title map', f: x => showNews(x) },
  settings: { l: () => _t('Zu den Einstellungen'), c: 'title', f: () => showSettings('title') },
  controls: { l: () => _t('Zur Steuerung'), c: 'title', f: () => showControls() },
  code: { l: () => _t('Spielstand übertragen'), c: 'title', f: () => showCode() },
  trade: { l: () => _t('Zum Tauschen'), c: 'title map', f: x => ON.tr_open(x === 'map' ? 'send|map' : 'recv|title') },
  tal: { l: () => _t('Zu den Talenten'), c: 'map', f: () => { selItem = null; openChar('tal', 'map'); } },
  lvr: { l: () => _t('Zu den Level-Belohnungen'), c: 'map', f: () => { selItem = null; if (typeof LVR !== 'undefined') LVR.sub = 'lvr'; openChar('para', 'map'); } },
  parts: { l: () => _t('Zu deinen Bauteilen'), c: 'map', f: () => { selItem = null; openChar('parts', 'map'); } },
  mods: { l: () => _t('Zu deinen Mods'), c: 'map', f: () => { selItem = null; openChar('mods', 'map'); } },
  pet: { l: () => _t('Zu deinen Begleitern'), c: 'map', f: () => { selItem = null; openChar('pet', 'map'); } },
  vorrat: { l: () => _t('Zu deinem Vorrat'), c: 'map', f: () => { selItem = null; openChar('vorrat', 'map'); } },
  gear: { l: () => _t('Zur Ausrüstung'), c: 'map', f: () => { selItem = null; openChar('gear', 'map'); } },
  hide: { l: () => _t('Ins Versteck'), c: 'map', f: () => { saveChar(); enterHideout(); } }
};
// Stationen im Versteck: „st:schmiede“ – nur im Versteck
function hbGo(k) {
  const x = hbCtx();
  if (k.startsWith('st:')) { const id = k.slice(3); return BUILD[id] && x === 'hide' ? { l: _t('Zu: {name}', { name: BUILD[id].n }), f: () => openStation(id) } : null; }
  const g = HBGO[k]; if (!g || !g.c.split(' ').includes(x) || (x !== 'title' && !hbHero()) || (g.ok && !hbSafe('ok:' + k, g.ok))) return null;
  return { l: g.l(), f: () => g.f(x) };
}

/* ---------- Seiten ---------- */
function hbChapOf(e) { return HB.chs.find(c => c.k === e.ch) || { n: '' }; }
function hbPageHTML(e) {
  const body = hbSafe('b:' + e.id, () => e.b()) || '';
  const go = e.go.map(hbGo).filter(Boolean), see = e.see.map(hbLink).filter(x => x && x !== e);
  return `<article class="hbpage"><header class="hbph"><div class="hbpi">${hbIco(e.ic)}</div><div><small>${esc(hbChapOf(e).n).toLocaleUpperCase(LOCALE)}</small><h3>${esc(e.t)}</h3>${e.s ? `<p class="hbps">${e.s}</p>` : ''}</div></header>
  ${body}${go.length ? `<div class="hbgo">${go.map((g, i) => `<button class="btn" data-act="hb_go" data-id="${esc(e.id)}" data-i="${i}">${esc(g.l)}</button>`).join('')}</div>` : ''}
  ${see.length ? hH(_t('SIEHE AUCH')) + `<div class="hbsee">${see.map(s => `<button class="hbchip" data-act="hb_e" data-id="${esc(s.id)}">${hbIco(s.ic)}${esc(s.t)}</button>`).join('')}</div>` : ''}</article>`;
}
// Startseite (rechts am PC): kurz erklärt, häufige Fragen, zuletzt gesucht
function hbHomeHTML() {
  const faq = HB.list.filter(e => e.ch === 'faq').slice(0, 8);
  return `<article class="hbpage hbhome"><header class="hbph"><div class="hbpi">${hbIco(['pa', 'buch'])}</div><div><small>${_t('KLINGENHORT')}</small><h3>${_t('Willkommen im Handbuch')}</h3><p class="hbps">${_t('Hier steht alles über Klingenhort: jede Funktion, jeder Gegenstand, jedes Material. Tipp oben ein Wort ein – oder blättere links durch die Kapitel.')}</p></div></header>
  ${hH(_t('HÄUFIGE FRAGEN'))}${hRows(faq.map(e => ({ id: e.id, ic: e.ic, t: esc(e.t) })))}
  ${hH(_t('KAPITEL'))}${hRows(HB.chs.map(c => { const n = HB.list.filter(e => e.ch === c.k).length, f = HB.list.find(e => e.ch === c.k); return f ? { id: f.id, ic: c.ic, t: esc(c.n), d: esc(c.d), r: n } : null; }))}</article>`;
}
function hbRecent() { try { const r = JSON.parse(localStorage.getItem(HBK) || '[]'); return Array.isArray(r) ? r.filter(x => typeof x === 'string').slice(0, 6) : []; } catch (_) { return []; } }
function hbRemember(q) { q = String(q || '').trim(); if (q.length < 2) return; try { const r = hbRecent().filter(x => hbNorm(x) !== hbNorm(q)); r.unshift(q.slice(0, 40)); localStorage.setItem(HBK, JSON.stringify(r.slice(0, 6))); } catch (_) { } }
// Linke Spalte: Kapitel zum Aufklappen – oder die Suchergebnisse, nach Kapiteln gruppiert (das Kapitel mit dem besten Treffer zuerst)
function hbNavRow(e, terms, snip) { return `<button class="row hbr${HB.cur === e.id ? ' sel' : ''}" data-act="hb_e" data-id="${esc(e.id)}"><div class="ic">${e.ih != null ? e.ih : (e.ih = hbIco(e.ic))}</div><div><div class="nm">${terms ? hbHi(e.t, terms) : esc(e.t)}</div>${snip ? `<div class="st">${snip}</div>` : e.s && !terms ? `<div class="st">${hbStrip(e.s).length > 70 ? esc(hbStrip(e.s).slice(0, 68)) + ' …' : esc(hbStrip(e.s))}</div>` : ''}</div><span class="hbar">›</span></button>`; }
function hbNavHTML() {
  if (HB.q.trim().length >= 2) {
    const R = hbFind(HB.q), terms = hbTerms(HB.q);
    if (!R.length) return `<p class="sub">${_t('Nichts gefunden. Versuch ein anderes Wort – zum Beispiel „Holz“, „Schmiede“ oder „Drache“.')}</p>`;
    const show = R.slice(0, HB.more ? 120 : 24), grp = new Map();
    for (const r of show) { if (!grp.has(r.e.ch)) grp.set(r.e.ch, []); grp.get(r.e.ch).push(r.e); }
    let h = `<p class="hbmore">${R.length === 1 ? _t('1 Treffer') : _t('{n} Treffer', { n: R.length })}</p>`;
    for (const [k, L] of grp) { const C = HB.chs.find(c => c.k === k) || { n: '' }; h += `<div class="hbgh">${esc(C.n).toLocaleUpperCase(LOCALE)} · ${L.length}</div>` + L.map(e => hbNavRow(e, terms, hbSnip(e, terms))).join(''); }
    if (R.length > show.length) h += HB.more ? `<p class="hbmore">${_t('… und {n} weitere. Gib ein Wort mehr ein.', { n: R.length - show.length })}</p>` : `<button class="hbchip" data-act="hb_more" style="width:100%;justify-content:center">${_t('{n} weitere Treffer zeigen', { n: R.length - show.length })}</button>`;
    return h;
  }
  const rec = hbRecent();
  let h = HB.q.trim() ? `<p class="hbmore">${_t('Noch ein Buchstabe mehr …')}</p>` : '';
  h += rec.length ? `<div class="hbgh">${_t('ZULETZT GESUCHT')}</div><div class="hbchips">${rec.map(q => `<button class="hbchip" data-act="hb_q" data-id="${esc(q)}">${esc(q)}</button>`).join('')}</div>` : '';
  h += `<div class="hbgh">${_t('INHALT · {n} EINTRÄGE', { n: HB.list.length })}</div>`;
  for (const c of HB.chs) {
    const L = HB.list.filter(e => e.ch === c.k); if (!L.length) continue; const on = HB.ch === c.k;
    h += `<button class="row hbc${on ? ' on' : ''}" data-act="hb_ch" data-id="${c.k}" aria-expanded="${on}"><div class="ic">${hbIco(c.ic)}</div><div><div class="nm">${esc(c.n)}</div><div class="st">${esc(c.d)}</div></div><span class="pill dim">${L.length}</span></button>`;
    if (on) h += `<div class="hbsub">${L.map(e => hbNavRow(e)).join('')}</div>`;
  }
  return h;
}
function hbRender() {
  const v = HB.cur ? 'page' : 'list', e = HB.cur && HB.by[HB.cur], root = !HB.cur && !HB.q && !HB.ch && !HB.hist.length;
  showOverlay(`<div class="hbhead"><h2>${hbIco(['pa', 'buch'])}${_t('HANDBUCH')}</h2><button class="btn alt sm" data-act="hb_back">${_t('Zurück')}</button>${root ? '' : `<button class="btn alt sm hbx" data-act="hb_close" aria-label="${_t('Schließen')}">×</button>`}</div>
  <div class="hbsrch"><i class="hbl"></i><input id="hbq" type="search" value="${esc(HB.q)}" placeholder="${_t('Suchen … z. B. Eisenholz')}" aria-label="${_t('Im Handbuch suchen')}" autocomplete="off" autocapitalize="off" spellcheck="false" enterkeyhint="search"><button class="hbclr" data-act="hb_clear" aria-label="${_t('Suche leeren')}"${HB.q ? '' : ' hidden'}>×</button></div>
  <div class="hbcols" data-v="${v}"><nav class="hbnav" id="hbnav">${hbNavHTML()}</nav><div class="hbmain" id="hbmain">${e ? hbPageHTML(e) : hbHomeHTML()}</div></div>`, true);
  panel.classList.add('hbp');
  const q = $('hbq'); q.addEventListener('input', hbOnInput); q.addEventListener('keydown', hbOnKey);
  if (!isTouch && !HB.cur) q.focus({ preventScroll: true });
  const nav = $('hbnav'), cur = nav.querySelector('.row.sel') || (HB.ch && nav.querySelector('.hbc.on'));
  if (HB.navY != null) { nav.scrollTop = HB.navY; HB.navY = null; } else if (cur && hbWide()) hbScrollTo(nav, cur, false);
  $('hbmain').scrollTop = 0;
}
// Zeile in der Liste sichtbar machen (nur die Liste scrollt, nie die Tafel): top = an den oberen Rand
function hbScrollTo(box, el, top) {
  const b = box.getBoundingClientRect(), r = el.getBoundingClientRect();
  if (top || r.top < b.top) box.scrollTop += r.top - b.top - 4; else if (r.bottom > b.bottom) box.scrollTop += r.bottom - b.bottom + 4;
}
// Tippen: nur die Liste neu (das Eingabefeld bleibt, Fokus und Tastatur auch) – höchstens einmal je Bild, auch wenn schnell getippt wird
let HBRAF = 0;
function hbOnInput(ev) {
  const was = HB.q; HB.q = ev.target.value;
  if (HB.cur && !hbWide()) { HB.hist.push({ cur: HB.cur, ch: HB.ch, q: was }); HB.cur = null; }
  const c = panel.querySelector('.hbclr'); if (c) c.hidden = !HB.q;
  if (!HBRAF) HBRAF = requestAnimationFrame(() => { HBRAF = 0; hbNavUpdate(); });
}
function hbNavUpdate() {
  const nav = $('hbnav'); if (!nav || !hbIsOpen()) return;
  HB.more = false; nav.innerHTML = hbNavHTML(); nav.scrollTop = 0;
  const cols = panel.querySelector('.hbcols'); if (cols) cols.dataset.v = HB.cur ? 'page' : 'list';
}
function hbOnKey(ev) {
  if (ev.key === 'Enter') { ev.preventDefault(); hbRemember(HB.q); const R = HB.q.trim() ? hbFind(HB.q) : []; if (R.length && hbWide()) hbOpenEntry(R[0].e.id); else ev.target.blur(); }
}
function hbOpenEntry(id) {
  if (!HB.by[id]) return;
  if (HB.q.trim()) hbRemember(HB.q);
  // Liste bleibt, wo sie war – außer ein anderes Kapitel klappt auf (dann zur Zeile scrollen)
  const nav = $('hbnav'); HB.navY = nav && (HB.q || HB.ch === HB.by[id].ch) ? nav.scrollTop : null;
  HB.hist.push({ cur: HB.cur, ch: HB.ch, q: HB.q });
  HB.cur = id; if (!HB.q) HB.ch = HB.by[id].ch;
  sfx('page'); hbRender();
}

/* ---------- Öffnen, Zurück, Schließen ---------- */
// Woher kommt der Spieler? (ohne Angabe)
function hbGuess() {
  if (state === 'pause' || state === 'play') return 'pause';
  if (state === 'map') return 'map';
  if (G && G.type === 'versteck') return 'hide';
  if (state === 'title' || !(G && G.type)) return 'title';
  return 'pause';
}
function openHandbuch(id, back) {
  if (back == null || back === '') back = hbGuess();
  if (state === 'play') { showPause(); back = 'pause'; }   // mitten im Spiel: erst anhalten
  if (state === 'pause' || state === 'map') setState('menu');   // Pause bleibt Pause (keine Pausen-Knöpfe der Lande über dem Handbuch), Karte dreht nicht weg
  HB.back = back; HB.open = true; HB.hist = []; HB.q = ''; HB.navY = null; HB.rev = null;
  hbBuild();
  if (id && HB.by[id]) { HB.cur = id; HB.ch = HB.by[id].ch; HB.deep = true; } else { HB.cur = null; HB.ch = null; HB.deep = false; }
  hbRender();
  // Suchindex in ruhigen Momenten vorbereiten – dann ist schon der erste Tastendruck schnell
  hbIdle();
  return true;
}
function hbClose() {
  const b = HB.back; HB.open = false; HB.cur = null; HB.hist = [];
  if (typeof b === 'function') { b(); return; }
  if (b === 'pause') { if (G && G.type) { setState('play'); showPause(); } else showTitle(); }
  else if (b === 'settings') showSettings();
  else if (b === 'map') { if (P && P.map && SAVE.active >= 0) { setState('map'); showMapMore(); } else showTitle(); }
  else if (b === 'lib') { if (G && G.type === 'versteck') openStation('bibliothek'); else showTitle(); }
  else if (b === 'hide') { if (G && G.type === 'versteck') backToHide(); else showTitle(); }
  else showTitle();
}
function hbBack() {
  if (HB.hist.length) { Object.assign(HB, HB.hist.pop()); hbRender(); return; }
  if (HB.cur && !HB.deep) { HB.cur = null; hbRender(); return; }
  if (HB.q && !HB.deep) { HB.q = ''; hbRender(); return; }
  if (HB.ch && !HB.deep) { HB.ch = null; hbRender(); return; }
  hbClose();
}

/* ---------- Knöpfe ---------- */
// data-id „eintrag|woher“ (beides optional); data-from = 'wb' (Werkbank) | 'station' (Versteck-Station) für die „?“ an fehlenden Materialien
ON.hb_open = (id, b) => {
  const [e, f] = String(id || '').split('|'), from = b && b.dataset.from;
  let back = f || null;
  if (from === 'wb') back = () => openWorkbench();
  else if (from === 'station') { const v = typeof bView !== 'undefined' ? bView : null; back = () => v === 'feuer' ? openCampfire() : v ? openStation(v) : backToHide(); }
  sfx('page'); openHandbuch(e || null, back);
};
ON.hb_close = () => { sfx('click'); hbClose(); };
ON.hb_back = () => { sfx('click'); hbBack(); };
ON.hb_e = id => hbOpenEntry(id);
ON.hb_ch = id => { HB.ch = HB.ch === id ? null : id; sfx('click'); const nav = $('hbnav'); if (!nav) return; const y = nav.scrollTop; nav.innerHTML = hbNavHTML(); nav.scrollTop = y; const c = nav.querySelector('.hbc.on'); if (c) hbScrollTo(nav, c, true); };
ON.hb_q = id => { HB.q = id; hbRemember(id); sfx('click'); hbRender(); };
ON.hb_more = () => { HB.more = true; const nav = $('hbnav'); if (!nav) return; const y = nav.scrollTop; nav.innerHTML = hbNavHTML(); nav.scrollTop = y; };
ON.hb_clear = () => { HB.q = ''; const q = $('hbq'); if (q) { q.value = ''; hbOnInput({ target: q }); if (!isTouch) q.focus(); } };
ON.hb_go = (id, b, i) => { const e = HB.by[id], g = e && e.go.map(hbGo).filter(Boolean)[i]; if (!g) return; HB.open = false; sfx('click'); g.f(); };
// Tasten: Esc zurück (Suche erst leeren), / in die Suche, F1 öffnet das Handbuch
addEventListener('keydown', e => {
  if (hbIsOpen()) {
    if (e.code === 'Escape') { e.preventDefault(); e.stopImmediatePropagation(); const q = $('hbq'); if (q && document.activeElement === q && HB.q) { ON.hb_clear(); return; } hbBack(); return; }
    if (e.key === '/' && document.activeElement && document.activeElement.id !== 'hbq') { e.preventDefault(); e.stopImmediatePropagation(); const q = $('hbq'); if (q) q.focus(); return; }
    return;
  }
  if (e.code === 'F1' && SAVE && ['title', 'map', 'pause', 'play'].includes(state)) { e.preventDefault(); e.stopImmediatePropagation(); openHandbuch(null); }
}, true);

/* ---------- Zugänge: Hauptmenü („?“), Pause, Einstellungen (js/ui.js), Karte „Mehr“, Bibliothek ---------- */
function hbTitleBtn() { return `<button class="btn hbtbtn" data-act="hb_open" data-id="|title" aria-label="${_t('Handbuch')}" title="${_t('Handbuch')}">?</button>`; }
// Knopf „? Handbuch“ für Menüs (Pause: woher = 'pause', Einstellungen: 'settings')
function hbMenuBtn(from) { return `<button class="btn alt" data-act="hb_open" data-id="|${from}"><span class="hbqi">?</span>${_t('Handbuch')}</button>`; }
HOOK.mapMore.push(() => hbMenuBtn('map'));
// Bibliothek im Versteck: eigener Reiter (wie die Artefakte)
HOOK.station.push((h, id) => {
  if (h || id !== 'bibliothek') return h;
  if (typeof stTab !== 'undefined' && stTab === 'hb') { openHandbuch(null, 'lib'); return true; }
  queueMicrotask(() => { const t = panel.querySelector('.tabs'); if (t && !t.querySelector('[data-id="hb"]')) t.insertAdjacentHTML('beforeend', `<button class="tab" role="tab" aria-selected="false" data-act="ltab" data-id="hb">${_t('HANDBUCH')}</button>`); });
  return h;
});
// Resonanz-Buch aus dem Handbuch: „Zurück“ dort führt wieder auf die Karte (wie aus „Mehr“)
// „?“ hinter fehlenden Materialien (js/forge.js needHTML, js/hideout.js missLine)
function hbMatBtn(k, from) { return MATS[k] ? `<button class="hbml" data-act="hb_open" data-id="mat:${k}" data-from="${from}" aria-label="${_t('Wo finde ich {mat}?', { mat: esc(MATS[k].n) })}">?</button>` : ''; }

/* =========================================================
   Inhalt – aus den Spieldaten erzeugt, dazu kurze Erklärungen
   ========================================================= */
// Rechnen ohne Wochen-Ereignis (Schmiedewoche würde Kosten senken) und mit einer bestimmten Gebäude-Stufe (Erzmine, Garten …)
function hbNoWeek(fn) { const f = window.weekFx; window.weekFx = () => 0; try { return fn(); } finally { window.weekFx = f; } }
function hbLv(k, lv, fn) { const H = SAVE.meta.hide, was = H.b[k]; H.b[k] = lv; try { return fn(); } finally { if (was === undefined) delete H.b[k]; else H.b[k] = was; } }
// Stufe der Lande → Entfernung vom Weltentor (Umkehrung von worldStage, js/lande.js)
function hbKmAt(st) { if (typeof worldStage !== 'function') return '?'; let a = 0, b = 1; for (let i = 0; i < 32; i++) { const m = (a + b) / 2; if (worldStage(m) >= st) b = m; else a = m; } return lKm(b * LWR * LCK); }
// Bild einer Pflanze/eines Felsens der Lande (lPropImg, js/lande.js) als Symbol
const HBPROP = {};
const hbProp = (t, v) => () => HBPROP[t] || (HBPROP[t] = typeof lPropImg === 'function' ? lPropImg(t, v || 0).c.toDataURL() : iconURL(['mat', 'holz']));
const hbBios = pred => typeof LANDE_BIOMES === 'undefined' ? [] : Object.keys(LANDE_BIOMES).filter(k => hbSafe('bio', () => pred(LANDE_BIOMES[k], k)));
const hbBioN = pred => esc(hbBios(pred).map(k => LANDE_BIOMES[k].n).join(', '));
const hbTr = (B, ...ts) => (B.tr || []).some(s => ts.includes(s.split('.')[0]));
const hbEnIc = k => { const D = EN[k], bn = D && D.boss ? BOSSES.find(b => b.type === k) : null; return D ? (D.tint || (bn && bn.tint) ? ['sp', D.sp, D.tint || bn.tint] : ['sp', D.sp]) : null; };
const hbEnName = k => { const D = EN[k], bn = D.boss ? BOSSES.find(b => b.type === k) : null; return bn ? bn.name : D.name; };
const hbEns = () => Object.keys(EN).filter(k => !EN[k].hidden);
// Händler auf der Weltkarte (wie openMerchant in js/ui.js): Preis, ab Stufe, Menge
const HB_SHOP = { erz: [45, 1, 5], leder: [45, 1, 5], kristall: [110, 1, 1], horn: [140, 1, 1], mithril: [180, 10, 1], adamant: [260, 16, 1], schuppe: [480, 28, 1] };
const hbAct = st => Math.floor((st - 1) / 7) + 1;   // Kampagnen-Stufe → Akt
const hbBand = k => typeof MK_BAND === 'undefined' ? -1 : MK_BAND.findIndex(b => b.includes(k));
const hbBandN = b => [_t('häufig'), _t('selten'), _t('sehr selten')][b] || _t('häufig');

// Sammeln in den Landen (wie gatherYield in js/bauen.js): welche Pflanzen und Felsen das Material geben, Biome aus den Daten
function hbGather(k) {
  if (typeof LANDE_BIOMES === 'undefined' || typeof GPROP === 'undefined') return [];
  const R = [], L = (ic, t, d) => R.push({ id: 'lande:sammeln', ic, t, d });
  switch (k) {
    case 'holz': L(hbProp('eiche'), _t('Bäume in den Endlosen Landen'), _t('2–4 Holz je Baum – je weiter draußen, desto mehr (bis zu dreimal so viel). Kakteen und Knochenbäume geben manchmal 1, Sternenbäume 1–2.')); break;
    case 'stein': L(hbProp('fels'), _t('Felsen und Steine in den Endlosen Landen'), _t('Große Felsen geben 3–5 Stein, kleine Steine 1–3 – tief draußen mehr. Auch Säulen, Kristalle und Korallen geben etwas.')); break;
    case 'faser': L(hbProp('busch'), _t('Büsche, Pilze und Kakteen'), _t('Büsche geben 1–2 Fasern, Pilze und Kakteen 2–3, Riesenpilze doppelt so viel. Kräuterbeete in den Landen manchmal 1.')); break;
    case 'samen': L(hbProp('busch'), _t('Büsche, Pilze, Bäume und Kräuterbeete'), _t('Büsche (45 %), Pilze (50 %) und Bäume (12 %) lassen manchmal einen Samen fallen. Kräuterbeete in den Landen geben immer 1–2, Vogelnester manchmal einen.')); break;
    case 'feder': L(hbProp('eiche'), _t('Vogelnester in den Bäumen der Lande'), _t('Etwa jeder 40. Baum trägt ein Nest. Beim ersten Treffer fällt es herunter: 2–4 Federn, weit draußen eine mehr. Büsche geben selten eine Feder.')); break;
    case 'eisenholz':
      L(hbProp('eiche'), _t('Bäume tiefer in den Landen'), _t('Ab Stufe 13 (etwa {km} vom Weltentor) gibt jeder Baum manchmal 1–2 Eisenholz. Je tiefer, desto öfter – bis fast jeder zweite Baum.', { km: hbKmAt(13) }));
      L(hbProp('tanne'), _t('Alte und dunkle Wälder: hier am meisten'), _t('In diesen Biomen gibt es viel mehr Eisenholz: {list}.', { list: hbBioN((B, id) => GEISEN[id]) }));
      L(hbProp('eiche'), _t('Weltenbäume: immer'), _t('Ein riesiger Weltenbaum gibt immer Eisenholz – gleich 3–6 Stück. Du findest sie als Wahrzeichen mancher Regionen und im {list}.', { list: hbBioN(B => hbTr(B, 'riese')) }));
      break;
    case 'sternholz':
      L(hbProp('eiche'), _t('Bäume weit draußen'), _t('Ab Stufe 55 (etwa {km} vom Weltentor) geben Bäume manchmal Sternholz – viel öfter in: {list}.', { km: hbKmAt(55), list: hbBioN((B, id) => GSTERN[id]) }));
      L(['mat', 'sternholz'], _t('Sternen- und Glasbäume'), _t('Geben immer 1–2 Sternholz. Sie wachsen in: {list}.', { list: hbBioN(B => hbTr(B, 'sternbaum', 'glasbaum')) }));
      break;
    case 'marmor':
      L(hbProp('fels'), _t('Felsen tiefer in den Landen'), _t('Ab Stufe 16 (etwa {km} vom Weltentor) geben Felsen und Steine manchmal Marmor.', { km: hbKmAt(16) }));
      L(['mat', 'marmor'], _t('Helle Felsen'), _t('Hier gibt fast jeder Fels Marmor: {list}.', { list: hbBioN(B => GMARMOR[B.rv] != null) }));
      L(hbProp('saeule'), _t('Alte Säulen'), _t('Säulen geben 2–4 Marmor: {list}. Kristalle und Korallen manchmal einen.', { list: hbBioN(B => hbTr(B, 'saeule')) }));
      break;
    case 'obsidian':
      L(hbProp('fels'), _t('Felsen weit draußen'), _t('Ab Stufe 36 (etwa {km} vom Weltentor) geben Felsen manchmal Obsidian.', { km: hbKmAt(36) }));
      L(['mat', 'obsidian'], _t('Dunkle Felsen'), _t('Hier gibt etwa jeder zweite Fels Obsidian: {list}.', { list: hbBioN(B => GOBS[B.rv] != null) }));
      L(hbProp('obs'), _t('Obsidianfelsen'), _t('Geben immer 1–3 Obsidian: {list}.', { list: hbBioN(B => hbTr(B, 'obs')) }));
      break;
    case 'knochen': L(hbProp('knochenbaum'), _t('Knochenbäume und Riesenschädel'), _t('Geben 2–3 Knochenstaub: {list}.', { list: hbBioN(B => hbTr(B, 'knochenbaum', 'schaedel')) })); break;
    case 'kristall': L(hbProp('kristall'), _t('Leuchtende Kristalle'), _t('Kristalle in den Landen geben manchmal einen Seelenkristall: {list}.', { list: hbBioN(B => hbTr(B, 'kristall')) })); break;
    case 'erz': L(hbProp('fels'), _t('Schrott und große Felsen'), _t('Rostiger Schrott gibt 2–3 Eisenerz ({list}), große Felsen manchmal 1–2.', { list: hbBioN(B => hbTr(B, 'zahnrad', 'ruest')) })); break;
    case 'mithril': L(hbProp('fels'), _t('Schrott weit draußen'), _t('Ab Stufe 14 gibt Schrott manchmal Mithrilerz: {list}.', { list: hbBioN(B => hbTr(B, 'zahnrad', 'ruest')) })); break;
  }
  return R;
}
const HB_GHK = { baum: () => _t('Bäume'), fels: () => _t('Große Felsen'), stein: () => _t('Steine'), busch: () => _t('Büsche') };
const HB_GHKI = { baum: 'eiche', fels: 'fels', stein: 'stein', busch: 'busch' };
// Wo man ein Material findet – Zeilen { id, ic, t, d }
function hbWhere(k) {
  const M = MATS[k], R = []; if (!M) return R;
  for (const g of hbGather(k)) R.push(g);
  // Holzplatz im Versteck
  if (typeof GHK !== 'undefined') for (const t in GHK) {
    const K = GHK[t], o = K.out[k], x = K.extra.find(e => e[0] === k); if (!o && !x) continue;
    R.push({ id: 'ver:holzplatz', ic: hbProp(HB_GHKI[t] || 'eiche'), t: _t('Holzplatz im Versteck: {what}', { what: (HB_GHK[t] || (() => t))() }), d: o ? _t('{n} je Stück · wächst in {t} nach', { n: hbRange(o[0], o[1]), t: esc(buildTimeText(K.grow)) }) : _t('{p} Chance auf {n}', { p: pct(x[1]), n: hbRange(x[2], x[3]) }) });
  }
  // Gegner (Beute-Tabellen)
  for (const e of hbEns().filter(e => EN[e].drop && EN[e].drop[k]).sort((a, b) => EN[b].drop[k] - EN[a].drop[k])) {
    const v = EN[e].drop[k];
    R.push({ id: 'en:' + e, ic: hbEnIc(e), t: esc(hbEnName(e)), d: v >= 1 ? _t('immer {n} Stück', { n: v }) : _t('{p} Chance – Elite-Gegner doppelt so oft und doppelt so viel', { p: pc1(v) }) });
  }
  if (k === 'schuppe') R.push({ id: 'en:bosse', ic: ['s', 16, 428, 32, 36], t: _t('Jeder Boss'), d: _t('1–3 Drachenschuppen – in der Drachenwoche fallen sie auch bei normalen Gegnern.') });
  if (k === 'aether') R.push({ id: 'start:qual', ic: ['mat', 'aether'], t: _t('Gegner in der Qual'), d: _t('Ab Akt 9 lässt jeder Gegner mit 3 % Chance einen Ätherkristall fallen, Elite dreimal so oft.') });
  // Erzadern: Kampagne (Gebiet je Akt) und Lande
  const ba = BIOMES.map((b, i) => b.vein === k ? _t('Akt {a}: {name}', { a: i + 1, name: esc(b.name) }) : null).filter(Boolean);
  if (ba.length) R.push({ id: 'start:kampagne', ic: ['mat', k], t: _t('Erzadern in der Kampagne'), d: _t('Hau mit Angriffen auf die Adern: 2–4 Stück. {list}', { list: ba.join(' · ') }) });
  if (k === 'erz') R.push({ id: 'start:kampagne', ic: ['mat', 'erz'], t: _t('Jede Erzader'), d: _t('Gibt oft 1–2 Eisenerz extra, egal welches Erz sie trägt.') });
  if (typeof lVeinMat === 'function' && k !== 'erz') { const L = hbBios((B, id) => lVeinMat(id, 0, () => 0) === k); if (L.length) R.push({ id: 'lande:sammeln', ic: ['mat', k], t: _t('Erzadern in den Endlosen Landen'), d: _t('Vor allem in: {list}.', { list: esc(L.map(id => LANDE_BIOMES[id].n).join(', ')) }) }); }
  // Truhen
  const mi = MONMATS.indexOf(k);
  if (mi >= 0) {
    const st = Math.max(1, (mi - 5) * 8 + 1);
    R.push({ id: 'start:kampagne', ic: ['s', 304, 416, 16, 16], t: _t('Truhen in der Kampagne'), d: mi < 6 ? _t('von Anfang an') : _t('ab Stufe {st} (Akt {a})', { st, a: hbAct(st) }) });
    if (typeof LCH !== 'undefined') { const ls = Math.max(0, (mi - 4) * 5); R.push({ id: 'lande:truhen', ic: ['s', 320, 416, 16, 16], t: _t('Truhen in den Endlosen Landen'), d: ls <= 6 ? _t('überall') : _t('ab Stufe {st} (etwa {km} vom Weltentor)', { st: ls, km: hbKmAt(ls) }) }); }
  }
  // Versteck: Erzmine und Kräutergarten (je Stufe, aus prodYield)
  for (const id of ['mine', 'garten']) {
    if (!BUILD[id]) continue; let first = 0;
    for (let lv = 1; lv <= BUILD[id].lv.length && !first; lv++) if ((hbLv(id, lv, () => prodYield(id, 10))[k] || 0) > 0) first = lv;
    if (first) { const n = hbLv(id, first, () => prodYield(id, 10))[k], m = hbLv(id, BUILD[id].lv.length, () => prodYield(id, 10))[k]; R.push({ id: 'bld:' + id, ic: ['pa', BUILD[id].icon], t: _t('{name} ab Stufe {lv}', { name: esc(BUILD[id].n), lv: first }), d: _t('Je 10 geschaffte Räume etwa {n} – auf der höchsten Stufe {m}.', { n, m }) }); }
  }
  // Acker
  for (const c of CROPORDER) { const C = CROPS[c]; if (!C.out[k] || !(C.out[k][1] > 0)) continue; R.push({ id: 'ver:acker', ic: ['mat', Object.keys(C.out)[0]], t: _t('Acker: {crop} (ab Garten-Stufe {lv})', { crop: esc(C.n), lv: C.lv }), d: _t('Saat: {seed} · wächst {t} · Ernte: {out}', { seed: hbCostTxt(C.seed), t: esc(buildTimeText(C.t)), out: hbCostTxt(Object.fromEntries(Object.keys(C.out).filter(m => C.out[m][1] > 0).map(m => [m, hbRange(C.out[m][0], C.out[m][1])]))) }) }); }
  // Juwelier: Veredeln
  for (const [f, t, n, g] of TRANSMUTE) if (t === k) R.push({ id: 'fg:veredeln', ic: ['mat', f], t: _t('Veredeln beim Juwelier'), d: _t('{n} {from} → 1 {to}, dazu {g} Gold', { n, from: esc(MATS[f].n), to: esc(M.n), g }) });
  // Händler, Basar
  if (HB_SHOP[k]) { const [p, st, n] = HB_SHOP[k]; R.push({ id: 'han:haendler', ic: ['sp', 'dwarf'], t: _t('Händler Borin auf der Weltkarte'), d: (n > 1 ? _t('{n} Stück für {g} Gold', { n, g: p }) : _t('1 Stück für {g} Gold', { g: p })) + (st > 1 ? ' · ' + _t('ab Stufe {st} (Akt {a})', { st, a: hbAct(st) }) : '') }); }
  const b = hbBand(k); if (b >= 0) R.push({ id: 'han:basar', ic: ['pa', 'basar'], t: _t('Basar: manchmal im Angebot'), d: [_t('solange dein bester Held unter Level 12 ist'), _t('wenn dein bester Held Level 12–27 ist'), _t('ab Level 28 deines besten Helden')][b] });
  return R;
}
// Kosten als Text („2 Samen, 1 Eisenholz“), Werte dürfen schon Spannen sein
function hbCostTxt(c) { return esc(Object.keys(c).map(k => c[k] + ' ' + (MATS[k] ? MATS[k].n : k)).join(', ')); }
// Spanne über viele Kosten: { mat: [min, max] }
function hbSpan(list) { const r = {}; for (const c of list) for (const k in c) { if (!(c[k] > 0)) continue; const v = r[k] || [1e9, 0]; r[k] = [Math.min(v[0], c[k]), Math.max(v[1], c[k])]; } return r; }
// Wofür man ein Material braucht – Zeilen { id, ic, t, d, n (Summe) }
function hbUses(k) {
  const R = []; if (!MATS[k]) return R;
  for (const id of BUILDORDER) {
    const B = BUILD[id]; if (!B.lv) continue; const L = []; let sum = 0;
    B.lv.forEach((c, i) => { if (c[k]) { L.push(_t('Stufe {lv}: {n}', { lv: i + 1, n: c[k] })); sum += c[k]; } });
    if (L.length) R.push({ id: 'bld:' + id, ic: ['pa', B.icon], t: esc(B.n), d: esc(L.join(' · ')), r: _t('Σ {n}', { n: hbNum(sum) }), n: sum });
  }
  const sp = (o, f) => { const s = hbSpan(o)[k]; return s ? f(hbRange(s[0], s[1])) : null; };
  hbNoWeek(() => {
    for (const slot of ['weapon', 'armor']) { const L = []; for (let u = 1; u <= 10; u++) { const n = upCost({ slot, tier: 0 }, u).mats[k]; if (n) L.push('+' + u + ': ' + n); } if (L.length) R.push({ id: 'fg:aufwerten', ic: ['pa', 'wbup'], t: slot === 'weapon' ? _t('Aufwerten von Waffen') : _t('Aufwerten von Rüstung und Helm'), d: esc(L.join(' · ')) }); }
    const fz = []; for (let f = 0; f < 5; f++) for (let r = 0; r <= 4; r++) fz.push(fuseCost({ tier: 0, fz: f, rar: r }, null).mats);
    const a = sp(fz, s => _t('{n} je Verschmelzung', { n: s })); if (a) R.push({ id: 'fg:verschmelzen', ic: ['pa', 'amboss'], t: _t('Verschmelzen'), d: a });
    if (typeof affRerollCost === 'function') { const L = []; for (let n = 0; n <= 20; n++) L.push(affRerollCost({ tier: 0, rr: n }).mats); const b = sp(L, s => _t('{n} je Umschmieden – jedes Mal am selben Gegenstand mehr', { n: s })); if (b) R.push({ id: 'fg:umschmieden', ic: ['pa', 'amboss'], t: _t('Zusatzwert umschmieden'), d: b }); }
    if (typeof affRefineCost === 'function') { const L = []; for (let s = 1; s < AFF_MAX; s++) { const c = affRefineCost({ slot: 'weapon', tier: 0, aff: { krit: affVal(AFFW, 'krit', s) } }, 'krit'); if (c.mats[k]) L.push(_t('Stufe {s}: {n}', { s: s + 1, n: c.mats[k] })); } if (L.length) R.push({ id: 'fg:umschmieden', ic: ['pa', 'amboss'], t: _t('Zusatzwert veredeln'), d: esc(L.join(' · ')) }); }
    if (typeof combCost === 'function') { const L = []; for (let g = 1; g < 10; g++) { const n = combCost(g).mats[k]; if (n) L.push(_t('Stufe {a} → {b}: {n}', { a: g, b: g + 1, n })); } if (L.length) R.push({ id: 'fg:bauteile', ic: ['pa', 'amboss'], t: _t('Bauteile kombinieren'), d: esc(L.join(' · ')) }); }
  });
  { const L = []; FORGE.forEach((F, t) => { if (F.w[k]) L.push(_t('Waffe aus {mat}: {n}', { mat: MAT[t].n, n: F.w[k] })); if (F.a[k]) L.push(_t('Rüstung aus {mat}: {n}', { mat: MAT[t].n, n: F.a[k] })); }); if (L.length) R.push({ id: 'fg:schmieden', ic: ['pa', 'amboss'], t: _t('Schmieden und Meisterwerke'), d: esc(L.join(' · ')) }); }
  for (const Rc of RECIPES) if (Rc.cost[k]) R.push({ id: 'fg:rezepte', ic: ['pa', 'kessel'], t: esc(Rc.n), d: _t('{n} je Mal', { n: Rc.cost[k] }) });
  for (const [f, t, n, g] of TRANSMUTE) if (f === k) R.push({ id: 'fg:veredeln', ic: ['mat', t], t: _t('Veredeln zu {mat}', { mat: esc(MATS[t].n) }), d: _t('{n} → 1, dazu {g} Gold', { n, g }) });
  for (const E_ of ELIXIRS) if (E_.cost[k]) R.push({ id: 'start:traenke', ic: ['pa', 'kessel'], t: esc(E_.n), d: _t('{n} je Elixier', { n: E_.cost[k] }) });
  for (const D of DYES) if (D.cost[k]) R.push({ id: 'it:aussehen', ic: ['pa', 'spiegel'], t: _t('Farbstoff: {name}', { name: esc(D.n) }), d: _t('{n} zum Freischalten', { n: D.cost[k] }) });
  for (const c of CROPORDER) if (CROPS[c].seed[k]) R.push({ id: 'ver:acker', ic: ['pa', 'garten'], t: _t('Acker: {crop} säen', { crop: esc(CROPS[c].n) }), d: _t('{n} je Beet', { n: CROPS[c].seed[k] }) });
  if (typeof BIRDS !== 'undefined') for (const b of BIRDORDER) if (BIRDS[b].mats[k]) R.push({ id: 'ver:voegel', ic: ['pa', 'v_' + b], t: _t('Vogelhaus: {bird} aufziehen', { bird: esc(BIRDS[b].n) }), d: _t('{n} je Vogel', { n: BIRDS[b].mats[k] }) });
  if (typeof PET_TIERS !== 'undefined') {
    PET_TIERS.forEach((T_, t) => { const f = T_.food.find(x => x[0] === k); if (f) R.push({ id: 'egg:' + t, ic: () => eggURL(t, 0), t: _t('Futter im Brutnest: {egg}', { egg: esc(T_.egg) }), d: _t('{n} je Fütterung', { n: f[1] }) }); });
    for (const s of PET_SLOTS) { const c = PET_SLOT[s].cost.find(x => x[0] === k); if (c) R.push({ id: 'pet:ausruestung', ic: ['pa', 'nest'], t: _t('Begleiter-Ausrüstung: {slot}', { slot: esc(PET_SLOT[s].n) }), d: _t('{n} je Stück', { n: c[1] }) }); }
    for (const s of PET_SPELLS) { const c = PET_SPELL[s].cost.find(x => x[0] === k); if (c) R.push({ id: 'pet:zauber', ic: ['pa', 'nest'], t: _t('Zauberrune: {spell}', { spell: esc(PET_SPELL[s].n) }), d: _t('{n} je Rune', { n: c[1] }) }); }
    if (PET_FEED[k]) { const M_ = petM(), fav = PET_ORDER.filter(sp => PET_SP[sp].fav === k && M_ && M_.seen.includes(sp)).map(sp => PET_SP[sp].n); R.push({ id: 'pet:futter', ic: ['pa', 'nest'], t: _t('Begleiter füttern'), d: _t('{n} EP je Stück', { n: PET_FEED[k] }) + (fav.length ? ' · ' + _t('Lieblingsfutter von: {list} (doppelt)', { list: esc(fav.join(', ')) }) : '') }); }
  }
  return R;
}
function hbMatBody(k) {
  const M = MATS[k], b = hbBand(k), mv = typeof MK_MATV !== 'undefined' ? MK_MATV[k] : 0, U = hbUses(k), W = hbWhere(k);
  return hKv([[_t('ART'), M.res ? _t('Rohstoff zum Bauen') : _t('Material von Gegnern')], [_t('SELTENHEIT'), hbBandN(b)], mv ? [_t('MARKTWERT'), _t('etwa {n} Gold je Stück', { n: hbNum(mv) })] : null, hbHero() ? [_t('IN DEINEM VORRAT'), hbNum(P.mats[k] || 0)] : null])
    + hP(M.res ? _t('Rohstoffe liegen im Vorrat und brauchen keinen Platz im Beutel. In den Endlosen Landen landen sie im Sammelbeutel – erst wenn du heimkehrst, gehören sie dir.') : _t('Materialien liegen im Vorrat und brauchen keinen Platz im Beutel.'))
    + hH(_t('WO FINDEN')) + hRows(W)
    + hH(_t('WOFÜR')) + (U.length ? hRows(U) : hP(_t('Dafür gibt es gerade keine Verwendung – verkaufen oder tauschen.')));
}

/* ---------- Kapitel: Grundlagen ---------- */
function hbStart() {
  hbChap('start', _t('Grundlagen'), ['pa', 'held'], _t('Ziel, Steuerung, Schwierigkeit, Speichern'));
  E('start:ziel', _t('Worum geht es?'), { ic: ['sp', 'demon', 'rgba(210,30,10,.38)'], kw: 'ziel spiel story geschichte anfang start', see: ['start:kampagne', 'ver:versteck', 'lande:regeln', 'it:seltenheit'],
    s: _t('Der Uralte Drache hat das Weltenfeuer gestohlen. Bau dein Versteck wieder auf, schmiede Klingen aus Mithril, Adamant und Drachenschuppen – und hol dir zurück, was dem Orden gehört.'),
    b: () => hH(_t('SO SPIELST DU')) + hUl([_t('Auf der Weltkarte wählst du den nächsten Ort: Kampf, Elite, Händler, Schrein, Schatz und mehr.'), _t('Besiegte Gegner lassen Gold, Materialien und Ausrüstung fallen. Bessere Ausrüstung legst du im Charakter an.'), _t('Im Versteck baust du Schmiede, Labor, Schatzkammer und mehr aus – mit Gold, Materialien, Holz und Stein.'), _t('Am Ende jedes Akts wartet ein Boss. Nach 8 Akten ist die Geschichte erzählt – dann beginnt die Qual.'), _t('Ab Level 5 öffnet das Weltentor die Endlosen Lande: die beste Beute, aber auch das größte Risiko.')])
      + hP(_t('Wenn du etwas nicht weißt: Tippe auf das Fragezeichen und such danach. Hier steht alles drin.')) });
  E('start:kampagne', _t('Kampagne und Akte'), { ic: ['pa', 'ruin'], kw: 'akt akte karte geschichte boss story weltkarte erzader', see: ['start:karte', 'start:qual', 'en:bosse', 'start:tod'],
    s: _t('8 Akte, jeder mit eigener Karte, eigenem Gebiet und einem Boss am Ende.'),
    b: () => hP(_t('Jeder Akt ist eine Karte mit sieben Reihen von Orten. Du gehst Schritt für Schritt nach oben und wählst jedes Mal einen der leuchtenden Punkte. Ganz oben wartet der Boss. Danach geht es mit dem nächsten Akt weiter – vorher kannst du ins Versteck.'))
      + hH(_t('DIE AKTE')) + hRows(ACTS.map((A, i) => { const b = BOSSES[i], B = BIOMES[i]; return { id: b ? 'en:' + b.type : null, ic: b ? hbEnIc(b.type) : null, t: _t('Akt {a}: {t}', { a: i + 1, t: esc(A.t) }), d: _t('{biome} · Boss: {boss}', { biome: esc(B ? B.name : ''), boss: esc(b ? b.name : '') }) }; }))
      + hH(_t('STUFE')) + hP(_t('Jeder Ort hat eine Stufe: Akt 1 beginnt bei Stufe 1, jeder Akt bringt 7 Stufen dazu. Je höher die Stufe, desto stärker die Gegner und desto besser die Beute.')) });
  E('start:karte', _t('Orte auf der Weltkarte'), { ic: ['pa', 'frage'], kw: 'knoten orte karte elite champion schatz händler schrein werkbank rast rätsel ereignis', see: ['start:schreine', 'han:haendler', 'fg:werkbank'],
    s: _t('Was dich an den Punkten der Karte erwartet.'),
    b: () => hRows(Object.keys(NODE).map(k => ({ ic: NODE[k].icon, t: esc(NODE[k].n), d: esc(NODE[k].d) }))) + hNote(_t('Tipp: Nebel verdeckt die Orte weiter oben. Plane deinen Weg – manchmal lohnt ein Umweg über den Händler oder die Werkbank.')) });
  E('start:qual', _t('Qual-Stufen'), { ic: ['mat', 'aether'], kw: 'qual endgame schwer akt 9 leere', see: ['start:kampagne', 'mat:aether', 'en:tausend'],
    s: _t('Nach Akt 8 geht es endlos weiter – jede Qual-Stufe härter und mit besserer Beute.'),
    b: () => hP(esc(QUAL_INTRO)) + hRows([1, 2, 3, 5, 8, 12].map(q => ({ ic: ['mat', 'aether'], t: _t('Qual {q} (Akt {a})', { q, a: STORY_ACTS + q }), d: _t('Gegner +{p} % stärker', { p: hbNum((Math.pow(1.3, q) - 1) * 100) }) })))
      + hP(_t('In der Qual lassen Gegner Ätherkristalle fallen, und Bosse können mythische Gegenstände tragen.')) });
  E('start:schwierig', _t('Schwierigkeit und Hardcore'), { ic: ['s', 288, 432, 16, 16], kw: 'normal albtraum hölle hardcore hc schwierigkeit tod', see: ['han:ruhm', 'start:tod'],
    s: _t('Wählst du beim neuen Helden. Schwerer heißt: bessere Beute.'),
    b: () => hRows(Object.keys(DIFFS).map(k => { const D = DIFFS[k]; return { ic: ['s', 288, 432, 16, 16], t: esc(D.n), d: esc(D.d) + ' · ' + _t('Gegner-LP ×{hp}, Schaden ×{dmg}, Beute ×{loot}', { hp: D.hp.toLocaleString(LOCALE), dmg: D.dmg.toLocaleString(LOCALE), loot: D.loot.toLocaleString(LOCALE) }) }; }))
      + hH(_t('HARDCORE')) + hP(_t('Ein Tod löscht den Helden. Dafür Ruhm in der Ruhmeshalle.')) + hP(_t('Das gilt nur für diesen Helden – Versteck, Lager und Erfolge bleiben.')) });
  E('start:tod', _t('Wenn du fällst'), { ic: ['s', 288, 432, 16, 16], kw: 'sterben tod gestorben verlieren gold', see: ['lande:regeln', 'start:schwierig'],
    s: _t('In der Kampagne verlierst du nur etwas Gold.'),
    b: () => hUl([_t('Kampagne: Du verlierst 20 % deines Golds. Level, Ausrüstung und Materialien bleiben. Du kannst den Raum wiederholen oder zur Karte zurück.'), _t('Hardcore: Der Held ist für immer fort und kommt in die Ruhmeshalle.'), _t('Endlose Lande: Ausrüstung, Rucksack und Sammelbeutel sind verloren – nur die Begleiter-Tasche kommt heim.'), _t('Übungskampf im Boss-Kodex: kostet nichts.')]) });
  E('start:handy', _t('Steuerung am Handy'), { ic: ['pa', 'held'], kw: 'touch handy tablet joystick knöpfe steuerung tippen', see: ['start:pc', 'start:einst'], go: ['controls'],
    s: _t('Linke Seite: laufen. Rechte Seite: Knöpfe.'),
    b: () => hP(_t('Linke Seite ziehen: laufen. Angriff halten (3er-Kombo) – über den Knopf wischen zielt von Hand. Rolle, drei Fähigkeiten, Ultimative (goldene Wut-Leiste). Der Trank sitzt links oben. Alle Knöpfe lassen sich unter Einstellungen → Steuerung verschieben.'))
      + hUl([_t('Joystick FREI erscheint dort, wo du hintippst – FEST bleibt an einer Stelle.'), _t('Heiltrank: tippen, halten (nie aus Versehen) oder automatisch unter 30 % LP.'), _t('Die Rolle macht dich kurz unverwundbar – damit kommst du durch Angriffe hindurch.'), _t('Die Ultimative lädt sich mit jedem Treffer auf (goldene Leiste).'), _t('Im Versteck und in den Landen erscheint ein Knopf zum Interagieren, wenn du nah genug bist.')]) });
  E('start:pc', _t('Steuerung am PC'), { ic: ['pa', 'held'], kw: 'pc maus tastatur tasten wasd keyboard mouse f1 esc', see: ['start:handy', 'start:einst'], go: ['controls'],
    s: _t('Maus zum Zielen, WASD zum Laufen, 1 bis 5 für Fähigkeiten und Trank.'),
    b: () => (typeof pcKeysHTML === 'function' ? pcKeysHTML().replace(/<h3>[^<]*<\/h3>/, '') : '') + hUl([_t('Angriffe und Fähigkeiten zielen auf den Mauszeiger.'), _t('F1 öffnet dieses Handbuch, Esc geht hier einen Schritt zurück, / springt in die Suche.'), _t('Im Vollbild ist alles größer: Knopf „Vollbild“ im Hauptmenü, in der Pause und in den Einstellungen.')]) });
  E('start:level', _t('Level, Erfahrung und Talente'), { ic: ['pa', 'buch'], kw: 'level ep erfahrung xp talent talentpunkt zurücksetzen respec 100 aufstieg', see: ['cls:talente', 'cls:mtal', 'start:lvbel', 'start:paragon', 'bld:bibliothek'], go: ['tal', 'lvr'],
    s: _t('Bis Level {n} bekommst du für jedes Level einen Talentpunkt und eine Belohnung.', { n: LVMAX }),
    b: () => hUl([_t('Erfahrung gibt es für jeden besiegten Gegner – Bosse und Elite geben viel mehr.'), _t('Jedes Level: mehr Leben und Schaden, ein Talentpunkt (Charakter → TALENTE) und eine Level-Belohnung (Charakter → AUFSTIEG).'), _t('Bis Level 30 geht es schnell, bis 60 zügig. Ab 80 dauert jedes Level lange, ab 90 viele Stunden – Level {n} ist eine echte Leistung.', { n: LVMAX }), _t('Über Level 50 wirst du nur noch wenig stärker – die Meister-Talente machen den Unterschied.'), _t('Talente zurücksetzen kostet Gold: 50 + 25 je Level.'), _t('Die Bibliothek im Versteck gibt bis zu +50 % Erfahrung.')])
      + hRows([10, 30, 35, 50, 70, 80, 90, 99].map(l => ({ ic: ['pa', 'buch'], t: _t('Level {lv} → {n}', { lv: l, n: l + 1 }), d: _t('{n} Erfahrung', { n: hbNum(xpNext(l)) }) })))
      + hKv([[_t('HÖCHSTES LEVEL'), String(LVMAX)], [_t('TALENTPUNKTE'), String(LVMAX - 1)], [_t('DANACH'), _t('Paragon')]]) });
  E('start:lvbel', _t('Level-Belohnungen'), { ic: ['pa', 'truhe'], kw: 'level belohnung belohnungen aufstieg zeitleiste meilenstein titel kosmetik umhang flügel aura gold bauteil ei', see: ['start:level', 'cls:mtal', 'it:aussehen', 'start:paragon'], go: ['lvr'],
    s: _t('Jedes Level von 2 bis {n} bringt sofort eine Belohnung.', { n: LVMAX }),
    b: () => hUl([_t('Jedes Level: Gold, ein Material, ein Rohstoff und ein Bauteil – je höher das Level, desto mehr und besser.'), _t('Alle 5 Level Glücksmünzen, alle 10 Level ein epischer oder legendärer Gegenstand für deine Klasse oder ein Ei, bei Level {n} ein mythischer Gegenstand.', { n: LVMAX }), _t('Springst du mehrere Level auf einmal, bekommst du jede Belohnung.'), _t('Charakter → AUFSTIEG zeigt die Zeitleiste: was du schon hast, was als Nächstes kommt und die großen Meilensteine.')])
      + hH(_t('MEILENSTEINE')) + hRows([60, 70, 80, 90, 100].map(L => { const E_ = typeof lvReward === 'function' ? lvReward(L).filter(e => e.t === 'cos' || e.t === 'title') : []; return { ic: ['pa', 'truhe'], t: _t('Level {lv}', { lv: L }), d: esc(E_.map(e => typeof lvrName === 'function' ? lvrName(e) : '').join(' · ')) }; }))
      + hP(_t('Kosmetik und Titel gelten für alle deine Helden – hat schon ein anderer Held sie geholt, gibt es stattdessen 3 Glücksmünzen. Titel wählst du unter AUFSTIEG oder bei den Aufträgen.'))
      + hNote(_t('Jedes Level gibt seine Belohnung nur einmal je Held – auch nach einer Wiedergeburt. Helden von vor dem Update bekommen für schon erreichte Level nichts nachgezahlt.')) });
  E('start:paragon', _t('Paragon und Wiedergeburt'), { ic: ['pa', 'muenze'], kw: 'paragon wiedergeburt rebirth level 100 endgame', see: ['start:level', 'start:lvbel'],
    s: _t('Ab Level {n} wirst du ohne Grenze stärker.', { n: LVMAX }),
    b: () => hP(_t('Ab Level {n} sammelst du Paragon-Erfahrung. Jeder Paragon-Level gibt einen Punkt – ohne Obergrenze.', { n: LVMAX })) + hUl([_t('Je Punkt: +1 % Schaden, +1 % Lebenspunkte, +1 Verteidigung oder +0,2 % Krit.'), _t('Ein Paragon-Level braucht {n} Erfahrung.', { n: hbNum(PARAGON_XP) }), _t('Paragonpunkte von früher (damals ab Level 50) bleiben und wirken weiter. Neue gibt es ab Level {n}.', { n: LVMAX })])
      + hH(_t('WIEDERGEBURT')) + hP(_t('Ab Level {lv} und Akt 5: zurück auf Level 1 und Akt 1. Ausrüstung, Materialien, Gold und Paragon bleiben – dafür dauerhaft +10 % Schaden und Leben je Wiedergeburt und eine goldene Aura.', { lv: REBIRTH_LV }))
      + hP(_t('Level-Belohnungen gibt es danach erst wieder für Level, die dieser Held noch nie erreicht hat.')) });
  E('start:traenke', _t('Heiltränke und Elixiere'), { ic: ['s', 288, 336, 16, 16], kw: 'trank tränke heilen heiltrank elixier potion alchemie', see: ['bld:alchemie', 'mat:schleim', 'ver:acker'],
    s: _t('Tränke heilen sofort, Elixiere stärken dich für 3 Räume.'),
    b: () => hP(_t('Ein Heiltrank heilt einen Teil deiner Lebenspunkte und braucht danach 6 Sekunden, bis der nächste geht. Wie viele du tragen kannst und wie stark sie heilen, hängt vom Alchemielabor ab.'))
      + hRows(BUILD.alchemie.lv.map((_, i) => i + 1).filter(l => [1, 3, 5, 8, 10].includes(l)).map(l => hbLv('alchemie', l, () => ({ ic: ['pa', 'kessel'], t: _t('Alchemielabor Stufe {lv}', { lv: l }), d: _t('{n} Tränke, heilen {p}', { n: potMax(), p: pct(potHeal()) }) }))))
      + hP(_t('Tränke bekommst du beim Händler, in Truhen, aus Heilkraut im Acker, aus dem Kräutergarten und beim Brauen (2 Tränke aus 1 Schleimkern).'))
      + hH(_t('ELIXIERE (AB ALCHEMIE-STUFE 3)')) + hRows(ELIXIRS.map(E_ => ({ ic: ['pa', 'kessel'], t: esc(E_.n), d: esc(E_.d) + hCost(E_.cost, E_.gold) }))) });
  E('start:schreine', _t('Schreine, Ereignisse und Rätsel'), { ic: ['fx', 'sparks', 2], kw: 'schrein segen fluch ereignis rätsel sphinx brunnen altar', see: ['start:karte', 'han:muenzen'],
    s: _t('Besondere Orte auf der Karte mit Segen, Wahl und Glück.'),
    b: () => hH(_t('SCHREINE')) + hP(_t('Drei Altäre – du darfst nur einen berühren.')) + hRows(SHRINES.map((S, i) => ({ ic: ['fx', 'sparks', i % 6], t: esc(S.n), d: esc(S.d) })))
      + hH(_t('EREIGNISSE')) + hRows(EVENTS.map(E_ => ({ ic: NODE.event.icon, t: esc(E_.n), d: esc(E_.d) })))
      + hH(_t('RÄTSELKAMMER')) + hP(_t('Richtig: Glücksmünze, Edelstein und Gold. Falsch: Die Sphinx lässt ihre Wächter los.')) });
  E('start:daily', _t('Tages-Challenge'), { ic: ['pa', 'muenze'], kw: 'tages challenge daily täglich punkte', see: ['han:ruhm', 'han:muenzen'],
    s: _t('Jeden Tag neue Räume und neue Gegner-Affixe – für alle gleich.'),
    b: () => hUl([_t('Du spielst mit deinem Helden, aber Gold und Beute bleiben unverändert – die Challenge ist ein Wettkampf um Punkte.'), _t('Belohnung: 300 Gold, ein Edelstein und 2 Glücksmünzen.'), _t('Deine besten Ergebnisse stehen in der Ruhmeshalle.')]) });
  E('start:speichern', _t('Speichern und Übertragen'), { ic: ['pa', 'truhe'], kw: 'speichern spielstand code übertragen gerät app installieren backup', see: ['start:sprachen', 'han:tauschen'], go: ['code'],
    s: _t('Das Spiel speichert von selbst. Mit einem Code nimmst du alles auf ein anderes Gerät mit.'),
    b: () => hP(_t('Kopiere den Code auf einem Gerät und füge ihn auf dem anderen ein. Er enthält alle Helden, das Versteck, Erfolge und das Bestiarium. Alte Codes aus Version 1 bis 3 funktionieren auch.'))
      + hUl([_t('Gespeichert wird im Browser auf diesem Gerät – nach jedem Raum und bei jedem Kauf.'), _t('Als App installiert spielt Klingenhort auch ohne Internet.'), _t('Als App: in Safari auf TEILEN und dann „Zum Home-Bildschirm“ tippen.')]) });
  E('start:sprachen', _t('Sprachen'), { ic: ['pa', 'buch'], kw: 'sprache language englisch english türkisch spanisch italienisch französisch', see: ['start:einst'],
    s: _t('Das Spiel gibt es in sechs Sprachen.'),
    b: () => hUl(Object.keys(LANGS).map(c => esc(LANGS[c]) + (c === LANG ? ' ✓' : ''))) + hP(_t('Die Sprache wählst du mit 🌐 im Hauptmenü oder in den Einstellungen. Der Spielstand bleibt dabei erhalten.')) });
  E('start:einst', _t('Einstellungen'), { ic: ['pa', 'amboss'], kw: 'einstellungen musik ton schrift grafik hd pixel vollbild wackeln beute filter', see: ['start:handy', 'start:pc', 'start:sprachen', 'start:beute'], go: ['settings'],
    s: _t('Musik, Ton, Schriftgröße, Grafik und Steuerung.'),
    b: () => hUl([_t('Musik und Soundeffekte an oder aus.'), _t('Schrift: GROSS macht Texte in Menüs besser lesbar.'), _t('Wackeln & Blitzen: AUS beruhigt Bildschirmwackeln und Blitze.'), _t('Grafik: HD (scharf) oder Pixel (schnell) – auf langsamen Geräten stellt das Spiel selbst um.'), _t('Steuerung: Knöpfe verschieben und vergrößern, Trank, Zielhilfe, Vibration.'), _t('Beute-Filter: Gewöhnliches und Magisches aufheben, gleich verkaufen oder liegen lassen.')]) + hP(_t('Die Einstellungen erreichst du im Hauptmenü und während des Spiels über die Pause.')) });
  // 6.3: Schnell-Ausrüsten und Beute-Filter
  E('start:bestes', _t('Bestes anlegen'), { ic: ['pa', 'held'], kw: 'bestes anlegen ausrüsten schnell automatisch ausrüstung besser beutel schlechteres verkaufen aufräumen', see: ['it:seltenheit', 'start:beute', 'fg:mods'], go: ['gear'],
    s: _t('Ein Knopf im Charakter legt das Beste aus deinem Beutel an.'),
    b: () => hUl([_t('Charakter → AUSRÜSTUNG → „Bestes anlegen“: für Waffe, Rüstung und Helm je das stärkste Teil aus dem Beutel.'), _t('Verglichen wird wie beim Aufheben – Mods, Sockelsteine, Aufwertung und Zusatzwerte zählen mit.'), _t('Nie wird etwas Besseres abgelegt, und nur, was deine Klasse tragen kann. Ein Set mit aktivem Bonus bleibt angelegt.'), _t('Danach siehst du kurz, was sich geändert hat und um wie viel es besser ist. In den Endlosen Landen geht das nicht.'), _t('„Schlechteres verkaufen“ daneben verkauft alles Gewöhnliche und Magische, das schlechter ist als deine Ausrüstung oder das deine Klasse nicht tragen kann – erst nach einem zweiten Tippen. Aufgewertetes, Gesockeltes und Gegenstände mit Mods bleiben.')]) });
  E('start:beute', _t('Beute-Filter'), { ic: ['pa', 'truhe'], kw: 'beute filter automatisch verkaufen liegen lassen wegwerfen wegschmeißen marktwert wert grenze gewöhnlich magisch selten episch aufheben einstellungen', see: ['start:einst', 'it:seltenheit', 'lande:taschen'], go: ['settings'],
    s: _t('Beute nach Seltenheit oder Marktwert gleich verkaufen, liegen lassen oder wegwerfen – einstellbar in den Einstellungen.'),
    b: () => hUl([_t('Einstellungen → „Beute-Filter“: für Gewöhnlich, Magisch, Selten und Episch je Aufheben, Verkaufen, Liegen lassen oder Wegwerfen.'), _t('Nach Marktwert: Mit − und + stellst du eine Grenze ein (50 bis 500.000 Gold). Was darunter liegt, wird weggeworfen, verkauft oder liegen gelassen – du wählst. Das gilt überall dort, wo bei der Seltenheit „Aufheben“ steht.'), _t('Verkaufen gibt sofort den Händlerpreis, als kleine goldene Zahl über deinem Helden. Wegwerfen: Der Gegenstand verschwindet, sobald du darüber läufst – kein Gold, kein Platz im Beutel.'), _t('Was besser ist als deine Ausrüstung, hebst du immer auf. Legendär, Set und Mythisch hebst du immer auf – ebenso alles mit Mods, Sockelsteinen oder Aufwertung.'), _t('In den Endlosen Landen gelten „Liegen lassen“ und „Wegwerfen“ auch. „Verkaufen“ dort nicht: Es gibt keinen Händler – die Beute kommt in den Rucksack und erst beim Entkommen heim.')]) });
  E('start:handbuch', _t('So benutzt du das Handbuch'), { ic: ['pa', 'buch'], kw: 'hilfe handbuch suche suchen fragezeichen help', see: ['faq:eisenholz'],
    s: _t('Oben suchen, links blättern, auf eine Zeile tippen.'),
    b: () => hUl([_t('Tipp oben ein Wort ein – auch Fragen gehen, zum Beispiel „Wie macht man Eisenholz?“.'), _t('Groß- und Kleinschreibung und Umlaute sind egal: „kraeuter“ findet „Kräuter“.'), _t('Zeilen mit › führen zu einer anderen Seite. Unten auf jeder Seite stehen passende Einträge.'), _t('„Zurück“ geht einen Schritt zurück, × schließt das Handbuch – dein Spiel wartet genau dort, wo du warst.'), _t('Das Handbuch findest du im Hauptmenü (?), in der Pause, in den Einstellungen, unter „Mehr“ auf der Karte und in der Bibliothek.')]) });
}

/* ---------- Kapitel: Häufige Fragen ---------- */
function hbFaq() {
  hbChap('faq', _t('Häufige Fragen'), ['pa', 'frage'], _t('Schnelle Antworten'));
  const F = (id, q, to, a, kw) => E('faq:' + id, q, { ic: ['pa', 'frage'], kw: kw || '', see: [to], s: a, b: () => hRows([hbLink(to) ? { id: to, ic: hbLink(to).ic, t: _t('Mehr dazu: {t}', { t: esc(hbLink(to).t) }) } : null]) });
  const C = CROPS.eisenbaum;
  F('eisenholz', _t('Wie bekomme ich Eisenholz?'), 'mat:eisenholz', _t('Fälle Bäume tief in den Endlosen Landen – am meisten in alten und dunklen Wäldern wie {list}. Weltenbäume geben immer welches. Ab Garten-Stufe {lv} wächst es auch im Acker: {crop} ({seed}) → {out} in {t}.', { list: hbBioN((B, id) => GEISEN[id]), lv: C.lv, crop: esc(C.n), seed: hbCostTxt(C.seed), out: hbRange(C.out.eisenholz[0], C.out.eisenholz[1]) + ' ' + esc(MATS.eisenholz.n), t: esc(buildTimeText(C.t)) }), 'eisenholz eisen holz');
  F('holz', _t('Wo finde ich Holz und Stein?'), 'mat:holz', _t('Am Holzplatz deines Verstecks (links am Rand): Hau auf Bäume und Felsen, sie wachsen nach. Mehr gibt es in den Endlosen Landen. Stein fördert auch die Erzmine.'), 'holz stein');
  F('bauen', _t('Wie baue ich mein Versteck aus?'), 'ver:bauen', _t('Geh im Versteck zu einem Gerüst oder Gebäude und tippe auf „Errichten“ oder „Ausbauen“. Du brauchst Gold und Material, dann läuft die Bauzeit – auch wenn das Spiel zu ist.'), 'versteck bauen ausbauen gebäude');
  F('stark', _t('Wie werde ich stärker?'), 'fg:aufwerten', _t('Bessere Ausrüstung anlegen, sie an der Werkbank aufwerten und verschmelzen, Talentpunkte verteilen, Edelsteine einsetzen und das Versteck ausbauen (Trainingsplatz).'), 'stärker schaden leben besser');
  F('tod', _t('Was passiert, wenn ich in den Endlosen Landen sterbe?'), 'lande:regeln', _t('Stirbst du, sind Ausrüstung, Rucksack und Sammelbeutel verloren.') + ' ' + _t('Nur die Begleiter-Tasche kommt heim – dein Begleiter teleportiert mit dir zurück.'), 'sterben lande tod verloren');
  F('begleiter', _t('Wie bekomme ich einen Begleiter?'), 'pet:eier', _t('Begleiter schlüpfen aus Eiern. Dein erstes Ei gibt der erste Boss der Geschichte, weitere findest du in den Endlosen Landen, in Truhen, bei Bossen und im Basar. Im Brutnest wärmst, fütterst und streichelst du es, bis es schlüpft.'), 'begleiter haustier pet ei');
  F('muenzen', _t('Wie bekomme ich Glücksmünzen?'), 'han:muenzen', _t('Glücksmünzen gibt es von Bossen, Champions, seltenen Truhen, der Tages-Challenge und Schreinen Fortunas. Jede Drehung ist reiner Zufall mit den gezeigten Chancen – Mythisch kann beim ersten Dreh kommen oder erst nach sehr vielen.'), 'glücksmünze münzen coins');
  F('barriere', _t('Wie komme ich über Schluchten und Flüsse?'), 'lande:werkzeuge', _t('Mit dem passenden Werkzeug – Seil, Brückenstein, Eishaken und mehr. Es liegt in einem bewachten Hort diesseits der Grenze. Der lila Pfeil zeigt zum nächsten Übergang.'), 'barriere schlucht fluss werkzeug grenze');
  F('mythisch', _t('Wie bekomme ich mythische Gegenstände?'), 'it:mythisch', _t('Sehr selten: aus der Glücksrolle, aus Schicksals- und Drachentruhen, von Bossen in der Qual, in den Endlosen Landen – oder durch Verschmelzen zweier legendärer Gegenstände mit etwas Glück.'), 'mythisch mythic');
  F('platz', _t('Mein Beutel ist voll – was tun?'), 'bld:sattler', _t('Verkaufe beim Händler, leg Dinge in die Schatzkammer oder bau die Sattlerei aus: Sie macht Beutel und Rucksack größer. Materialien und Edelsteine brauchen keinen Platz.'), 'beutel voll platz tasche lager');
  F('stash', _t('Wie teile ich Gegenstände zwischen meinen Helden?'), 'bld:lager', _t('Die Schatzkammer im Versteck ist ein Lager für alle deine Helden. Was du dort ablegst, kann jeder andere Held herausnehmen.'), 'lager teilen helden schatzkammer');
  F('boss', _t('Ein Boss ist zu stark – was nun?'), 'en:mechaniken', _t('Lies im Boss-Kodex seine Mechaniken und üb kostenlos. Farbige Flächen am Boden warnen dich vor Angriffen. Werte deine Ausrüstung auf und nimm Elixiere mit.'), 'boss stark schwer kodex');
}

/* ---------- Kapitel: Klassen & Fähigkeiten ---------- */
function hbClasses() {
  hbChap('cls', _t('Klassen und Fähigkeiten'), ['body', 'knight_m', 1], _t('Ritter, Magier, Assassine, Bogenschütze'));
  for (const k in CLASSES) {
    const C = CLASSES[k];
    E('cls:' + k, C.name, { ic: ['body', C.body, 1], kw: k + ' klasse ' + C.skills.concat([C.ult]).map(s => SKILLS[s].n).join(' '), see: ['cls:talente', 'cls:mtal', 'cls:meister', 'it:waffen'].concat(Object.keys(SETS).filter(s => SETS[s].cls === k).map(s => 'set:' + s)), go: ['tal'], s: esc(C.desc),
      b: () => {
        const sk = id => { const S = SKILLS[id], M_ = typeof MASTERY !== 'undefined' ? MASTERY[id] : null; return { ic: S.icon, t: esc(S.n) + (S.ult ? ' · ' + _t('Ultimative') : ''), d: esc(S.d) + ' · ' + (S.cost ? _t('{c} {res} · {cd} s Abklingzeit', { c: S.cost, res: esc(C.res.name), cd: S.cd.toLocaleString(LOCALE) }) : _t('bei voller Wut')) + (M_ ? '<br>' + _t('Meisterschaft: {list}', { list: esc(M_.up.map((u, i) => (MROMAN[i + 1] || '') + ' ' + u[1]).join(' · ')) }) : '') }; };
        return hKv([[_t('LEBEN'), _t('{hp} + {lv} je Level', { hp: C.hp, lv: C.hpLv })], [_t('VERTEIDIGUNG'), C.def], [_t('TEMPO'), C.spd], [_t('KRAFTQUELLE'), _t('{name} ({max})', { name: esc(C.res.name), max: C.res.max })], [_t('WAFFEN'), esc(C.weapons.map(w => WT[w].label).join(', '))]])
          + hH(_t('FÄHIGKEITEN')) + hRows(C.skills.concat([C.ult]).map(sk))
          + hH(_t('TALENTE')) + TALENTS[k].map(([bn, nodes]) => `<p><b>${esc(bn)}</b></p>` + hUl(nodes.map(n => (n.cap ? '★ ' : '') + _t('{name} (bis {max}): {d}', { name: esc(n.n), max: n.max, d: esc(n.d) }) + (n.lv ? ' · ' + _t('ab Level {n}', { n: n.lv }) : '')))).join('')
          + hH(_t('RÜSTUNG DIESER KLASSE')) + hP(esc(C.names.map((n, t) => n[0] + ' / ' + n[1]).join(' · ')));
      } });
  }
  E('cls:talente', _t('Talente'), { ic: ['pa', 'buch'], kw: 'talent talente punkte baum zweig zurücksetzen grundstufe', see: ['start:level', 'cls:mtal'], go: ['tal'],
    s: _t('Drei Zweige je Klasse – jedes Level ein Punkt, voll erst bei Level {n}.', { n: LVMAX }),
    b: () => hUl([_t('Jede Klasse hat drei Talent-Zweige. Die Grundstufe hat je vier Talente (30 Punkte), danach geht jeder Zweig in der Meister-Stufe weiter.'), _t('Ein Talent wird frei, wenn das darüber mindestens einen Punkt hat. Das letzte der Grundstufe ist besonders stark, hat aber nur einen Rang.'), _t('Im Charakter wechselst du zwischen GRUNDSTUFE und MEISTER.'), _t('Zurücksetzen geht jederzeit gegen Gold – dann kannst du neu verteilen.'), _t('Blutaltäre auf der Karte schenken einen Talentpunkt extra.')])
      + hKv([[_t('PUNKTE IM BAUM'), String(typeof talentTotal === 'function' ? talentTotal('knight') : 99)], [_t('VOLL BEI'), _t('Level {n}', { n: LVMAX })]]) });
  E('cls:mtal', _t('Meister-Talente'), { ic: ['fx', 'sparks', 3], kw: 'meister talente meisterstufe schlussstein level 30 90 95 100 talentbaum voll', see: ['cls:talente', 'start:level', 'start:lvbel'], go: ['tal'],
    s: _t('Ab Level 30 wächst jeder Talent-Zweig weiter – bis zum Schlussstein bei Level 90, 95 und 100.'),
    b: () => hUl([_t('Jeder Zweig bekommt sieben Meister-Talente: ab Level 30, 40, 50, 60 und 70 je eins mit vier Rängen, ab Level 80 eins mit zwei Rängen und ganz unten einen Schlussstein.'), _t('Gesperrte Meister-Talente zeigen, ab welchem Level sie frei werden.'), _t('Die Schlusssteine (★) verändern eine Fähigkeit deutlich – im ersten Zweig ab Level 90, im zweiten ab 95, im dritten ab 100.'), _t('So hat jede Klasse 99 Punkte – einen je Level. Voll ist der Baum erst bei Level {n}.', { n: LVMAX }), _t('Helden von vor dem Update bekommen alle Punkte, die sie schon verdient haben, zum Verteilen.')])
      + hH(_t('SCHLUSSSTEINE')) + hRows(Object.keys(CLASSES).flatMap(k => TALENTS[k].map(([bn, nodes]) => nodes.find(n => n.cap)).filter(Boolean).map(n => ({ ic: ['body', CLASSES[k].body, 1], t: _t('{name} · ab Level {lv}', { name: esc(n.n), lv: n.lv }), d: esc(CLASSES[k].name) + ' · ' + esc(n.d) })))) });
  if (typeof MASTERY !== 'undefined') E('cls:meister', _t('Meisterschaft der Fähigkeiten'), { ic: ['fx', 'ring', 8], kw: 'meisterschaft mastery rang fähigkeit stufe farbe', see: ['cls:talente'],
    s: _t('Fähigkeiten werden durch Benutzen stärker und ändern ihr Aussehen.'),
    b: () => hUl([_t('Jede Fähigkeit hat Stufe 1 bis {max}. Punkte gibt es nur im Kampf.', { max: MAST_MAX }), _t('Je Stufe: +2 % Schaden, −0,4 % Abklingzeit (höchstens −20 %), −0,5 % Kosten.'), _t('Ränge ab Stufe 10, 20, 30, 40 und 50: neue Farbe, eine Spur, ab Rang III größer, Rang VI golden – und jedes Mal eine kleine Verbesserung.')])
      + hRows(MRANK.map((n, i) => ({ ic: ['fx', 'ring', 8], t: _t('Rang {r}: {name}', { r: MROMAN[i], name: esc(n) }), d: i ? _t('ab Stufe {lv}', { lv: i * 10 }) : _t('Stufe 1–9') }))) });
}

/* ---------- Kapitel: Gegenstände ---------- */
// Musterbild eines Gegenstands (wie mwSampleURL in js/forge.js), o: slot, base, form, tier, rar, set, myth, name
function hbItemIc(o) {
  return () => { const it = Object.assign({ slot: 'weapon', base: null, form: null, tier: 3, rar: 1, aff: {}, gems: [], up: 0, sockets: 0, set: null, name: null, suf: null, fz: 0 }, o); if (it.slot === 'weapon') { it.base = it.base || CLASSES[(P && P.cls) || 'knight'].start; it.form = it.form || (WFORM[it.base].find(f => f.std) || WFORM[it.base][0]).id; } else it.base = it.slot; return itemIconURL(it); };
}
const hbSlotN = s => s === 'weapon' ? _t('Waffe') : AR[s].label;
function hbItems() {
  hbChap('it', _t('Gegenstände'), ['w', 'knight_sword'], _t('Seltenheit, Waffen, Sets, Mythisch, Edelsteine, Elemente'));
  E('it:seltenheit', _t('Seltenheit'), { ic: hbItemIc({ rar: 4, tier: 4, name: 'x' }), kw: 'seltenheit farbe gewöhnlich magisch selten episch legendär set mythisch rarity', see: ['it:affixe', 'it:sets', 'it:mythisch', 'fg:sockel'],
    s: _t('Die Farbe des Namens zeigt, wie selten und stark ein Gegenstand ist.'),
    b: () => hRows(RAR.map((R, r) => ({ ic: hbItemIc({ rar: r, tier: 3, name: r >= 4 ? 'x' : null, set: r === 5 ? 'drache' : null, myth: r === 6 ? 'klinge' : null }), t: `<span style="color:${R.c};text-shadow:1px 1px 0 #000">${esc(R.n)}</span>`, d: _t('Grundwerte ×{m} · {a} Zusatzwerte · {s} Sockel', { m: R.m.toLocaleString(LOCALE), a: R.aff, s: hbRange(R.sock[0], R.sock[1]) }) })))
      + hP(_t('In der Kampagne sind etwa 36 % der Beute magisch, 14 % selten, 4 % episch und nicht mal 1 % legendär. In den Endlosen Landen steigen die Chancen mit der Tiefe – dort gibt es sogar Mythisches.'))
      + hP(_t('Höhere Schwierigkeit und Beute-Boni (Elixier des Glücks, Schreine, Blutmond) machen Seltenes häufiger.')) });
  E('it:stufen', _t('Material-Stufen'), { ic: hbItemIc({ tier: 5 }), kw: 'stufe material eisen stahl mithril adamant drachen obsidian sternen ätherium tier level', see: ['fg:schmieden', 'it:waffen', 'it:ruestung'],
    s: _t('Acht Stufen von Eisen bis Ätherium – je höher, desto stärker.'),
    b: () => hRows(MAT.map((M, t) => ({ ic: hbItemIc({ tier: t }), t: esc(M.n), d: _t('ab Level {lv} · Waffenschaden ×{m} · Händlerpreis {p} Gold', { lv: REQ[t], m: TMUL[t].toLocaleString(LOCALE), p: hbNum(PRICE[t]) }) })))
      + hP(_t('Beute kommt meist in der Stufe deines Gebiets. Schmieden garantiert eine Stufe – wenn dein Level reicht.')) });
  E('it:waffen', _t('Waffen und Waffenformen'), { ic: ['w', 'knight_sword'], kw: 'waffe schwert axt dolch bogen stab form kurzschwert zweihänder armbrust', see: ['it:stufen', 'cls:knight', 'cls:mage', 'cls:rogue', 'cls:ranger'],
    s: _t('Jede Klasse kämpft mit eigenen Waffen. Die Form ändert Aussehen und Werte ein wenig.'),
    b: () => Object.keys(WT).map(b => { const W = WT[b], cls = Object.keys(CLASSES).filter(c => CLASSES[c].weapons.includes(b)).map(c => CLASSES[c].name); return hH(esc(W.label).toLocaleUpperCase(LOCALE)) + hP(_t('Grundschaden {d} · {a} Angriffe/s · Krit {c} · {cls}', { d: W.dmg, a: (1 / W.cd).toLocaleString(LOCALE, { maximumFractionDigits: 1 }), c: pct(W.crit), cls: esc(cls.join(', ')) }) + (W.ranged ? ' · ' + _t('Fernkampf') : ''))
      + hRows(WFORM[b].map(F => ({ ic: hbItemIc({ base: b, form: F.id, tier: 2 }), t: esc(F.n), d: esc(typeof mwFormFx === 'function' ? mwFormFx(F) : '') }))); }).join('') });
  E('it:ruestung', _t('Rüstung und Helme'), { ic: hbItemIc({ slot: 'armor', tier: 3 }), kw: 'rüstung helm verteidigung ver leben lp armor', see: ['it:stufen', 'it:affixe'],
    s: _t('Rüstung und Helm geben Verteidigung und Lebenspunkte.'),
    b: () => hRows(MAT.map((M, t) => ({ ic: hbItemIc({ slot: 'armor', tier: t }), t: esc(M.n), d: _t('Rüstung: VER {a}, LP +{ah} · Helm: VER {h}, LP +{hh}', { a: AR.armor.def[t], ah: AR.armor.hp[t], h: AR.helm.def[t], hh: AR.helm.hp[t] }) })))
      + hP(_t('Die Namen hängen von deiner Klasse ab – ein Ritter trägt Panzer, ein Magier Roben. Die Werte sind gleich.')) });
  E('it:affixe', _t('Zusatzwerte'), { ic: ['pa', 'wbup'], kw: 'affix zusatzwert krit tempo lebensraub brand frost wucht leben panzer heilung schutz eile glück', see: ['fg:umschmieden', 'it:seltenheit'],
    s: _t('Magische und bessere Gegenstände haben Zusatzwerte – je seltener, desto mehr und desto stärker.'),
    b: () => { const row = (pool, k) => { const A = pool[k]; return { ic: ['pa', 'wbup'], t: esc(A.s(A.f(1))) + ' … ' + esc(A.s(A.f(6))), d: _t('Namenszusatz „{suf}“ · Magisch bis Mythisch', { suf: esc(_t(A.suf)) }) }; };
      return hH(_t('WAFFEN')) + hRows(Object.keys(AFFW).map(k => row(AFFW, k))) + hH(_t('RÜSTUNG UND HELM')) + hRows(Object.keys(AFFA).map(k => row(AFFA, k)))
        + hUl([_t('Krit: Chance auf kritische Treffer (×1,8 Schaden und mehr).'), _t('Lebensraub: ein Teil des Schadens heilt dich.'), _t('Brand und Frost: Chance, Gegner anzuzünden oder zu verlangsamen.'), _t('Schadensminderung: weniger Schaden von jedem Treffer.'), _t('Regeneration: Lebenspunkte pro Sekunde.')]) + hP(_t('Jeder Zusatzwert hat eine Stufe. Veredeln hebt sie, Umschmieden tauscht den Wert aus.')); } });
  E('it:legendaer', _t('Legendäre Gegenstände'), { ic: hbItemIc({ rar: 4, tier: 4, name: 'x' }), kw: 'legendär legendary orange name leuchten', see: ['it:seltenheit', 'it:mythisch'],
    s: _t('Orange, mit eigenem Namen, drei Zusatzwerten und vielen Sockeln. Sie leuchten an deinem Helden.'),
    b: () => Object.keys(LEGEND).map(b => hP(`<b>${esc(b === 'armor' || b === 'helm' ? AR[b].label : WT[b].label)}</b>: ${esc(LEGEND[b].map(n => _t(n)).join(', '))}`)).join('') });
  // Sets
  E('it:sets', _t('Sets'), { ic: hbItemIc({ rar: 5, set: 'drache', tier: 4 }), kw: 'set grün komplett bonus aura', see: Object.keys(SETS).map(k => 'set:' + k),
    s: _t('Zusammengehörige Teile: zwei bringen einen Bonus, alle drei einen großen und eine Aura.'),
    b: () => hRows(Object.keys(SETS).map(k => ({ id: 'set:' + k, ic: hbItemIc({ rar: 5, set: k, tier: 4, base: SETS[k].base, name: SETS[k].pieces.weapon }), t: esc(SETS[k].n), d: SETS[k].cls ? esc(CLASSES[SETS[k].cls].name) : _t('alle Klassen') })))
      + hP(_t('Set-Teile findest du selten als Beute, beim Schmieden, in der Glücksrolle und in den Endlosen Landen.')) });
  for (const k in SETS) { const S = SETS[k];
    E('set:' + k, S.n, { ic: hbItemIc({ rar: 5, set: k, tier: 4, base: S.base, name: S.pieces.weapon }), kw: 'set ' + Object.values(S.pieces).join(' '), see: ['it:sets', S.cls ? 'cls:' + S.cls : 'it:seltenheit'],
      s: S.cls ? _t('Set für: {cls}', { cls: esc(CLASSES[S.cls].name) }) : _t('Set für alle Klassen'),
      b: () => hRows(['weapon', 'armor', 'helm'].map(sl => ({ ic: hbItemIc({ slot: sl, rar: 5, set: k, tier: 4, base: S.base, name: S.pieces[sl] }), t: esc(_t(S.pieces[sl])), d: esc(hbSlotN(sl)) })))
        + hKv([[_t('2 TEILE'), esc(S.d2)], [_t('3 TEILE'), esc(S.d3)], typeof AURA !== 'undefined' && AURA[k] ? [_t('AURA'), esc(AURA[k].n)] : null]) });
  }
  // Mythisch
  E('it:mythisch', _t('Mythische Gegenstände'), { ic: hbItemIc({ rar: 6, myth: 'klinge', name: MYTHIC.klinge.n, tier: 5 }), kw: 'mythisch mythic pink kraft', see: Object.keys(MYTHIC).map(k => 'myth:' + k).concat(['han:tempel']),
    s: _t('Die seltensten Gegenstände: jeder mit einer einzigartigen Kraft.'),
    b: () => hRows(Object.keys(MYTHIC).map(k => ({ id: 'myth:' + k, ic: hbItemIc({ slot: MYTHIC[k].slot, rar: 6, myth: k, name: MYTHIC[k].n, tier: 5 }), t: esc(_t(MYTHIC[k].n)), d: esc(MYTHIC[k].d) })))
      + hH(_t('WO FINDEN')) + hUl([_t('Glücksrolle im Glückstempel ({p})', { p: pc1(WHEEL.find(w => w.k === 'myth').w / WHEEL.reduce((a, w) => a + w.w, 0)) }), _t('Schicksalstruhe 1 %, Drachentruhe 6 %'), _t('Bosse in der Qual – selten'), _t('Endlose Lande: je tiefer, desto eher'), _t('Verschmelzen: Zwei legendäre Gegenstände derselben Art können mit Glück mythisch werden.')]) });
  for (const k in MYTHIC) { const M = MYTHIC[k];
    E('myth:' + k, _t(M.n), { ic: hbItemIc({ slot: M.slot, rar: 6, myth: k, name: M.n, tier: 5 }), kw: 'mythisch ' + M.p, see: ['it:mythisch'], s: esc(M.d),
      b: () => hKv([[_t('PLATZ'), esc(hbSlotN(M.slot))], [_t('SELTENHEIT'), esc(RAR[6].n)], typeof AURA !== 'undefined' && AURA[k] ? [_t('AURA'), esc(AURA[k].n)] : null]) + hP(_t('Mythische Gegenstände haben vier Zusatzwerte, zwei bis drei Sockel und eine eigene Kraft, die sonst nichts im Spiel hat. Sie lassen sich nicht weiter verschmelzen.')) });
  }
  // Edelsteine
  E('it:edelsteine', _t('Edelsteine und Sockel'), { ic: ['gem', 'rubin', 3], kw: 'edelstein sockel gem juwel splitter königlich verschmelzen', see: GEMORDER.map(g => 'gem:' + g).concat(['fg:sockel', 'bld:juwelier']),
    s: _t('Edelsteine in Sockel setzen: feste Boni. Drei gleiche ergeben einen besseren.'),
    b: () => hRows(GEMORDER.map(g => ({ id: 'gem:' + g, ic: ['gem', g, 3], t: esc(GEMS[g].n), d: esc(GEMS[g].s(GEMS[g].v[0])) + ' … ' + esc(GEMS[g].s(GEMS[g].v[4])) })))
      + hH(_t('GÜTE')) + hP(esc(GEMGRADE.join(' → '))) + hP(_t('Drei gleiche Edelsteine verschmelzen zu einem besseren.') + ' ' + _t('Kosten: {list} Gold (mit Juwelier-Stufe 2 die Hälfte).', { list: [0, 1, 2, 3].map(g => hbLv('juwelier', 0, () => gemCombineCost(g))).join(' / ') }))
      + hH(_t('WO FINDEN')) + hUl([_t('Elite-Gegner, Bosse, Truhen und Erzadern'), _t('Händler (Splitter), Werkstatt-Rezept, Glücksrolle'), _t('Juwelier-Stufen 3 bis 10 bringen bis zu doppelt so viele Funde.')]) });
  for (const g of GEMORDER) { const G_ = GEMS[g];
    E('gem:' + g, G_.n, { ic: ['gem', g, 4], kw: 'edelstein ' + G_.eff, see: ['it:edelsteine', 'fg:sockel'], s: esc(G_.s(G_.v[0])) + ' … ' + esc(G_.s(G_.v[4])),
      b: () => hRows(GEMGRADE.map((n, gr) => ({ ic: ['gem', g, gr], t: _t('{grade} {gem}', { grade: esc(n), gem: esc(G_.n) }), d: esc(G_.s(G_.v[gr])), r: typeof MK_GEMV !== 'undefined' ? _t('{n} G', { n: hbNum(MK_GEMV[gr] * (MK_GEMF[g] || 1)) }) : null }))) + hNote(_t('Rechts: ungefährer Marktwert im Basar.')) });
  }
  // Elemente
  if (typeof ELEM !== 'undefined') {
    const elIc = el => () => partIconURL('kern', 6, el);
    E('it:elemente', _t('Elemente und Schwächen'), { ic: elIc('feuer'), kw: 'element schwäche resistent feuer frost blitz gift licht schatten', see: ELORDER.map(e => 'el:' + e),
      s: _t('Gegensätze treffen ×1,5 („SCHWÄCHE!“), das gleiche Element nur ×0,5 („RESISTENT“).'),
      b: () => hRows(ELORDER.map(el => ({ id: 'el:' + el, ic: elIc(el), t: `${ELEM[el].g} ${esc(ELEM[el].n)}`, d: _t('Gegensatz: {opp} · Treffer: {fx}', { opp: esc(ELEM[ELEM[el].opp].n), fx: esc(ELFX_D[el]) }) })))
        + hUl([_t('Eine Waffe mit Element macht Schaden dieses Elements und löst manchmal seinen Effekt aus.'), _t('Rüstung und Helm mit Element schützen vor Gegnern dieses Elements.'), _t('Woher das Element kommt: seltene Beute, Elementkern oder Rune eines Meisterwerks, Essenz-Mods.'), _t('Jeder Gegner zeigt sein Element mit einem Zeichen. Bosse haben immer eins.')]) });
    for (const el of ELORDER) { const X = ELEM[el];
      E('el:' + el, X.n, { ic: elIc(el), kw: 'element ' + X.g, see: ['it:elemente', 'el:' + X.opp, 'modf:essenz'], s: _t('Gegensatz: {opp}', { opp: esc(ELEM[X.opp].n) }),
        b: () => { const en = hbEns().filter(k => EN_EL[k] === el); return hKv([[_t('ZEICHEN'), X.g], [_t('WAFFE TRIFFT'), esc(ELFX_D[el])], [_t('STARK GEGEN'), esc(ELEM[X.opp].n)], RUNE_BONUS[el] ? [_t('RUNE IM MEISTERWERK'), esc(RUNE_BONUS[el].s(RUNE_BONUS[el].v)) + ' ' + _t('je Stufe')] : null])
          + hP(_t('Waffe: {a} Chance je Treffer auf den Effekt (stärker mit höherer Stufe). Rüstung: {b} weniger Schaden von {el}-Gegnern.', { a: pct(elProc(1)) + '–' + pct(elProc(10)), b: pct(elRes(1)) + '–' + pct(elRes(10)), el: esc(X.n) }))
          + (en.length ? hH(_t('GEGNER MIT DIESEM ELEMENT')) + hRows(en.map(k => ({ id: 'en:' + k, ic: hbEnIc(k), t: esc(hbEnName(k)) }))) : ''); } });
    }
  }
  E('it:aussehen', _t('Farbstoffe, Kosmetik und Aussehen'), { ic: ['pa', 'spiegel'], kw: 'farbe farbstoff kosmetik flügel aura umhang aussehen spiegel sammlung skin', see: ['bld:spiegel', 'han:tempel', 'han:tauschen'],
    s: _t('Farbstoffe färben deine Rüstung. Flügel, Auren und besondere Umhänge gibt es im Glückstempel.'),
    b: () => hH(_t('FARBSTOFFE')) + hRows(DYES.filter(D => D.c).map(D => ({ ic: '#' + D.c[0].slice(1), t: esc(D.n), d: hCost(D.cost) })))
      + hH(_t('KOSMETIK')) + hP(_t('Flügel, Auren und besondere Umhänge gibt es im Glückstempel deines Verstecks.')) + hP(esc(Object.keys(COSM).filter(k => !COSM[k].lvl).map(k => COSM[k].n).join(', ')))
      + hP(_t('Nur über Level-Belohnungen: {list}.', { list: esc(Object.keys(COSM).filter(k => COSM[k].lvl).map(k => _t('{name} (Level {lv})', { name: COSM[k].n, lv: COSM[k].lvl })).join(', ')) }))
      + hP(_t('Der Spiegel zeigt, wer du sein willst. Änderungen sind kostenlos.')) });
}

/* ---------- Kapitel: Schmiede & Mods ---------- */
function hbForge() {
  hbChap('fg', _t('Schmiede und Mods'), ['pa', 'amboss'], _t('Aufwerten, Verschmelzen, Meisterwerke, Mods'));
  const help = k => typeof WB_HELP !== 'undefined' && WB_HELP[k] ? hP(esc(WB_HELP[k]())) : '';
  E('fg:werkbank', _t('Werkbank, Schmiede und Juwelier'), { ic: ['s', 288, 408, 16, 24], kw: 'werkbank schmiede juwelier verbessern', see: ['fg:aufwerten', 'fg:verschmelzen', 'fg:meisterwerk', 'bld:schmiede', 'bld:juwelier'], go: ['st:schmiede', 'st:juwelier'],
    s: _t('Hier machst du deine Ausrüstung besser.'),
    b: () => hUl([_t('Werkbank: ein Ort auf der Weltkarte – heilt dich auch um 50 %.'), _t('Schmiede im Versteck: alles von der Werkbank, mit Boni je Ausbaustufe.'), _t('Juwelier im Versteck: Edelsteine einsetzen und verschmelzen, Materialien veredeln.')])
      + hH(_t('DIE BEREICHE')) + hUl([`<b>${_t('VERBESSERN')}</b> – ${_t('Aufwerten, Verschmelzen, Sockel, Mods, Umschmieden, Veredeln, Extrahieren')}`, `<b>${_t('SCHMIEDEN')}</b> – ${_t('Meisterwerk aus Bauteilen oder schnell ein Zufallsstück')}`, `<b>${_t('ZERLEGEN')}</b> – ${_t('Gegenstände zu Bauteilen und Material machen')}`, `<b>${_t('WERKSTATT')}</b> – ${_t('Bauteile, Edelsteine, Rezepte, Farben, Veredeln')}`]) + help('ver') });
  E('fg:aufwerten', _t('Aufwerten'), { ic: ['pa', 'wbup'], kw: 'aufwerten upgrade plus +10 chance', see: ['bld:schmiede', 'han:woche', 'mat:erz', 'mat:leder'], go: ['st:schmiede'],
    s: _t('Macht den Gegenstand stärker, bis +10.'),
    b: () => help('up') + hRows(hbNoWeek(() => [1, 3, 5, 6, 7, 8, 9, 10].map(u => { const w = upCost({ slot: 'weapon', tier: 0 }, u), a = upCost({ slot: 'armor', tier: 0 }, u); return { ic: ['pa', 'wbup'], t: _t('Auf +{n}', { n: u }), d: _t('Chance {p}', { p: pct(UPCHANCE[u - 1]) }) + ' · ' + _t('Waffe:') + ' ' + hCost(w.mats) + _t('Rüstung/Helm:') + ' ' + hCost(a.mats) }; })))
      + hP(_t('Jede Stufe gibt Waffen +8 % Schaden, Rüstung +10 % Verteidigung und Leben. Die Schmiede im Versteck erhöht die Chance, in der Schmiedewoche ist alles günstiger.')) });
  E('fg:verschmelzen', _t('Verschmelzen'), { ic: ['pa', 'amboss'], kw: 'verschmelzen fuse stern opfer', see: ['bld:schmiede', 'it:mythisch', 'mat:kristall'], go: ['st:schmiede'],
    s: _t('Opfere einen zweiten Gegenstand derselben Art für bessere Werte.'),
    b: () => help('fuse') + hUl([_t('Bis zu 3 Mal je Gegenstand, mit der Drachenesse (Schmiede Stufe 4) bis zu 5 Mal.'), _t('Kosten: Seelenkristalle, ab Episch ein Dämonenhorn, ab Legendär Drachenschuppen – und Gold.'), _t('Ist das Opfer seltener, steigt die Seltenheit sicher.')]) });
  E('fg:sockel', _t('Sockel'), { ic: ['gem', 'saphir', 2], kw: 'sockel bohren edelstein einsetzen entfernen', see: ['it:edelsteine', 'fg:rezepte'], go: ['st:juwelier'],
    s: _t('Freie Sockel nehmen Edelsteine auf. Bohren geht bis zu 3 Sockeln.'),
    b: () => help('sock') + hP(_t('Sockel bohren: {cost} – klappt mit 75 % Chance.', { cost: hCost(RECIPES.find(r => r.id === 'socket').cost, RECIPES.find(r => r.id === 'socket').gold) })) });
  E('fg:schmieden', _t('Schmieden'), { ic: ['pa', 'amboss'], kw: 'schmieden forge stufe material garantiert schnell', see: ['fg:meisterwerk', 'it:stufen', 'bld:schmiede'], go: ['st:schmiede'],
    s: _t('Gegenstand aus einer gewählten Material-Stufe – mindestens Magisch.'),
    b: () => help('quick') + hRows(FORGE.map((F, t) => ({ ic: hbItemIc({ tier: t }), t: _t('{mat} (ab Level {lv})', { mat: esc(MAT[t].n), lv: REQ[t] }), d: _t('Waffe:') + ' ' + hCost(F.w) + _t('Rüstung/Helm:') + ' ' + hCost(F.a) })))
      + hP(_t('Die Schmiede im Versteck macht Schmieden günstiger (bis 35 %). Ab Stufe 4 wird jedes fünfte Stück eine Seltenheit besser.')) });
  E('fg:meisterwerk', _t('Meisterwerke'), { ic: () => partIconURL('klinge', 6), kw: 'meisterwerk bauteil klinge griff kern platte polster rune', see: ['fg:bauteile', 'fg:zerlegen', 'it:elemente'], go: ['st:schmiede', 'parts'],
    s: _t('Dein Meisterwerk in 5 Schritten – du bestimmst alles.'),
    b: () => help('mw') + help('rar') + hRows(PARTORDER.map(t => ({ ic: () => partIconURL(t, 5, PART[t].el ? 'feuer' : null), t: esc(PART[t].n), d: esc(PART_ROLE[t]) + ' · ' + (PART[t].w ? _t('Waffe') : _t('Rüstung und Helm')) }))) });
  E('fg:bauteile', _t('Bauteile'), { ic: () => partIconURL('rune', 5, 'licht'), kw: 'bauteil stufe kombinieren roh grob solide fein edel meister göttlich', see: ['fg:meisterwerk', 'fg:zerlegen'], go: ['parts'],
    s: _t('Drei gleiche Bauteile ergeben eins der nächsten Stufe.'),
    b: () => hH(_t('STUFEN')) + hP(esc(GRADE.slice(1).map((g, i) => ROMAN[i + 1] + ' ' + g.n).join(' · ')))
      + help('parts') + hRows(hbNoWeek(() => [1, 3, 4, 5, 6, 7, 8, 9].map(g => { const c = combCost(g); return { ic: () => partIconURL('klinge', g + 1), t: _t('Stufe {a} → {b}', { a: g, b: g + 1 }), d: hCost(c.mats, c.gold) }; })))
      + hP(_t('Bauteile lassen Gegner fallen – Elite, Champions und Bosse öfter. Dazu kommen sie beim Zerlegen, aus Truhen der Lande und aus dem Basar.')) });
  E('fg:zerlegen', _t('Zerlegen'), { ic: ['pa', 'wbzer'], kw: 'zerlegen salvage auseinander', see: ['fg:bauteile'], go: ['st:schmiede'],
    s: _t('Mach alte Gegenstände zu Bauteilen und Material für Meisterwerke.'), b: () => help('salv') });
  E('fg:umschmieden', _t('Umschmieden, Veredeln, Extrahieren'), { ic: ['pa', 'amboss'], kw: 'umschmieden reroll veredeln refine extrahieren essenz affix zusatzwert', see: ['it:affixe', 'modf:aff'], go: ['st:schmiede'],
    s: _t('Zusatzwerte einzeln austauschen, verbessern oder mitnehmen.'),
    b: () => hH(_t('UMSCHMIEDEN')) + help('reroll') + hH(_t('VEREDELN')) + help('refine') + hH(_t('EXTRAHIEREN')) + help('extract') });
  E('fg:rezepte', _t('Rezepte'), { ic: ['pa', 'kessel'], kw: 'rezept heiltrank splitter brauen', see: ['start:traenke', 'it:edelsteine'],
    s: _t('Tränke und Edelstein-Splitter herstellen.'),
    b: () => hRows(RECIPES.map(R => ({ ic: ['pa', 'kessel'], t: esc(R.n), d: esc(R.d) + hCost(R.cost, R.gold) }))) });
  E('fg:veredeln', _t('Materialien veredeln'), { ic: ['mat', 'mithril'], kw: 'veredeln transmutieren material tauschen juwelier', see: ['bld:juwelier'], go: ['st:juwelier'],
    s: _t('Mach aus Material, das du übrig hast, seltenes.'),
    b: () => hRows(TRANSMUTE.map(([f, t, n, g]) => ({ id: 'mat:' + t, ic: ['mat', t], t: _t('{n} {from} → 1 {to}', { n, from: esc(MATS[f].n), to: esc(MATS[t].n) }), d: _t('dazu {g} Gold', { g }) }))) });
  if (typeof SMITH_TITLES !== 'undefined') E('fg:schmiedemeister', _t('Schmiedemeister'), { ic: ['pa', 'amboss'], kw: 'schmiedemeister titel lehrling geselle', see: ['fg:bauteile'],
    s: _t('Alles, was du an Amboss und Werkbank tust, macht dich zum besseren Schmied.'),
    b: () => help('smith') + hRows(SMITH_TITLES.map(([lv, n]) => ({ ic: ['pa', 'amboss'], t: esc(n), d: _t('ab Stufe {lv}', { lv }) }))) });
  // Mods
  if (typeof MOD_FAM === 'undefined') return;
  E('fg:mods', _t('Mods'), { ic: () => modIconURL('glyphe_kette:6'), kw: 'mod mods platz runen glyphen essenzen kerne prägungen', see: Object.keys(MOD_FAM).map(f => 'modf:' + f).concat(['fg:resonanz']), go: ['mods'],
    s: _t('Mods geben neue Kräfte – manche wecken zusammen eine Resonanz.'),
    b: () => help('mods') + hRows(Object.keys(MOD_FAM).map(f => ({ id: 'modf:' + f, ic: () => modIconURL(MOD_FAM[f].ic), t: esc(MOD_FAM[f].n), d: esc(MOD_FAM[f].d) })))
      + hH(_t('MOD-PLÄTZE')) + hP(esc(RAR.map((R, r) => R.n + ' ' + modSlots({ rar: r })).join(' · ')) + ' · ' + _t('Meisterwerk +1'))
      + hH(_t('WO FINDEN')) + hUl([_t('Endlose Lande: Gegner, Truhen und Horte – je tiefer, desto höhere Stufen (bis X).'), _t('Kampagne: selten, niedrige Stufen.'), _t('Basar und Tauschen.'), _t('Drei gleiche Mods kombinierst du im Charakter (MODS) zu einem der nächsten Stufe.')]) });
  for (const f in MOD_FAM) {
    const D = MOD_FAM[f], kinds = MOD_KINDS.filter(k => MODK[k].f === f);
    E('modf:' + f, D.n, { ic: () => modIconURL(D.ic), kw: 'mod ' + kinds.map(k => MODK[k].n).join(' '), see: ['fg:mods', 'fg:resonanz'], s: esc(D.d), go: ['mods'],
      b: () => f === 'aff' ? help('extract') + hP(_t('Affix-Essenzen haben die Stufe des Zusatzwerts (1–8) und passen entweder in Waffen oder in Rüstung und Helm.'))
        : hRows(kinds.map(k => ({ ic: () => modIconURL(k + ':6'), t: esc(MODK[k].n), d: _t('Stufe I: {a}', { a: esc(modDesc(k + ':1')) }) + '<br>' + _t('Stufe X: {b}', { b: esc(modDesc(k + ':10')) }) }))) });
  }
  E('fg:resonanz', _t('Resonanzen'), { ic: ['pa', 'mdbook'], kw: 'resonanz resonanzen buch geheim kombination', see: ['fg:mods'], go: ['reso'],
    s: _t('Bestimmte Mods zusammen wecken eine neue Kraft – auf einem Gegenstand oder über die ganze Ausrüstung. Unentdeckte zeigen einen Hinweis.'),
    b: () => { const B = (SAVE.meta.mods && SAVE.meta.mods.book) || {}, n = RESO.filter(R => B[R.id]).length;
      return hKv([[_t('ENTDECKT'), _t('{n} von {m}', { n, m: RESO.length })]]) + hRows(RESO.slice().sort((a, b) => (B[b.id] ? 1 : 0) - (B[a.id] ? 1 : 0)).map(R => {
        const where = R.on === 'set' ? _t('über die ganze Ausrüstung') : R.slot === 'w' ? _t('auf einer Waffe') : R.slot === 'a' ? _t('auf Rüstung oder Helm') : R.fn ? _t('auf einem Meisterwerk') : _t('auf einem Gegenstand');
        if (!B[R.id]) return { ic: ['pa', 'mdbook'], t: '???', d: esc(R.h) + ' · ' + esc(where) };
        return { ic: () => modIconURL((R.need ? R.need[0] : MOD_FAM[R.fam[0]].ic.split(':')[0]) + ':8'), t: esc(R.n), d: esc(R.d(1)) + '<br>' + (R.need ? esc(R.need.map(k => MODK[k].n).join(' + ')) : esc(R.r())) + ' · ' + esc(where) };
      })) + hNote(_t('Leg einen Gegenstand mit passenden Mods an – dann entdeckst du die Resonanz und sie steht hier.')); } });
}

/* ---------- Kapitel: Materialien & Rohstoffe ---------- */
// zusätzliche Suchwörter je Material
const HB_MATKW = { erz: 'eisen metall', holz: 'baum bäume wood', stein: 'steine fels felsen', faser: 'fasern flachs pflanzen', samen: 'saat saatgut', feder: 'federn vogel nest', eisenholz: 'eisen holz', marmor: 'säule', obsidian: 'vulkan', sternholz: 'stern holz', knochen: 'knochen', zahn: 'zähne ork', kristall: 'seele', horn: 'hörner dämon', glut: 'feuer', schuppe: 'drache schuppen', stern: 'sterne', aether: 'äther' };
function hbMats() {
  hbChap('mat', _t('Materialien und Rohstoffe'), ['mat', 'eisenholz'], _t('Wo finden, wofür – jedes Material'));
  E('mat:alle', _t('Materialien im Überblick'), { ic: ['mat', 'kristall'], kw: 'material rohstoff vorrat übersicht', see: ['fg:veredeln', 'ver:holzplatz', 'lande:sammeln'], go: ['vorrat'],
    s: _t('Gegner-Materialien für die Ausrüstung, Rohstoffe zum Bauen.'),
    b: () => hH(_t('MATERIALIEN VON GEGNERN')) + hRows(MONMATS.map(k => ({ id: 'mat:' + k, ic: ['mat', k], t: esc(MATS[k].n), d: esc(matWhere(k)) })))
      + hH(_t('ROHSTOFFE ZUM BAUEN')) + hRows(MATORDER.filter(k => MATS[k].res).map(k => ({ id: 'mat:' + k, ic: ['mat', k], t: esc(MATS[k].n), d: esc(MATS[k].w || '') })))
      + hP(_t('Alles liegt im Vorrat deines Helden (Charakter → VORRAT) und braucht keinen Platz im Beutel.')) });
  for (const k of MATORDER) {
    const M = MATS[k];
    E('mat:' + k, M.n, { ic: ['mat', k], kw: k + ' ' + (M.res ? 'rohstoff bauen' : 'material beute') + ' ' + (HB_MATKW[k] || ''), see: ['mat:alle'].concat(k === 'eisenholz' ? ['ver:acker', 'bio:tannen', 'bio:uralt', 'han:basar'] : M.res ? ['ver:holzplatz', 'lande:sammeln'] : ['fg:veredeln']), go: ['vorrat'],
      s: esc(matWhere(k)), b: () => hbMatBody(k) });
  }
}

/* ---------- Kapitel: Versteck & Gebäude ---------- */
// Was ein Gebäude macht (kurz, für Kinder) – die Stufen stehen darunter aus den Daten
const HB_BLD = {
  feuer: () => _t('Das Herz des Verstecks. Einmal pro Akt heilst du dich hier vollständig. Am Feuer siehst du auch alle Gebäude mit Kosten und Bauzeit – und hörst Geschichten.'),
  portal: () => _t('Bringt dich zurück zur Weltkarte.'),
  spiegel: () => _t('Ändere Körper, Haare, Haut, Umhang und Kosmetik deines Helden – kostenlos, so oft du willst.'),
  schmiede: () => _t('Borin wertet hier deine Ausrüstung auf, verschmilzt und schmiedet – wie die Werkbank auf der Karte, nur mit Boni. Jede Stufe macht Aufwerten sicherer und Schmieden günstiger.'),
  alchemie: () => _t('Mira braut Heiltränke und ab Stufe 3 Elixiere. Höhere Stufen: mehr Tränke im Vorrat, und sie heilen mehr.'),
  juwelier: () => _t('Selis setzt Edelsteine ein, verschmilzt sie und veredelt Materialien. Höhere Stufen bringen mehr Edelstein-Funde.'),
  lager: () => _t('Ein Lager für alle deine Helden. Händler, Basar und Werkbank können direkt mit Gegenständen aus dem Lager arbeiten. Ist der Beutel voll, landet neue Beute hier.'),
  sattler: () => _t('Fenrik näht größere Taschen – sie gelten für alle deine Helden.'),
  voliere: () => _t('Corvin zieht magische Vögel auf. Sie fliegen Beute aus den Endlosen Landen sicher nach Hause – nicht mitten im Kampf.'),
  training: () => _t('Dauerhaft +3 % Schaden und Lebenspunkte je Stufe für alle Helden. An der Trainingspuppe siehst du deinen Schaden pro Sekunde.'),
  tempel: () => _t('Glücksrolle, Schicksalstruhen und Münztausch. Ab Stufe 3 gibt es in jedem Akt einen Gratis-Dreh.'),
  bibliothek: () => _t('Chronik, Geschichte, Bestiarium und dieses Handbuch. Jede Stufe gibt allen Helden mehr Erfahrung.'),
  mine: () => _t('Die Kumpel fördern für jeden geschafften Raum (bis zu 25).') + ' ' + _t('Abholen musst du selbst: Geh zur Mine und tippe auf „Einsammeln“.'),
  garten: () => _t('Der Garten wächst für jeden geschafften Raum (bis zu 25).') + ' ' + _t('Dazu gehört der Acker, auf dem du selbst säst und erntest.'),
  weltentor: () => _t('Hinter dem Tor liegen die Endlosen Lande: eine Welt ohne Ende, für alle dieselbe – die beste Beute, aber wer dort stirbt, verliert, was er trägt.'),
  basar: () => _t('Kaufen, verkaufen und versteigern – bei Auktionatorin Hedda.'),
  brutnest: () => _t('Hier pflegst du Eier, bis sie schlüpfen: Wärme, Futter und Zuwendung. Nestmutter Gunda hilft dir.')
};
const HB_BLDGO = { weltentor: 'lande', basar: 'basar', brutnest: 'nest', bibliothek: 'best' };
function hbBldBody(id) {
  const B = BUILD[id], lv = B.fixed ? 1 : hideLv(id), x = HB_BLD[id];
  let h = (B.npc ? hRows([{ ic: ['sp', B.body], t: esc(B.npc), d: _t('kümmert sich um dieses Gebäude.') }]) : '') + hP(x ? x() : esc(B.d0 || ''));
  if (B.fixed) return h + (B.d0 && x ? hNote(esc(B.d0)) : '');
  const all = {}; let gold = 0; for (const c of B.lv) for (const k in c) { if (k === 'gold') gold += c[k]; else all[k] = (all[k] || 0) + c[k]; }
  h += hKv([[_t('DEINE STUFE'), _t('{lv} von {max}', { lv, max: B.lv.length })], [_t('HÖCHSTE STUFE'), esc(buildDesc(id, B.lv.length - 1))]]);
  // Besonderheiten aus den Daten: Förderung, Beete, Vögel, Lagerplätze
  if (id === 'mine' || id === 'garten') h += hH(_t('JE 10 GESCHAFFTE RÄUME')) + B.lv.map((_, i) => { const y = hbLv(id, i + 1, () => prodYield(id, 10)), m = {}; for (const k in y) if (y[k] > 0) m[k] = y[k]; return `<div class="hblv"><b>${_t('STUFE {n}', { n: i + 1 })}</b><i></i><div>${hCost(m)}</div></div>`; }).join('');
  if (id === 'garten') h += hP(_t('Acker: {list} Beete je Stufe. Neues Saatgut: {crops}.', { list: B.lv.map((_, i) => hbLv('garten', i + 1, () => farmBeds())).join(' / '), crops: esc(CROPORDER.map(c => CROPS[c].n + ' (' + CROPS[c].lv + ')').join(', ')) }));
  if (id === 'voliere' && typeof BIRDS !== 'undefined') h += hRows(BIRDORDER.map(b => ({ id: 'ver:voegel', ic: ['pa', 'v_' + b], t: _t('Stufe {lv}: {bird}', { lv: BIRDS[b].lv, bird: esc(BIRDS[b].n) }), d: esc(BIRDS[b].d) })));
  h += hH(_t('STUFEN, KOSTEN UND BAUZEIT')) + B.lv.map((c, i) => { const m = Object.assign({}, c); delete m.gold; return `<div class="hblv"><b>${i < lv ? '✓ ' : ''}${_t('STUFE {n}', { n: i + 1 })}</b><i>${esc(buildTimeText(buildDur(i + 1)))}</i><div>${esc(buildDesc(id, i))}${hCost(m, c.gold || 0)}</div></div>`; }).join('');
  return h + hH(_t('ALLE STUFEN ZUSAMMEN')) + hCost(all, gold);
}
function hbHide() {
  hbChap('ver', _t('Versteck und Gebäude'), ['pa', 'feuer'], _t('Bauen, Bauzeit, Holzplatz, Acker, jedes Gebäude'));
  E('ver:versteck', _t('Das Versteck'), { ic: ['pa', 'feuer'], kw: 'versteck basis heim ruine stationen', see: ['ver:bauen', 'ver:holzplatz', 'bld:feuer', 'bld:lager'], go: ['hide'],
    s: _t('Deine Basis: eine Ruine, die du Gebäude für Gebäude aufbaust.'),
    b: () => hUl([_t('Ins Versteck kommst du über den Knopf „Versteck“ auf der Weltkarte und nach jedem Akt.'), _t('Geh zu einer Station und interagiere (Knopf oder E) – dort siehst du, was sie kann und was der Ausbau kostet.'), _t('Alle Gebäude gelten für alle deine Helden.'), _t('Die Versteck-Stufe ist die Summe aller Gebäude-Stufen. Ab Stufe 50 hilft ein zweiter Baumeister.')])
      + hH(_t('GEBÄUDE')) + hRows(BUILDORDER.map(k => ({ id: 'bld:' + k, ic: ['pa', BUILD[k].icon], t: esc(BUILD[k].n), d: BUILD[k].fixed ? _t('immer da') : _t('Stufe {lv} von {max}', { lv: hideLv(k), max: BUILD[k].lv.length }) }))) });
  E('ver:bauen', _t('Bauen, Bauzeit und Sofort fertig'), { ic: ['pa', 'bau'], kw: 'bauen ausbauen bauzeit baumeister sofort fertig beschleunigen warten', see: ['ver:versteck', 'mat:holz', 'mat:stein', 'han:muenzen'],
    s: _t('Jeder Ausbau braucht Material, Gold und Zeit – die Zeit läuft auch, wenn das Spiel zu ist.'),
    b: () => hUl([_t('Bezahlt wird beim Start. Die neue Stufe zählt erst, wenn die Baustelle fertig ist.'), _t('Ein Baumeister baut immer nur ein Gebäude – ab Versteck-Stufe 50 sind es zwei.'), _t('Sofort fertig: mit Gold (je angefangene Minute 10 + 4 × Stufe) oder mit Glücksmünzen (eine je angefangene Stunde). In den letzten 5 Sekunden kostenlos.')])
      + hH(_t('BAUZEIT JE STUFE')) + hRows(BTIME.slice(1).map((s, i) => ({ ic: ['pa', 'bau'], t: _t('Stufe {n}', { n: i + 1 }), d: esc(buildTimeText(s)) })).filter((_, i) => i < 15)) });
  if (typeof GHK !== 'undefined') E('ver:holzplatz', _t('Holzplatz im Versteck'), { ic: hbProp('eiche'), kw: 'holzplatz bäume felsen büsche fällen abbauen holz stein faser nachwachsen', see: ['mat:holz', 'mat:stein', 'mat:faser', 'lande:sammeln'],
    s: _t('Am linken Rand des Verstecks wachsen Bäume, Felsen und Büsche – hau drauf!'),
    b: () => hP(_t('Neu: Am Rand des Verstecks wachsen Bäume, Felsen und Büsche – hau drauf für Holz, Stein und Fasern. Jeder Ausbau braucht jetzt Bauzeit.'))
      + hRows(Object.keys(GHK).map(t => { const K = GHK[t]; return { ic: hbProp(HB_GHKI[t] || 'eiche'), t: (HB_GHK[t] || (() => t))(), d: _t('{hits} Treffer · wächst in {t} nach', { hits: K.hits, t: esc(buildTimeText(K.grow)) }) + hCost(Object.fromEntries(Object.keys(K.out).map(k => [k, hbRange(K.out[k][0], K.out[k][1])]))) + (K.extra.length ? hNote(esc(K.extra.map(([k, p, a, b]) => pct(p) + ': ' + hbRange(a, b) + ' ' + MATS[k].n).join(' · '))) : '') }; }))
      + hP(_t('Die Bäume wachsen in echter Zeit nach – für alle deine Helden.')) });
  E('ver:acker', _t('Acker im Kräutergarten'), { ic: ['pa', 'garten'], kw: 'acker feld beet säen ernten samen setzling flachs heilkraut schössling seelenmoos sternblume eisenholz', see: ['bld:garten', 'mat:samen', 'mat:eisenholz', 'mat:sternholz'], go: ['st:garten'],
    s: _t('Säe Samen und ernte in Echtzeit – das Feld wächst auch, während du unterwegs bist. Samen gibt es von Büschen, Kräutern und aus dem Garten.'),
    b: () => hRows(CROPORDER.map(c => { const C = CROPS[c], out = {}; for (const k in C.out) if (C.out[k][1] > 0) out[k] = hbRange(C.out[k][0], C.out[k][1]); return { ic: ['mat', Object.keys(C.out)[0]], t: esc(C.n), d: _t('ab Garten-Stufe {lv} · wächst {t}', { lv: C.lv, t: esc(buildTimeText(C.t)) }) + '<br>' + _t('Saat:') + ' ' + hCost(C.seed) + _t('Ernte:') + ' ' + hCost(out) + (C.pot ? hNote(_t('dazu 1 Heiltrank')) : '') }; }))
      + hUl([_t('Beete: {list} (Garten-Stufe 1 bis 10).', { list: BUILD.garten.lv.map((_, i) => hbLv('garten', i + 1, () => farmBeds())).join(' / ') }), _t('Ab Garten-Stufe 7 bringt jede Ernte 25 % mehr.'), _t('Ab Garten-Stufe 10 wächst alles doppelt so schnell.')]) });
  E('ver:produktion', _t('Erzmine und Kräutergarten'), { ic: ['pa', 'mine'], kw: 'mine garten produktion fördern einsammeln räume', see: ['bld:mine', 'bld:garten'],
    s: _t('Beide arbeiten, während du kämpfst: für jeden geschafften Raum ein bisschen.'),
    b: () => hUl([_t('Gezählt wird jeder geschaffte Raum – höchstens 25, dann ist das Lager voll.'), _t('Abholen musst du selbst: Geh zur Mine und tippe auf „Einsammeln“.'), _t('Auf der Weltkarte zeigt „Versteck (!)“, dass etwas bereitliegt.')]) });
  if (typeof BIRDS !== 'undefined') E('ver:voegel', _t('Magische Vögel'), { ic: ['pa', 'v_rabe'], kw: 'vogel vögel spatz taube rabe eule phönix heimschicken voliere vogelhaus', see: ['bld:voliere', 'lande:taschen', 'mat:feder'],
    s: _t('Vögel tragen Beute aus den Endlosen Landen sofort nach Hause.'),
    b: () => hRows(BIRDORDER.map(b => { const B = BIRDS[b]; return { ic: ['pa', 'v_' + b], t: esc(B.n), d: esc(B.d) + ' · ' + _t('ab Vogelhaus-Stufe {lv}', { lv: B.lv }) + hCost(B.mats, B.gold) }; }))
      + hUl([_t('Im Rucksack „Vogel schicken“ wählen, dann die Dinge – Gegenstände kommen ins Lager, Eier ins Brutnest, alles andere direkt zu dir.'), _t('Nicht mitten im Kampf.'), _t('Vögel gibt es auch selten in Truhen und bei Elite-Gegnern der Lande, und Händler Bodo verkauft einzelne.'), _t('Höhere Vogelhaus-Stufen machen die Aufzucht günstiger – manchmal schlüpfen zwei.')]) });
  for (const k of BUILDORDER) {
    const B = BUILD[k];
    E('bld:' + k, B.n, { ic: ['pa', B.icon], kw: 'gebäude station ' + (B.npc || '') + ' ' + k, see: ['ver:versteck', 'ver:bauen'].concat(k === 'garten' ? ['ver:acker'] : k === 'voliere' ? ['ver:voegel'] : k === 'mine' ? ['mat:stein', 'mat:marmor'] : []), go: ['st:' + k].concat(HB_BLDGO[k] ? [HB_BLDGO[k]] : []),
      s: esc(B.fixed ? B.d0 : B.d[0]), b: () => hbBldBody(k) });
  }
}

/* ---------- Kapitel: Endlose Lande ---------- */
const hbKmR = r => typeof LRING !== 'undefined' ? lKm(LRING[r] * LCK) : '';
function hbLande() {
  if (typeof LANDE_BIOMES === 'undefined') return;
  hbChap('lande', _t('Endlose Lande'), ['pa', 'tor'], _t('Regeln, Werkzeuge, Leuchtfeuer, Tag und Nacht'));
  const rules = () => hUl([_t('Stirbst du, sind Ausrüstung, Rucksack und Sammelbeutel verloren.'), _t('Nur die Begleiter-Tasche kommt heim – dein Begleiter teleportiert mit dir zurück.'), _t('Raus kommst du durch ein Tor der Alten, das Weltentor oder ein Leuchtfeuer: hineinstellen und warten.'), _t('Die Karte wird nur gesichert, wenn du ein Leuchtfeuer setzt oder entkommst – wer fällt, vergisst den Weg seit dem letzten Leuchtfeuer.'), _t('Abbrechen geht nur außerhalb des Kampfes – wer mitten im Kampf das Spiel schließt, fällt.')]);
  E('lande:regeln', _t('Die Regeln der Lande'), { ic: ['pa', 'tor'], kw: 'regeln risiko tod sterben verlieren extraktion ausflug weltentor level 5', see: ['lande:ausflug', 'lande:taschen', 'pet:verletzung', 'lande:leuchtfeuer'], go: ['lande'],
    s: _t('Die beste Beute – aber wer dort stirbt, verliert, was er trägt.'),
    b: () => hP(_t('Hinter dem Tor liegen die Endlosen Lande: eine Welt ohne Ende, für alle dieselbe – die beste Beute, aber wer dort stirbt, verliert, was er trägt.')) + rules() + hKv([[_t('AB LEVEL'), '5'], [_t('EINGANG'), _t('Weltentor im Versteck oder „Mehr“ auf der Karte')]]) });
  E('lande:ausflug', _t('Ein Ausflug: Start und Ausgänge'), { ic: ['pa', 'tor'], kw: 'ausflug start ausgang tor der alten mondtor schlüsseltor rückkehrrolle entkommen abbrechen', see: ['lande:regeln', 'lande:leuchtfeuer', 'lande:tagnacht'], go: ['lande'],
    s: _t('Hinein durchs Weltentor oder ein Leuchtfeuer – raus durch einen Ausgang.'),
    b: () => hH(_t('AUSGÄNGE')) + hRows([{ ic: ['pa', 'tor'], t: _t('Tor der Alten'), d: _t('Stehen überall in der Welt, etwa alle {km}. Hineinstellen und warten.', { km: lKm(LXG * LCK) }) }, { ic: ['pa', 'tor'], t: _t('Mondtor'), d: _t('Öffnet sich immer wieder für kurze Zeit – warte, bis es offen ist.') }, { ic: ['pa', 'l_schl'], t: _t('Schlüsseltor'), d: _t('Braucht einen Schlüssel. Schlüssel gibt es in Truhen, bei Händler Bodo und für Aufträge.') }, { ic: ['pa', 'tor'], t: _t('Weltentor'), d: _t('In der Mitte der Welt, wo jeder Ausflug beginnt.') }, { id: 'lande:leuchtfeuer', ic: ['pa', 'l_feuer'], t: _t('Leuchtfeuer'), d: _t('Deine eigenen Lagerfeuer – Ausgang und Startpunkt.') }, { ic: ['pa', 'l_rolle'], t: _t('Rückkehrrolle'), d: _t('Ein Ausgang überall – du musst aber doppelt so lange stehen. Bei Händler Bodo.') }])
      + hH(_t('NACH DER HEIMKEHR')) + hUl([_t('Gegenstände kommen in den Beutel, ist er voll ins Lager, sonst in die Fundkiste am Weltentor.'), _t('Eier kommen ins Brutnest, Gold, Material, Edelsteine, Bauteile und Mods direkt zu dir.'), _t('Erfüllte Aufträge zahlen hier – oder automatisch, wenn du lebend durch einen Ausgang gehst.')]) });
  E('lande:welt', _t('Die Welt: Größe, Tiefe, Stufe'), { ic: ['pa', 'l_karte'], kw: 'welt größe karte tiefe stufe weltrand region wahrzeichen entfernung km stunden', see: ['bio:alle', 'lande:werkzeuge', 'lande:horte'],
    s: _t('Eine feste Welt für alle Spieler – vom Weltentor bis zum Rand läufst du etwa 24 Stunden.'),
    b: () => hP(_t('Tipp: Je weiter du dich vom Weltentor entfernst, desto stärker die Gegner – und desto besser die Beute.'))
      + hRows([0, .005, .042, .1, .25, .5, 1].map(d => ({ ic: ['pa', 'l_karte'], t: _t('{km} vom Weltentor', { km: lKm(d * LWR * LCK) }), d: _t('Gegner-Stufe {st}', { st: worldStage(d) }) + (worldQual(worldStage(d)) >= 1 ? ' · ' + _t('wie Qual {q}', { q: Math.floor(worldQual(worldStage(d))) }) : '') })))
      + hUl([_t('Die Welt ist in Regionen mit eigenen Namen eingeteilt. Jede hat ein Biom und in der Mitte ein Wahrzeichen: {list}.', { list: esc(Object.values(LMARK).join(', ')) }), _t('Truhen, Lager und ihr Inhalt sind bei jedem Ausflug neu – Gelände, Grenzen und Horte bleiben gleich.'), _t('Auf der Karte siehst du, was du schon erkundet hast.')]) });
  E('lande:tagnacht', _t('Tag und Nacht'), { ic: ['pa', 'l_feuer'], kw: 'tag nacht abend morgen zeit dunkel jäger', see: ['lande:ausflug'],
    s: _t('Ein Tag dauert {n} Minuten. Nachts wird es gefährlich.', { n: Math.round(LDAY / 60) }),
    b: () => hRows(LDNG.map(D => ({ ic: '#' + D.c.slice(1), t: esc(D.n), d: D.s ? esc(D.s) : _t('Jeder Ausflug beginnt am Morgen.') })))
      + hUl([_t('Nachts streifen mehr und stärkere Gegner umher, die Gegner-Stufe steigt etwas – dafür gibt es bis zu 20 % mehr Glück bei der Beute.'), _t('Ein Auftrag von Elwa: Überstehe eine Nacht in den Landen.')]) });
  E('lande:werkzeuge', _t('Grenzen und Werkzeuge'), { ic: ['pa', 'lt_seil'], kw: 'grenze barriere werkzeug übergang schlucht fluss eis lava seil hort ring', see: LANDE_TOOLS.slice(0, 4).map(t => 'tool:' + t.key).concat(['lande:gefahren']),
    s: _t('20 Grenzen ringförmig um das Weltentor. Jede querst du nur an Übergängen – und nur mit dem passenden Werkzeug.'),
    b: () => hP(_t('Tipp: Der lila Pfeil zeigt zum nächsten Übergang. Das Werkzeug dafür liegt in einem Hort diesseits der Barriere – sieh auf die Karte.'))
      + hRows(LANDE_TOOLS.map((t, i) => ({ id: 'tool:' + t.key, ic: ['pa', 'lt_' + t.key], t: (typeof lToolBit === 'function' && lToolBit(i) ? '✓ ' : '') + esc(t.n), d: _t('Grenze {n}: {bar} – etwa {km} vom Weltentor', { n: i + 1, bar: esc(LBAR[t.bar].n), km: hbKmR(i) }) })))
      + hP(_t('Die ersten 11 Grenzen brauchen die Grundwerkzeuge. Danach kommt die zweite Stufe – Seil II, Eishaken II und mehr. Sie schützen auch vor den Gefahren der tiefen Biome.')) });
  LANDE_TOOLS.forEach((T_, i) => {
    E('tool:' + T_.key, T_.n, { ic: ['pa', 'lt_' + T_.key], kw: 'werkzeug ' + T_.key + (T_.key === 'eishaken' ? ' eisenhaken haken' : ''), see: ['lande:werkzeuge', 'lande:gefahren'].concat(T_.b != null ? ['tool:' + LANDE_TOOLS[T_.b].key] : []), s: esc(T_.d),
      b: () => { const z = typeof lToolBand === 'function' ? lToolBand(i) : null, hz = Object.keys(LHAZ).filter(h => LHAZ[h].tool === i);
        return hKv([[_t('GRENZE'), _t('Nr. {n}: {bar}', { n: i + 1, bar: esc(LBAR[T_.bar].n) })], [_t('ENTFERNUNG'), _t('etwa {km} vom Weltentor', { km: hbKmR(i) })], [_t('DEIN STAND'), typeof lToolBit === 'function' && lToolBit(i) ? _t('Hast du schon ✓') : _t('Fehlt noch')]])
          + hP(z ? _t('Zu finden in einem bewachten Hort etwa {a} bis {b} vom Weltentor – also diesseits der Grenze. Die Karte und der lila Pfeil helfen.', { a: lKm(z[0] * LCK), b: lKm(z[1] * LCK) }) : '')
          + (hz.length ? hH(_t('SCHÜTZT AUCH VOR')) + hRows(hz.map(h => ({ id: 'lande:gefahren', ic: '#' + LHAZ[h].c.slice(1), t: esc(LHAZ[h].n), d: esc(LHAZ[h].s) }))) : '')
          + hH(_t('BIOME HINTER DIESER GRENZE')) + hP(hbBioN(B => B.r && B.r[0] === i + 1) || '–'); } });
  });
  E('lande:gefahren', _t('Gefahren der Biome'), { ic: ['pa', 'l_heil'], kw: 'gefahr giftluft kälte hitze finsternis sturm leere sog schutz', see: ['lande:werkzeuge'],
    s: _t('Manche Biome schaden dir, solange du das richtige Werkzeug nicht hast.'),
    b: () => hRows(Object.keys(LHAZ).map(h => { const Z = LHAZ[h], T_ = LANDE_TOOLS[Z.tool]; return { id: T_ ? 'tool:' + T_.key : null, ic: '#' + Z.c.slice(1), t: esc(Z.n), d: esc(Z.s) + ' · ' + _t('In: {list}', { list: hbBioN(B => B.haz === h) || '–' }) }; })) });
  E('lande:leuchtfeuer', _t('Leuchtfeuer'), { ic: ['pa', 'l_feuer'], kw: 'leuchtfeuer checkpoint stein leuchtfeuerstein speichern startpunkt', see: ['lande:ausflug', 'lande:ruf'],
    s: _t('Ein Leuchtfeuer kostet einen Leuchtfeuerstein und brennt für immer.'),
    b: () => hUl([_t('Die Karte bis hierher wird gesichert – auch wenn du später fällst.'), _t('Beim nächsten Ausflug kannst du hier starten.'), _t('Es ist ein Ausgang: hineinstellen und warten – die Beute ist sicher.'), _t('Höchstens {n} Leuchtfeuer – bei einem neuen erlischt das am längsten unbenutzte.', { n: LCPMAX })])
      + hP(_t('Leuchtfeuersteine liegen selten in Truhen, bei Bossen und in Horten. Händler verkaufen sie ab dem Ruf „Bekannter“ – einen je Außenposten. Am Ende der Welt gibt es gleich drei.')) });
  E('lande:taschen', _t('Rucksack, Sammelbeutel, Begleiter-Tasche'), { ic: ['pa', 'l_pack'], kw: 'rucksack sammelbeutel tasche begleiter platz fundkiste beutel', see: ['bld:sattler', 'ver:voegel', 'pet:verletzung'],
    s: _t('Was du in den Endlosen Landen findest – bis du heimkehrst.'),
    b: () => hRows([{ id: 'bld:sattler', ic: ['pa', 'l_pack'], t: _t('Rucksack'), d: _t('{n} Plätze für Gegenstände und Eier (20 + 2 je Sattlerei-Stufe + Ruf).', { n: packCap() }) }, { ic: ['pa', 'l_beutel'], t: _t('Sammelbeutel'), d: _t('Gold, Material, Edelsteine, Bauteile und Mods – ohne Platzgrenze. Verloren, wenn du fällst.') }, { id: 'pet:verletzung', ic: ['pa', 'nest'], t: _t('Begleiter-Tasche'), d: _t('Was darin liegt, überlebt deinen Tod – dein Begleiter bringt es heim.') }, { id: 'ver:voegel', ic: ['pa', 'v_spatz'], t: _t('Magische Vögel'), d: _t('Bringen Beute schon unterwegs sicher heim.') }, { ic: ['pa', 'truhe'], t: _t('Fundkiste'), d: _t('Am Weltentor: was beim Heimkommen keinen Platz mehr hatte (bis {n}).', { n: LBOX }) }])
      + hP(_t('Tipp: Alles im Rucksack ist verloren, wenn du fällst. Wertvolles in die Begleiter-Tasche legen – Rucksack-Knopf oben rechts.')) });
  E('lande:figuren', _t('Figuren und Händler'), { ic: ['sp', 'elff'], kw: 'npc figuren elwa bodo mirja gunda hedda fenrik corvin borin mira selis kael fortuna ulmo kundschafterin händler kräuterfrau', see: ['lande:ruf', 'han:basar', 'pet:pflege'],
    s: _t('Wer dir in den Landen und im Versteck hilft.'),
    b: () => hH(_t('IN DEN LANDEN – AN AUSSENPOSTEN')) + hRows([{ ic: ['sp', LNPC.mis.sp], t: esc(LNPC.mis.n), d: _t('Gibt Aufträge: Gegner besiegen, Truhen öffnen, Lager säubern, Regionen erkunden. Belohnung: Beute und Ruf.') }, { ic: ['sp', LNPC.trade.sp], t: esc(LNPC.trade.n), d: _t('Tauscht Waren, verkauft Tränke, Schlüssel, Kartenstücke, Rückkehrrollen, Vögel und (ab Ruf „Bekannter“) Leuchtfeuersteine. Kauft deine Beute an.') }, { ic: ['sp', LNPC.heal.sp], t: esc(LNPC.heal.n), d: _t('Heilt dich gegen Gold und gibt dir einen Kräutersegen.') }])
      + hH(_t('IM VERSTECK')) + hRows(BUILDORDER.filter(k => BUILD[k].npc).map(k => ({ id: 'bld:' + k, ic: ['sp', BUILD[k].body], t: esc(BUILD[k].npc), d: esc(BUILD[k].n) }))) });
  E('lande:ruf', _t('Ruf bei den Kundschaftern'), { ic: ['pa', 'l_auftrag'], kw: 'ruf rang aufträge kundschafter belohnung bekannter verbündeter legende', see: ['lande:figuren'],
    s: _t('Erfüllte Aufträge bringen Ruf – und jeder Rang einen Vorteil.'),
    b: () => hRows(LREP.map((R, i) => ({ ic: ['pa', 'l_auftrag'], t: esc(R.n), d: _t('ab {n} Ruf', { n: R.at }) + ' · ' + esc(R.d) }))) + hKv([[_t('DEIN RUF'), hbNum(lMeta().rep || 0)]]) });
  E('lande:truhen', _t('Truhen und Fundstellen'), { ic: ['s', 320, 416, 16, 16], kw: 'truhe truhen schatz verflucht verschlossen gefallener abenteurer vergraben kräuterbeet', see: ['lande:ausflug', 'mat:alle'],
    s: _t('Je besser die Truhe, desto besser der Inhalt – manche sind verflucht oder verschlossen.'),
    b: () => hRows(Object.keys(LCH).filter(k => LCH[k].it).map(k => { const C = LCH[k]; return { ic: ['s', 320, 416, 16, 16], t: esc(C.n), d: _t('{a} Gegenstände, mindestens {r}', { a: hbRange(C.it[0], C.it[1]), r: esc(RAR[C.min].n) }) + (C.egg ? ' · ' + _t('Ei {p}', { p: pc1(C.egg) }) : '') + (C.mod ? ' · ' + _t('Mod {p}', { p: pc1(C.mod) }) : '') + (C.trap ? ' · ' + _t('Falle!') : '') + (C.lock ? ' · ' + _t('braucht einen Schlüssel') : '') }; }))
      + hP(_t('Kräuterbeete geben Samen und Fasern.')) });
  E('lande:rivalen', _t('Rivalen und berüchtigte Gegner'), { ic: ['body', 'elf_f', 3], kw: 'rivale rivalen plündern benannt berüchtigt kopfgeld', see: ['lande:ruf', 'en:elite'],
    s: _t('Andere Abenteurer plündern die Lande – und manche Monster haben einen Namen.'),
    b: () => hH(_t('RIVALEN')) + hP(_t('Sie suchen dieselben Schätze wie du und greifen dich an. Besiegst du sie, gehört ihre Beute dir.')) + hRows(LRIV.map(r => ({ ic: ['body', r[2], r[3]], t: esc(r[0]), d: _t('kämpft wie: {en}', { en: esc(EN[r[1]] ? EN[r[1]].name : r[1]) }) })))
      + hH(_t('BERÜCHTIGTE GEGNER')) + hP(_t('Elwa schickt dich manchmal gezielt auf sie los.')) + hP(esc(LNAMED.join(', '))) });
  E('lande:horte', _t('Horte, Bosshöhlen und das Ende der Welt'), { ic: ['pa', 'truhe'], kw: 'hort horte boss höhle wächter ende der welt weltenrand monument', see: ['en:tausend', 'lande:werkzeuge'], go: ['kodex'],
    s: _t('Bewachte Schätze, Bosse in Höhlen und Monumente am Rand der Welt.'),
    b: () => hUl([_t('Horte liegen in der Mitte mancher Regionen. Wächter beschützen sie – darin liegen Werkzeuge, Leuchtfeuersteine und gute Beute.'), _t('In Höhlen wohnen Bosse aus dem Boss-Kodex. Besiegte Bosse kehren nach 3 Tagen zurück.'), _t('Ganz außen stehen die Stätten „Ende der Welt“ mit einem Wächter. Wer als Erstes dort ankommt, wird reich belohnt – dazu 3 Leuchtfeuersteine.')]) });
  E('lande:sammeln', _t('Sammeln in den Landen'), { ic: hbProp('eiche'), kw: 'sammeln fällen abbauen baum fels busch pilz nest erzader', see: ['mat:holz', 'mat:eisenholz', 'mat:marmor', 'mat:obsidian', 'mat:sternholz'],
    s: _t('Tipp: Bäume, Felsen und Büsche kannst du mit Angriffen abbauen. Holz, Stein und Fasern brauchst du zum Bauen im Versteck.'),
    b: () => hRows(['holz', 'stein', 'faser', 'samen', 'feder', 'eisenholz', 'marmor', 'obsidian', 'sternholz'].map(k => ({ id: 'mat:' + k, ic: ['mat', k], t: esc(MATS[k].n), d: esc(MATS[k].w || '') })))
      + hUl([_t('Was du abbaust, ist nur in diesem Ausflug weg – beim nächsten ist alles nachgewachsen.'), _t('Gesammeltes kommt in den Sammelbeutel und gehört dir erst nach der Heimkehr.'), _t('Erzadern in den Landen geben das Erz ihres Bioms.')]) });
}

/* ---------- Kapitel: Biome ---------- */
function hbBiomes() {
  if (typeof LANDE_BIOMES === 'undefined') return;
  hbChap('bio', _t('Biome der Lande'), '#4c7a32', _t('Jedes Gebiet: Entfernung, Gegner, Gefahren, Rohstoffe'));
  const ks = Object.keys(LANDE_BIOMES).sort((a, b) => LANDE_BIOMES[a].r[0] - LANDE_BIOMES[b].r[0] || LANDE_BIOMES[a].r[1] - LANDE_BIOMES[b].r[1]);
  const where = B => { const a = B.r[0], b = Math.min(B.r[1], LRMAX - 1); return a ? _t('etwa {a} bis {b} vom Weltentor', { a: hbKmR(a - 1), b: hbKmR(b) }) : _t('ab dem Weltentor bis etwa {b}', { b: hbKmR(b) }); };
  E('bio:alle', _t('Alle Biome'), { ic: '#4c7a32', kw: 'biom biome gebiet gebiete landschaft', see: ['lande:welt', 'lande:gefahren'],
    s: _t('{n} Biome – je weiter draußen, desto fremder.', { n: ks.length }),
    b: () => hRows(ks.map(k => ({ id: 'bio:' + k, ic: LANDE_BIOMES[k].map || LANDE_BIOMES[k].g[2], t: esc(LANDE_BIOMES[k].n), d: esc(where(LANDE_BIOMES[k])) }))) });
  for (const k of ks) {
    const B = LANDE_BIOMES[k];
    E('bio:' + k, B.n, { ic: B.map || B.g[2], kw: 'biom ' + k + ' ' + (B.pl || []).join(' '), see: ['bio:alle'].concat(B.haz && LHAZ[B.haz] && LANDE_TOOLS[LHAZ[B.haz].tool] ? ['tool:' + LANDE_TOOLS[LHAZ[B.haz].tool].key] : []), s: esc(where(B)),
      b: () => {
        const res = [], vein = typeof lVeinMat === 'function' ? lVeinMat(k, 0, () => 0) : 'erz';
        if (GEISEN[k]) res.push('eisenholz'); if (GSTERN[k] || hbTr(B, 'sternbaum', 'glasbaum')) res.push('sternholz'); if (GMARMOR[B.rv] != null || hbTr(B, 'saeule')) res.push('marmor'); if (GOBS[B.rv] != null || hbTr(B, 'obs')) res.push('obsidian');
        if (hbTr(B, 'eiche', 'herbst', 'tanne', 'schnee', 'birke', 'weide', 'palme', 'tot', 'dorn', 'kohle', 'riese')) res.unshift('holz'); if (hbTr(B, 'pilz', 'riesenpilz', 'kaktus', 'busch', 'schilf')) res.push('faser'); if (hbTr(B, 'knochenbaum', 'schaedel')) res.push('knochen'); if (hbTr(B, 'kristall')) res.push('kristall');
        if (vein !== 'erz' && !res.includes(vein)) res.push(vein);
        const Z = B.haz && LHAZ[B.haz];
        return hKv([[_t('RINGE'), B.r[0] === B.r[1] ? String(B.r[0]) : B.r[0] + '–' + B.r[1]], [_t('DUNKEL'), B.dark ? _t('ja') : _t('nein')], Z ? [_t('GEFAHR'), esc(Z.n)] : null, B.lb && LBAR[B.lb] ? [_t('GRENZEN HIER'), esc(LBAR[B.lb].n)] : null, vein && vein !== 'erz' ? [_t('ERZADERN'), esc(MATS[vein].n)] : null])
          + (Z ? hP(esc(Z.s)) : '') + (GEISEN[k] ? hP(_t('Hier gibt es besonders viel Eisenholz.')) : '') + (hbTr(B, 'riese') ? hP(_t('Hier stehen Weltenbäume – sie geben immer Eisenholz.')) : '')
          + hH(_t('ROHSTOFFE')) + hRows(res.map(m => ({ id: 'mat:' + m, ic: ['mat', m], t: esc(MATS[m].n) })))
          + hH(_t('GEGNER')) + hRows(B.en.filter(e => EN[e]).map(e => ({ id: 'en:' + e, ic: hbEnIc(e), t: esc(EN[e].name), d: esc(EN[e].desc) })))
          + (B.pl && B.pl.length ? hNote(_t('Typische Ortsnamen: {list}', { list: esc(B.pl.join(', ')) })) : '');
      } });
  }
}

/* ---------- Kapitel: Gegner & Bosse ---------- */
const HB_AI = { melee: () => _t('Nahkampf'), archer: () => _t('Schießt aus der Ferne und hält Abstand'), lunge: () => _t('Springt dich an'), bomber: () => _t('Wirft Bomben oder Flaschen'), caster: () => _t('Zaubert Geschosse'), ghost: () => _t('Gleitet durch Wände und verschwindet'), slam: () => _t('Schlägt Schockwellen'), charge: () => _t('Stürmt auf dich los'), burrow: () => _t('Gräbt sich ein und bricht unter dir hervor'), swoop: () => _t('Kreist in der Luft und stürzt herab'), dragon: () => _t('Feueratem und Diener'), flee: () => _t('Läuft mit dem Gold weg') };
function hbEnemies() {
  hbChap('en', _t('Gegner und Bosse'), ['sp', 'orc'], _t('Jeder Gegner, Elite, Champions, 1200 Bosse'));
  E('en:bosse', _t('Bosse der Geschichte'), { ic: ['s', 16, 428, 32, 36], kw: 'boss bosse akt grausch vexhal morgul ignaroth frostra morbus varkas pyraxis', see: ['start:kampagne', 'en:mechaniken', 'en:tausend'],
    s: _t('Am Ende jedes Akts wartet ein Boss.'),
    b: () => hRows(BOSSES.map((b, i) => ({ id: 'en:' + b.type, ic: hbEnIc(b.type), t: esc(b.name), d: _t('Akt {a} · {biome}', { a: i + 1, biome: esc(BIOMES[i].name) }) })))
      + hP(_t('Jeder Boss lässt 1–3 Drachenschuppen, einen Edelstein und eine Chronikseite oder Glücksmünze fallen. In der Qual kommen sie stärker zurück.')) });
  E('en:elite', _t('Elite und Champions'), { ic: ['s', 288, 432, 16, 16], kw: 'elite champion affix gefolge', see: ['en:affixe', 'start:karte'],
    s: _t('Stärkere Gegner mit besonderen Eigenschaften – und besserer Beute.'),
    b: () => hUl([_t('Elite-Gegner tragen Affixe (siehe unten) und lassen öfter Gegenstände, Edelsteine und Bauteile fallen.'), _t('Champions sind berüchtigte Anführer mit Gefolge. Sie haben immer ein Element und geben oft eine Glücksmünze.')]) + hH(_t('CHAMPIONS')) + hP(esc(CHAMPS.join(', '))) });
  E('en:affixe', _t('Gegner-Affixe'), { ic: ['s', 288, 432, 16, 16], kw: 'affix schnell explosiv gepanzert heiler vampir teleport frostig brennend riese', see: ['en:elite'],
    s: _t('Eigenschaften, die Elite-Gegner noch gefährlicher machen.'),
    b: () => hRows(Object.keys(AFFIX).map(k => ({ ic: '#' + AFFIX[k].c.slice(1), t: esc(AFFIX[k].n), d: (HB_AFX[k] || (() => ''))() }))) });
  if (typeof BOSS_N !== 'undefined') {
    E('en:tausend', _t('Tausend Bosse und der Boss-Kodex'), { ic: ['sp', 'demon', 'rgba(210,30,10,.38)'], kw: 'boss kodex trophäe 1200 bosse höhle titel übung', see: ['en:mechaniken', 'lande:horte'], go: ['kodex'],
      s: _t('{n} feste Bosse in den Endlosen Landen – von leicht bis fast unmöglich.', { n: BOSS_N }),
      b: () => hUl([_t('Jeder Boss hat 1 bis 5 Mechaniken, die er vorher ankündigt. Je höher sein Rang, desto mehr und schneller.'), _t('Der erste Sieg über einen Boss ist eine Trophäe. Alle 25 Trophäen wirst du dauerhaft etwas stärker, dazu gibt es Titel.'), _t('Im Boss-Kodex steht alles über jeden Boss. Dort kannst du kostenlos üben – ohne Beute, ohne Risiko.'), _t('Besiegte Bosse kehren nach 3 Tagen in ihre Höhle zurück.')])
        + hKv([[_t('DEINE TROPHÄEN'), typeof bossTrophies === 'function' ? bossTrophies() + ' / ' + BOSS_N : '–']]) + hH(_t('RÄNGE')) + hP(esc(BBAND.join(' · '))) + hH(_t('TITEL')) + hRows(BTITLE.map(([n, t]) => ({ ic: ['pa', 'muenze'], t: esc(t), d: _t('ab {n} Trophäen', { n }) }))) });
    E('en:mechaniken', _t('Boss-Mechaniken'), { ic: ['fx', 'ring', 10], kw: 'mechanik ausweichen frostnova meteor schockwelle sturmangriff beschwörung schild blitz giftwolke atem todessprung kugelring', see: ['en:tausend', 'start:handy'], go: ['kodex'],
      s: _t('Tipp: Farbige Flächen zeigen, wo gleich Schaden kommt. Raus da, bevor sie aufleuchten!'),
      b: () => hRows(Object.keys(BMECH).map(k => { const M = BMECH[k]; return { ic: M.ic, t: esc(M.n), d: esc(M.d) + (M.tip ? '<br>' + esc(M.tip) : '') }; })) });
  }
  for (const k of hbEns()) {
    const D = EN[k], bn = D.boss ? BOSSES.find(b => b.type === k) : null;
    E('en:' + k, hbEnName(k), { ic: hbEnIc(k), kw: 'gegner ' + k + ' ' + D.name + ' ' + (D.boss ? 'boss' : ''), see: [D.boss ? 'en:bosse' : 'en:elite'].concat(EN_EL && EN_EL[k] ? ['el:' + EN_EL[k]] : []), go: ['best'], s: esc(D.desc),
      b: () => {
        const el = typeof enemyEl === 'function' ? (EN_EL[k] || (D.boss ? BOSS_EL : null)) : null, bio = typeof LANDE_BIOMES !== 'undefined' ? hbBios(B => B.en.includes(k)) : [], drop = Object.keys(D.drop || {});
        const seen = SAVE.meta.bestiary[k] || 0, pet = typeof PET_MON !== 'undefined' ? PET_MON[k] : null, pm = petM();
        return hKv([[_t('VERHALTEN'), (HB_AI[D.ai] || (() => esc(D.ai)))()], [_t('ELEMENT'), el ? `${ELEM[el].g} ${esc(ELEM[el].n)} · ` + _t('schwach gegen {opp}', { opp: esc(ELEM[ELEM[el].opp].n) }) : _t('keins')], [_t('LEBEN'), D.hp], [_t('ANGRIFF'), D.atk], D.from < 99 ? [_t('AB STUFE'), _t('{st} (Akt {a})', { st: D.from, a: hbAct(D.from) })] : null, bn ? [_t('BOSS'), _t('Akt {a}', { a: BOSSES.indexOf(bn) + 1 })] : null, [_t('BESIEGT'), hbNum(seen)]])
          + (drop.length ? hH(_t('BEUTE')) + hRows(drop.map(m => ({ id: 'mat:' + m, ic: ['mat', m], t: esc(MATS[m].n), d: D.drop[m] >= 1 ? _t('immer {n} Stück', { n: D.drop[m] }) : _t('{p} Chance', { p: pc1(D.drop[m]) }) }))) : '')
          + (D.split ? hP(_t('Teilt sich beim Tod in zwei Schleimlinge.')) : '') + (D.summon && EN[D.summon] ? hP(_t('Ruft Verstärkung: {en}.', { en: esc(EN[D.summon].name) })) : '') + (D.boomDeath ? hP(_t('Explodiert, wenn er stirbt – halt Abstand!')) : '') + (D.trail ? hP(_t('Hinterlässt gefährliche Pfützen.')) : '')
          + (bio.length ? hH(_t('IN DEN ENDLOSEN LANDEN')) + hP(esc(bio.map(b => LANDE_BIOMES[b].n).join(', '))) : '')
          + (pet && PET_SP[pet] ? hP(pm && pm.seen.includes(pet) ? _t('Aus seinen Monster-Eiern schlüpft: {pet}.', { pet: esc(PET_SP[pet].n) }) : _t('In den Landen legt er manchmal Monster-Eier – was daraus schlüpft, verrät dir erst das Brutnest.')) : '');
      } });
  }
}
/* ---------- Kapitel: Begleiter ---------- */
function hbPets() {
  if (typeof PET_TIERS === 'undefined') return;
  hbChap('pet', _t('Begleiter'), ['pa', 'nest'], _t('Eier, Pflege, Arten, Zucht, Ausrüstung'));
  const M = petM() || { seen: [], mut: [], list: [] }, seen = sp => M.seen.includes(sp);
  const spIc = sp => () => seen(sp) ? petImgURL(sp, 2, 0, false, false).url : petSilURL(sp);
  E('pet:eier', _t('Eier und Seltenheiten'), { ic: () => eggURL(3, 0), kw: 'ei eier begleiter haustier seltenheit plunder mythisch finden', see: PET_TIERS.map((_, t) => 'egg:' + t).concat(['pet:pflege']), go: ['nest'],
    s: _t('Begleiter schlüpfen aus Eiern – sieben Seltenheiten von Plunder bis Mythisch.'),
    b: () => hRows(PET_TIERS.map((T_, t) => ({ id: 'egg:' + t, ic: () => eggURL(t, 0), t: esc(T_.egg), d: _t('Pflege bis zum Schlüpfen: {t} · Stärke ×{m} · Tasche {b}', { t: esc(buildTimeText(T_.care)), m: T_.mul.toLocaleString(LOCALE), b: T_.bag }) })))
      + hH(_t('WO FINDEN')) + hUl([_t('Dein erstes Ei gibt der erste Boss der Geschichte.'), _t('Endlose Lande: Truhen, Monster-Eier von Gegnern, Horte – je tiefer, desto seltener die Eier.'), _t('Champions, Bosse, Drachentruhen im Glückstempel, Basar und Tauschen.')]) + hP(_t('Höchstens {n} Eier auf einmal, davon {m} im Nest. Nestmutter Gunda kauft Eier, die du nicht willst.', { n: EGG_MAX, m: NEST_MAX })) });
  PET_TIERS.forEach((T_, t) => {
    E('egg:' + t, T_.egg, { ic: () => eggURL(t, 0), kw: 'ei seltenheit ' + T_.k, see: ['pet:eier', 'pet:pflege', 'pet:arten'], s: _t('Pflege bis zum Schlüpfen: {t}', { t: esc(buildTimeText(T_.care)) }),
      b: () => { const L = PET_BYT[t] || [], n = L.filter(seen).length; return hKv([[_t('SELTENHEIT'), `<span style="color:${T_.c};text-shadow:1px 1px 0 #000">${esc(T_.n)}</span>`], [_t('STÄRKE'), '×' + T_.mul.toLocaleString(LOCALE)], [_t('TASCHE'), _t('{n} Plätze', { n: T_.bag })], [_t('WÄRME HÄLT'), _t('{n} Std.', { n: T_.dur[0] })], [_t('FUTTER HÄLT'), _t('{n} Std.', { n: T_.dur[1] })], [_t('ZUWENDUNG HÄLT'), _t('{n} Std.', { n: T_.dur[2] })], typeof EGG_GOLD !== 'undefined' ? [_t('GUNDA ZAHLT'), _t('{n} Gold', { n: EGG_GOLD[t] })] : null])
        + hH(_t('FUTTER (DAS ERSTE, DAS DU HAST)')) + hRows(T_.food.map(([k, n]) => k === 'gold' ? { ic: ['s', 289, 385, 6, 7], t: _t('{n} Gold', { n }) } : { id: 'mat:' + k, ic: ['mat', k], t: _t('{n}× {mat}', { n, mat: esc(MATS[k].n) }) }))
        + hH(_t('ARTEN DIESER SELTENHEIT · {n} VON {m} ENTDECKT', { n, m: L.length })) + `<div class="hbgrid">${L.map(sp => `<div>${HB.noImg ? '' : `<img src="${hbImgURL(spIc(sp))}" alt="">`}<span>${seen(sp) ? esc(PET_SP[sp].n) : '???'}</span></div>`).join('')}</div>`; } });
  });
  E('pet:pflege', _t('Brutnest: Wärme, Futter, Zuwendung'), { ic: ['pa', 'nest'], kw: 'brutnest pflege wärme futter zuwendung streicheln schlüpfen gunda', see: ['pet:eier', 'bld:brutnest'], go: ['nest'],
    s: _t('Wärme, Futter, Zuwendung. Fehlt eins davon, schläft das Küken im Ei einfach weiter.'),
    b: () => hUl([_t('Leg das Ei ins Nest. Es wächst nur, solange Wärme, Futter und Zuwendung voll genug sind – auch wenn das Spiel zu ist.'), _t('Wärmen kostet nichts, Füttern kostet Material oder Gold (je nach Seltenheit), Streicheln gibt Zuwendung.'), _t('Wie lange jedes davon hält, steht beim Ei. Seltene Eier brauchen viel länger, bis sie schlüpfen.'), _t('Wackelt und knackt es? Dann ist es bereit – tippe es an.')]) });
  E('pet:arten', _t('Begleiter-Arten'), { ic: () => seen('drache') ? petImgURL('drache', 2, 0, false, false).url : petSilURL('drache'), kw: 'arten sammlung kreaturen entdeckt', see: ['pet:eier', 'pet:zucht'], go: ['pet'],
    s: _t('{n} von {m} Arten entdeckt. Unentdeckte siehst du nur als Schatten.', { n: M.seen.length, m: PET_ORDER.length }),
    b: () => PET_TIERS.map((T_, t) => hH(esc(T_.n).toLocaleUpperCase(LOCALE)) + hRows((PET_BYT[t] || []).map(sp => { const S = PET_SP[sp]; return seen(sp) ? { ic: spIc(sp), t: esc(S.n), d: esc(S.st) + ' · ' + (PET_EL[S.el] ? esc(PET_EL[S.el].n) : '') + (S.fav && MATS[S.fav] ? ' · ' + _t('mag: {mat}', { mat: esc(MATS[S.fav].n) }) : '') + '<br>' + _t('{a}: {ad} · ab LV 50: {s}', { a: esc(S.an || ''), ad: esc(S.ad || ''), s: esc(S.sn || '') }) } : { ic: spIc(sp), t: '???', d: _t('Noch nicht entdeckt') }; }))).join('')
      + hH(_t('HYBRIDE {n}/{max}', { n: PET_HY.filter(seen).length, max: PET_HY.length })) + hP(_t('Gibt es nur aus der Zucht – das Zuchtbuch verrät, wer zusammenpasst.'))
      + hRows(PET_HY.map(sp => { const S = PET_SP[sp]; return seen(sp) ? { ic: spIc(sp), t: esc(S.n), d: esc(S.st) + '<br>' + _t('Eltern: {a} × {b}', { a: esc(PET_SP[S.hy[0]].n), b: esc(PET_SP[S.hy[1]].n) }) } : { ic: spIc(sp), t: '???', d: _t('Hybrid – nur aus der Zucht') }; })) });
  E('pet:futter', _t('Füttern, Level und Entwicklung'), { ic: ['pa', 'nest'], kw: 'füttern level ep entwicklung stufe baby jung stark erwachsen uralt mythisch lieblingsfutter', see: ['pet:talente', 'pet:arten'], go: ['pet'],
    s: _t('Begleiter lernen im Kampf und durch Futter – und verwandeln sich in sechs Stufen.'),
    b: () => hRows(PET_STAGE.map((lv, i) => ({ ic: ['pa', 'nest'], t: _t('{name} – ab LV {lv}', { name: esc(PET_STN[i]), lv }), d: typeof PET_UNLOCK !== 'undefined' && PET_UNLOCK[i] ? _t('Neu: {x}', { x: esc(PET_UNLOCK[i]) }) : '' })))
      + hUl([_t('Füttern gibt Erfahrung: seltenes Material viel, Rohstoffe wenig. Lieblingsfutter zählt doppelt.'), _t('Ab LV 25 wirkt eine passive Kraft, ab LV 50 kommt ein Spezialangriff, ab LV 75 ein dritter Zauber-Sockel.'), _t('Bis LV 100 dauert es sehr, sehr lange.')]) });
  E('pet:gene', _t('Gene und Mutationen'), { ic: ['pa', 'nest'], kw: 'gene kraft tempo zähigkeit magie glück mutation albino gescheckt kristall gold sternen', see: ['pet:zucht'],
    s: _t('Jeder Begleiter hat fünf Gene. Selten verändert ihn eine Mutation.'),
    b: () => hH(_t('GENE')) + hRows(PET_GENES.map(g => ({ ic: '#' + g.c.slice(1), t: esc(g.n), d: _t('0 bis 100, Note S bis E') }))) + hP(_t('Gene erben sich bei der Zucht: Mittel der Eltern, dazu etwas Zufall.'))
      + hH(_t('MUTATIONEN · {n} VON {m} ENTDECKT', { n: M.mut.length, m: Object.keys(PET_MUT).length })) + hRows(Object.keys(PET_MUT).map(k => { const X = PET_MUT[k]; return M.mut.includes(k) ? { ic: '#' + PET_MUTC[X.r].slice(1), t: esc(X.n), d: esc(PET_MUTR[X.r]) + ' · ' + esc(X.d) } : { ic: '#' + PET_MUTC[X.r].slice(1), t: '???', d: esc(PET_MUTR[X.r]) }; }))
      + hP(_t('Mutationen entstehen selten beim Schlüpfen und öfter bei der Zucht – Glück der Eltern und mutierte Eltern helfen.')) });
  E('pet:zucht', _t('Zucht und Hybride'), { ic: ['pa', 'nest'], kw: 'zucht züchten hybrid eltern zuchtbuch', see: ['pet:gene', 'pet:arten'], go: ['pet'],
    s: _t('Zwei Begleiter ab LV {lv} legen zusammen ein Ei.', { lv: PET_BREED_LV }),
    b: () => hUl([_t('Beide Eltern müssen mindestens LV {lv} haben und dürfen nicht verletzt sein.', { lv: PET_BREED_LV }), _t('Danach ruhen sie sich aus: 8 Stunden und 2 mehr je Seltenheit.'), _t('Kosten: Gold, je seltener die Eltern, desto mehr.'), _t('Passen die Eltern zusammen, schlüpft mit etwas Glück ein Hybrid ({p} Grundchance).', { p: pct(PET_HYB_CH) }), _t('Das Ei erbt Gene, Farbe und manchmal eine Mutation.')]) });
  E('pet:talente', _t('Begleiter-Talente'), { ic: ['pa', 'nest'], kw: 'talent begleiter angriff schutz sammler große taschen', see: ['pet:futter'], go: ['pet'],
    s: _t('1 Punkt und einer mehr je 2 Level – in drei Zweigen.'),
    b: () => PET_TAL.map(B => hH(esc(B.n)) + hUl(B.nodes.map((n, i) => _t('{name} (bis {max}): {d}', { name: esc(n.n), max: n.max, d: esc(n.d) }) + (PET_TALREQ[i] ? ' · ' + _t('braucht {n} Punkte im Zweig', { n: PET_TALREQ[i] }) : '')))).join('') });
  E('pet:ausruestung', _t('Begleiter-Ausrüstung'), { ic: ['pa', 'nest'], kw: 'halsband panzer talisman ausrüstung begleiter', see: ['pet:zauber'], go: ['pet'],
    s: _t('Halsband (Angriff), Panzer (Schutz für dich), Talisman (Magie und Beute).'),
    b: () => hRows(PET_SLOTS.map(s => { const S = PET_SLOT[s]; return { ic: ['pa', 'nest'], t: esc(S.n), d: esc(S.names.join(' → ')) + hCost(Object.fromEntries(S.cost)) }; })) + hP(_t('Ausrüstung gibt es von Gegnern und aus Truhen der Lande – oder du stellst sie her. Legendäre Teile haben einen besonderen Wert.')) });
  E('pet:zauber', _t('Begleiter-Zauber'), { ic: ['pa', 'nest'], kw: 'zauber rune feuerball heilung schild blitz frostnova giftwolke meteor ranken', see: ['pet:ausruestung'], go: ['pet'],
    s: _t('Zauberrunen in Sockeln – der Begleiter wirkt sie im Kampf selbst.'),
    b: () => hRows(PET_SPELLS.map(k => { const S = PET_SPELL[k]; return { ic: '#' + (PET_EL[S.el] ? PET_EL[S.el].c.slice(1) : 'ffffff'), t: esc(S.n), d: esc(S.d) + ' · ' + _t('{cd} s', { cd: S.cd }) + hCost(Object.fromEntries(S.cost), S.gold) }; })) + hP(_t('1 Sockel, ab LV 25 zwei, ab LV 75 drei.')) });
  E('pet:verletzung', _t('Verletzung und Begleiter-Tasche'), { ic: ['pa', 'l_ei'], kw: 'verletzt verletzung tasche heim tod lande ruhe', see: ['lande:regeln', 'lande:taschen'],
    s: _t('Was in seiner Tasche liegt, bringt dein Begleiter heim, wenn du fällst.'),
    b: () => hUl([_t('Stirbst du in den Endlosen Landen, teleportiert dein Begleiter mit der Tasche nach Hause – danach ist er verletzt und ruht sich aus.'), _t('Die Ruhe dauert {a} bis {b} Minuten, je tiefer du warst, desto länger.', { a: lHurtMin(0), b: lHurtMin(1) }), _t('Größere Taschen: höhere Seltenheit, Entwicklungsstufe „Uralt“, Talent „Große Taschen“ und die Sattlerei.')]) });
}

/* ---------- Kapitel: Artefakte & Begegnungen ---------- */
function hbArte() {
  if (typeof ENCD === 'undefined') return;
  hbChap('arte', _t('Artefakte und Begegnungen'), ['pa', 'buch'], _t('Spuren, Schätze, mystische Begegnungen'));
  E('arte:spuren', _t('Artefakte und Spuren'), { ic: ['pa', 'buch'], kw: 'artefakt spur schatz siegel chronik gerücht suchkreis', see: ['arte:begegnungen', 'lande:welt'], go: ['chronik'],
    s: _t('Über {n} Artefakte in {m} Geschichten – jedes verrät, wo das nächste liegt.', { n: hbNum(Math.floor(ARTE_N / 100) * 100), m: hbNum(ARTE_NC) }),
    b: () => hUl([_t('Jede Spur ist eine kleine Geschichte mit 3 bis 9 Artefakten in den Endlosen Landen.'), _t('Jedes Fundstück sagt dir, in welche Richtung und wie weit das nächste liegt – und legt einen Suchkreis auf die Karte.'), _t('Am Ende wartet ein versiegelter Schatz. Das Siegel bricht, wenn alle Artefakte der Spur gefunden sind.'), _t('Gerüchte (bei Kundschafterin Elwa und in der Chronik) führen dich zu neuen Spuren.')])
      + hKv([[_t('GEFUNDEN'), typeof arteFound === 'function' ? hbNum(arteFound()) : '–']]) });
  E('arte:begegnungen', _t('Mystische Begegnungen'), { ic: ['pa', 'frage'], kw: 'begegnung sphinx feenring brunnen geist hexe drache', see: ['arte:spuren'], go: ['chronik'],
    s: _t('Mystische Begegnungen sind selten. Jede trifft man in den Endlosen Landen – manche nur an bestimmten Orten.'),
    b: () => { const A = aLocal(), seen = k => A && A.enc && A.enc[k]; return hRows(Object.keys(ENCD).map(k => ({ ic: '#' + (ENCD[k].c || '#e8dcc0').slice(1), t: seen(k) ? esc(ENCD[k].n) : '???', d: (seen(k) ? _t('{n}× begegnet', { n: A.enc[k] }) + ' · ' : '') + esc(ENCD[k].hint || '') }))); } });
}

/* ---------- Kapitel: Handel, Glück & Erfolge ---------- */
function hbTrade() {
  hbChap('han', _t('Handel, Glück und Erfolge'), ['pa', 'muenze'], _t('Händler, Basar, Tauschen, Glückstempel, Wochen'));
  E('han:haendler', _t('Händler auf der Weltkarte'), { ic: ['sp', 'dwarf'], kw: 'händler kaufen verkaufen gold laden shop borin', see: ['han:basar', 'mat:alle'],
    s: _t('Ausrüstung, Tränke, Edelsteine und Materialien kaufen – und Beute verkaufen.'),
    b: () => hUl([_t('Der Händler ist ein Ort auf der Weltkarte. Sein Angebot passt zu deinem Level.'), _t('Verkaufen geht aus dem Beutel und aus dem Lager. „Alle Gewöhnlichen & Magischen verkaufen“ lässt Aufgewertetes, Gesockeltes und Gegenstände mit Mods in Ruhe.')])
      + hRows(Object.keys(HB_SHOP).map(k => ({ id: 'mat:' + k, ic: ['mat', k], t: esc(MATS[k].n), d: (HB_SHOP[k][2] > 1 ? _t('{n} Stück für {g} Gold', { n: HB_SHOP[k][2], g: HB_SHOP[k][0] }) : _t('1 Stück für {g} Gold', { g: HB_SHOP[k][0] })) + (HB_SHOP[k][1] > 1 ? ' · ' + _t('ab Stufe {st} (Akt {a})', { st: HB_SHOP[k][1], a: hbAct(HB_SHOP[k][1]) }) : '') }))) });
  E('han:basar', _t('Basar'), { ic: ['pa', 'basar'], kw: 'basar auktion versteigern bieten kaufen verkaufen hedda marktwert handelsrang', see: ['han:haendler', 'bld:basar'], go: ['basar'],
    s: _t('Kaufe Angebote, verkaufe an Hedda oder versteigere deine Beute.'),
    b: () => hUl([_t('Angebote: alle 4 Stunden neu – Ausrüstung, Materialien, Edelsteine, Bauteile, manchmal Eier und Mods.'), _t('Verkaufen: Hedda zahlt sofort, aber etwas unter dem Marktwert.'), _t('Auktionen: Lege Startgebot, Sofortkauf und Dauer fest. Bieter kommen und gehen auch, während das Spiel zu ist.'), _t('Jeder Gegenstand zeigt seinen Marktwert.')])
      + (typeof MK_RANK !== 'undefined' ? hH(_t('HANDELSRANG')) + hRows(MK_RANK.map(([v, n], i) => ({ ic: ['pa', 'basar'], t: esc(n), d: _t('ab {n} Gold Umsatz · Gebühr {f} · {s} Auktionsplätze', { n: hbNum(v), f: pc1(MK_FEE[i]), s: MK_SLOT[i] }) }))) : '') });
  E('han:tauschen', _t('Tauschen und Verschenken'), { ic: ['pa', 'l_tausch'], kw: 'tauschen schenken code link freund tauschhändlerin', see: ['start:speichern'], go: ['trade'],
    s: _t('Gegenstände, Bündel und Begleiter per Code oder Link verschenken.'),
    b: () => hUl([_t('Wähle, was du verschenken willst – das Spiel macht daraus einen Code oder Link.'), _t('Dein Freund fügt den Code im Hauptmenü unter „Tausch empfangen“ ein.'), _t('Jeder Code geht nur einmal. Mods und veredelte Werte reisen mit.'), _t('Die Tauschhändlerin hat jeden Tag neue Angebote.')]) });
  E('han:tempel', _t('Glückstempel'), { ic: ['pa', 'rad'], kw: 'glückstempel glücksrad glücksrolle drehen truhe schicksalstruhe drachentruhe kosmetik münztausch', see: ['han:muenzen', 'bld:tempel', 'it:mythisch'], go: ['st:tempel'],
    s: _t('Glücksrolle, Schicksalstruhen und Münztausch – reiner Zufall mit den gezeigten Chancen.'),
    b: () => { const tot = WHEEL.reduce((a, w) => a + w.w, 0); return hH(_t('GLÜCKSROLLE (1 GLÜCKSMÜNZE)')) + hRows(WHEEL.map(w => ({ ic: '#' + w.c.slice(1), t: esc(w.n), r: pc1(w.w / tot) })))
      + hH(_t('SCHICKSALSTRUHEN')) + hRows(CHESTS.map(C => ({ ic: ['s', C.id === 'bronze' ? 304 : C.id === 'gold' ? 320 : 336, 416, 16, 16], t: esc(C.n), d: esc(C.d) + ' · ' + (C.coins ? _t('{n} Glücksmünzen', { n: C.coins }) : _t('Gold')) })))
      + hP(_t('Ab Tempel-Stufe 3 gibt es in jedem Akt einen Gratis-Dreh, in der Glückswoche jeden Tag einen. Im Münztausch kaufst du Glücksmünzen für Gold.')); } });
  E('han:muenzen', _t('Glücksmünzen'), { ic: ['pa', 'muenze'], kw: 'glücksmünze münze münzen coins fate', see: ['han:tempel', 'ver:bauen'],
    s: _t('Die besondere Währung für den Glückstempel und „Sofort fertig“.'),
    b: () => hP(_t('Glücksmünzen gibt es von Bossen, Champions, seltenen Truhen, der Tages-Challenge und Schreinen Fortunas. Jede Drehung ist reiner Zufall mit den gezeigten Chancen – Mythisch kann beim ersten Dreh kommen oder erst nach sehr vielen.'))
      + hUl([_t('Jeder Erfolg gibt eine Glücksmünze.'), _t('Ein geschaffter Akt, richtige Antworten bei der Sphinx und die Glücksquelle bringen auch welche.'), _t('Im Glückstempel kannst du sie gegen Gold kaufen.')]) });
  E('han:woche', _t('Wochen-Ereignisse'), { ic: ['pa', 'rad'], kw: 'woche wochenereignis goldrausch blutmond drachenwoche glückswoche schmiedewoche montag', see: ['fg:aufwerten', 'han:tempel'],
    s: _t('Jede Woche ab Montag gilt eine andere Regel – für alle Spieler gleich.'),
    b: () => hRows(WEEKLY.map((w, i) => ({ ic: w.icon, t: esc(w.n) + (weekEvent().id === w.id ? ' · ' + _t('JETZT') : ''), d: esc(w.d) }))) });
  E('han:erfolge', _t('Erfolge'), { ic: ['pa', 'muenze'], kw: 'erfolge achievement belohnung', see: ['han:ruhm'], go: ['ach'],
    s: _t('{n} von {m} geschafft. Jeder bringt Gold und eine Glücksmünze.', { n: ACH.filter(a => SAVE.meta.ach[a.id]).length, m: ACH.length }),
    b: () => hRows(ACH.map(a => ({ ic: ['pa', 'muenze'], t: (SAVE.meta.ach[a.id] ? '✓ ' : '') + esc(a.n), d: esc(a.d), r: _t('{n} G', { n: hbNum(a.r) }) }))) });
  E('han:ruhm', _t('Ruhmeshalle und Bestiarium'), { ic: ['s', 288, 432, 16, 16], kw: 'ruhmeshalle bestiarium chronik helden gefallen hardcore', see: ['han:erfolge', 'start:schwierig'], go: ['hall', 'best'],
    s: _t('Deine Helden, gefallene Hardcore-Helden, Tages-Bestwerte – und alle Gegner, die du kennst.'),
    b: () => hUl([_t('Die Ruhmeshalle zeigt alle lebenden Helden, gefallene Hardcore-Helden und die Punkte der Tages-Challenge.'), _t('Im Bestiarium steht jeder Gegner, den du besiegt hast – mit Beute und Element.'), _t('Chronikseiten findest du in Truhen, bei Elite-Gegnern, Bossen und in Gräbern. Ab Bibliothek-Stufe 3 häufiger.')]) });
}

// Reihenfolge der Kapitel
const HB_BUILD = [['faq', hbFaq], ['start', hbStart], ['cls', hbClasses], ['it', hbItems], ['fg', hbForge], ['mat', hbMats], ['ver', hbHide], ['lande', hbLande], ['bio', hbBiomes], ['en', hbEnemies], ['pet', hbPets], ['arte', hbArte], ['han', hbTrade]];
const HB_AFX = { schnell: () => _t('Läuft und schlägt viel schneller.'), explosiv: () => _t('Explodiert beim Tod.'), gepanzert: () => _t('Nimmt weniger Schaden, bis der Panzer bricht.'), heiler: () => _t('Heilt Gegner in der Nähe.'), vampir: () => _t('Heilt sich mit jedem Treffer.'), teleport: () => _t('Springt plötzlich hinter dich.'), frostig: () => _t('Treffer verlangsamen dich.'), brennend: () => _t('Hinterlässt Feuer am Boden.'), riese: () => _t('Größer, mit viel mehr Leben.') };
