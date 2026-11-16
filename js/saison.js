'use strict';
/* =========================================================
   KLINGENHORT – Saison (6.6 „Saison 1“): alle sechs Wochen eine neue Saison mit kostenlosem Saison-Pass (30 Stufen)
   Hängt sich über HOOK/ON (js/core.js) ein:
   - Saison-Punkte gibt es fürs Spielen mit jedem Helden: Gegner 1, Elite 3, Champion 6, Boss 40, Auftrag abgeholt 50, aus den Landen entkommen 60.
     Übungskämpfe, Trainingspuppe und Totems zählen nicht.
   - Saison-Helden: jeder neue Held, der in der Saison erstellt wird (abwählbar bei der Erstellung), startet bei Level 1 und sammelt 50 % mehr Punkte.
     Die Rangliste zeigt die eigenen Saison-Helden (das Spiel läuft offline), darunter die Ergebnisse früherer Saisons.
   - Saison-Pass: 30 Stufen, jede mit Belohnung (wächst mit dem Level des Helden, der abholt); Stufe 15 und 30 geben Kosmetik nur aus dieser Saison
     (COSM[k].sz, js/data.js – nie aus dem Glückstempel). Abholen nur mit einem aktiven Helden; am Saison-Ende verfällt, was nicht abgeholt ist.
   Saison n läuft von SZ_T0 + (n − 1) · 42 Tage an; die Uhr des Geräts entscheidet (wie bei Wochen-Ereignissen und Aufträgen).
   Spielstand: SAVE.meta.sz = { v, no: Saison, xp: Punkte, cl: [abgeholte Stufen], hist: [{ no, st, lv }] } · Held: c.sz = Saison, in der er Saison-Held ist
   Schnittstelle: szNo(t) · szEnd(no) · szM() · szLevel(xp) → { st, in, need } · szReward(st, lv) · szGain(n) · szReady() · szClaim(st | 'all') · szHeroes() · szOpen(von)
   ========================================================= */

document.head.insertAdjacentHTML('beforeend', `<style>
.pill.sz{background:#57a7d6;color:var(--night)}
.szhead{display:flex;flex-wrap:wrap;gap:6px 14px;align-items:baseline;justify-content:space-between;margin-bottom:6px}.szhead b{font-family:var(--f-display);font-weight:400;font-size:10px;color:var(--gold)}.szhead small{font-size:17px;color:var(--parch-dim)}
.szbar{position:relative;height:18px;background:var(--night);box-shadow:inset 0 0 0 2px var(--stone-hi);margin-bottom:6px}.szbar i{position:absolute;left:2px;top:2px;bottom:2px;max-width:calc(100% - 4px);background:linear-gradient(90deg,#3a78b8,#8ee6ff)}
.szbar span{position:absolute;inset:0;display:grid;place-items:center;font-family:var(--f-display);font-size:7px;text-shadow:1px 1px 0 #000;white-space:nowrap}
.szg{display:grid;gap:6px;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));margin:8px 0}
.szc{background:var(--stone-lo);padding:8px;display:flex;flex-direction:column;gap:6px;min-width:0;box-shadow:inset 3px 0 0 var(--stone-hi)}
.szc b{font-family:var(--f-display);font-weight:400;font-size:8px;color:var(--parch-dim)}
.szc.ok{background:#2e2618;box-shadow:inset 3px 0 0 var(--gold),inset 0 0 0 2px var(--gold)}.szc.ok b{color:var(--gold)}
.szc.pd{opacity:.5}.szc.big{box-shadow:inset 3px 0 0 #8ee6ff}.szc.big.ok{box-shadow:inset 3px 0 0 #8ee6ff,inset 0 0 0 2px var(--gold)}
.szc .aqr{min-height:24px}.szc .rwc{max-width:100%;white-space:normal;line-height:1.05;min-width:0}.szc .btn{min-height:44px;width:100%}.szc small{font-size:15px;color:var(--parch-dim);line-height:1.1}
.szall{width:100%;min-height:44px;margin:4px 0}
body.touch .panel [data-act^="sz_"],body.touch .panel .btn[data-act^="sz_"],body.touch .panel .opt[data-act="sz_new"]{min-height:44px}
.szrow{display:grid;grid-template-columns:34px minmax(0,1fr) auto;gap:8px;align-items:center;background:var(--stone-lo);padding:8px 10px;margin-bottom:4px}
.szrow .rk{font-family:var(--f-display);font-size:11px;color:var(--gold);text-align:center}.szrow .nm{font-size:20px;line-height:1.05}.szrow small{font-size:16px;color:var(--parch-dim)}
.szul{margin:0 0 6px;padding-left:20px;font-size:17px;line-height:1.2}.szul li{margin-bottom:3px}
</style>`);

/* ---------- Kalender ---------- */
const SZ_T0 = new Date(2026, 10, 9).getTime(), SZ_LEN = 42 * 864e5, SZ_N = 30, SZ_BONUS = 1.5;
const SZ_PTS = { kill: 1, elite: 3, champ: 6, boss: 40, auf: 50, ext: 60 };
function szNo(t) { return Math.max(1, Math.floor(((t || Date.now()) - SZ_T0) / SZ_LEN) + 1); }
function szEnd(no) { return SZ_T0 + (no || szNo()) * SZ_LEN; }
function szDaysLeft() { return Math.max(1, Math.ceil((szEnd() - Date.now()) / 864e5)); }

/* ---------- Spielstand ---------- */
function szDef() { return { v: 1, no: szNo(), xp: 0, cl: [], hist: [] }; }
function szFix(d) {
  if (!d || typeof d !== 'object') return szDef();
  const n = v => Math.max(0, Math.floor(+v) || 0);
  return { v: 1, no: Math.max(1, n(d.no)), xp: Math.min(1e7, n(d.xp)), cl: (Array.isArray(d.cl) ? d.cl : []).map(n).filter((s, i, a) => s >= 1 && s <= SZ_N && a.indexOf(s) === i),
    hist: (Array.isArray(d.hist) ? d.hist : []).filter(h => h && typeof h === 'object').map(h => ({ no: Math.max(1, n(h.no)), st: Math.min(SZ_N, n(h.st)), lv: n(h.lv) })).slice(-20) };
}
HOOK.meta.push(m => { try { m.sz = szFix(m.sz); } catch (e) { console.error('Saison (meta):', e); m.sz = szDef(); } });
if (!PERSIST.includes('sz')) PERSIST.push('sz');
// aktuelle Saison – beim Wechsel wandert das Ergebnis der alten in die Liste, Punkte und Stufen beginnen neu
function szM() {
  const M = SAVE.meta.sz || (SAVE.meta.sz = szDef()), no = szNo();
  if (M.no !== no) {
    if (M.no < no && M.xp > 0) { const best = SAVE.chars.filter(c => c.sz === M.no).reduce((a, c) => Math.max(a, c.lv), 0); M.hist.push({ no: M.no, st: szLevel(M.xp).st, lv: best }); M.hist = M.hist.slice(-20); }
    M.no = no; M.xp = 0; M.cl = []; persist();
  }
  return M;
}

/* ---------- Stufen und Belohnungen ---------- */
function szNeed(st) { return 100 + st * 50; }   // Punkte von Stufe st − 1 auf st (1 … 30), zusammen 26 250
function szLevel(xp) { let st = 0, x = xp || 0; while (st < SZ_N && x >= szNeed(st + 1)) { x -= szNeed(st + 1); st++; } return { st, in: st >= SZ_N ? 0 : x, need: st >= SZ_N ? 0 : szNeed(st + 1) }; }
const szNice = v => { v = Math.max(10, v); const s = v < 200 ? 10 : v < 2000 ? 50 : 500; return Math.round(v / s) * s; };
// Belohnung der Stufe für einen Helden auf Level lv – je Saison und Stufe fest
function szReward(st, lv, no) {
  no = no || szNo(); lv = clamp(lv || 1, 1, 100);
  const R = mulberry(hashStr('sz' + no + ':' + st)), E = [{ t: 'gold', n: szNice((100 + lv * 35) * (1 + st / 15)) }];
  if (st === 30) E.push({ t: 'cos', k: 'a_saison' + no }, { t: 'fate', n: 10 });
  else if (st === 25) E.push({ t: 'myth' });
  else if (st === 20) E.push({ t: 'egg', tier: 3 }, { t: 'fate', n: 5 });
  else if (st === 15) E.push({ t: 'cos', k: 'c_saison' + no }, { t: 'fate', n: 3 });
  else if (st === 10) E.push({ t: 'leg' });
  else if (st === 5) E.push({ t: 'egg', tier: 2 });
  else if (st % 4 === 3) E.push({ t: 'fate', n: 1 + (st > 15 ? 1 : 0) });
  else if (st % 4 === 0) E.push(fkPartE(R, lv, st > 20 ? 1 : 0));
  else E.push(aufMat(R, lv, (60 + lv * 14) * (1 + st / 20)));
  return E;
}
const szBig = st => st % 5 === 0;
function szReady() { try { const M = szM(), st = szLevel(M.xp).st; let n = 0; for (let s = 1; s <= st; s++) if (!M.cl.includes(s)) n++; return n; } catch (e) { return 0; } }

/* ---------- Punkte sammeln ---------- */
const SZ = { from: 'title', tab: 'pass', dirty: 0 };
function szGain(n) {
  if (!P || !SAVE || SAVE.active < 0 || !(n > 0)) return 0;
  const M = szM(), a = szLevel(M.xp).st, g = Math.round(n * (P.sz === M.no ? SZ_BONUS : 1));
  M.xp += g; SZ.dirty++;
  const b = szLevel(M.xp).st;
  if (b > a) { toast(_t('Saison-Stufe {n} erreicht! Belohnung abholen: Karte → Mehr → Saison', { n: b }), '#8ee6ff'); sfx('ach'); persist(); SZ.dirty = 0; }
  return g;
}
HOOK.kill.push(e => {
  if (!P || !e || e.ai === 'dummy' || e.bTotem || e.bPractice || !G || G.type === 'versteck' || G.daily) return;
  try { szGain(e.boss ? SZ_PTS.boss : e.champ ? SZ_PTS.champ : e.elite ? SZ_PTS.elite : SZ_PTS.kill); } catch (err) { console.error('Saison (Kill):', err); }
});
HOOK.stat.push((k, n) => { try { if (k === 'aufDone') szGain(SZ_PTS.auf * n); else if (k === 'landeExt') szGain(SZ_PTS.ext); } catch (e) { console.error('Saison:', e); } });
HOOK.room.push(() => { if (SZ.dirty) { SZ.dirty = 0; try { persist(); } catch (e) { } } });

/* ---------- Abholen ---------- */
// → { ok, got: [Belohnung], n: Stufen } | { err: 'hero' | 'lande' | 'none' }
function szClaim(st) {
  if (!P || SAVE.active < 0) return { err: 'hero' }; if (typeof landeActive === 'function' && landeActive()) return { err: 'lande' };
  const M = szM(), top = szLevel(M.xp).st, list = [];
  for (let s = 1; s <= top; s++) if ((st === 'all' || s === st) && !M.cl.includes(s)) list.push(s);
  if (!list.length) return { err: 'none' };
  const got = [];
  for (const s of list) { for (const e of szReward(s, P.lv, M.no)) { try { const g = lvrGive(e); if (g) got.push(g); } catch (err) { console.error('Saison (Belohnung):', err); } } M.cl.push(s); }
  stat('szClaim', list.length); saveChar(); persist();
  return { ok: 1, got, n: list.length };
}

/* ---------- Saison-Helden ---------- */
function szHeroes(no) { no = no || szNo(); return SAVE.chars.filter(c => c.sz === no && !c.dead).sort((a, b) => b.lv - a.lv || (b.paragon || 0) - (a.paragon || 0) || (b.maxAct || 1) - (a.maxAct || 1)); }
HOOK.create.push(() => `<div class="opts"><button class="opt${CS.sz === false ? '' : ' sel'}" data-act="sz_new">${_t('SAISON-HELD {v}', { v: CS.sz === false ? _t('AUS') : _t('AN') })}<small>${_t('Tritt in Saison {n} an: eigene Rangliste und 50 % mehr Saison-Punkte.', { n: szNo() })}</small></button></div>`);
HOOK.created.push(c => { if (CS.sz !== false) c.sz = szNo(); });
ON.sz_new = () => { CS.sz = CS.sz === false; CS.name = ($('cname') || {}).value || ''; sfx('click'); showCreate(); };

/* ---------- Bildschirm ---------- */
function szName(no) { return _t('Saison {n}', { n: no }); }
function szCard(M, st, top, lv) {
  const pd = M.cl.includes(st), ok = st <= top && !pd, E = szReward(st, lv, M.no);
  return `<div class="szc${ok ? ' ok' : ''}${pd ? ' pd' : ''}${szBig(st) ? ' big' : ''}"><b>${_t('STUFE {n}', { n: st })}</b><div class="aqr">${E.map(lvrChip).join('')}</div>${pd ? `<small>${_t('abgeholt')}</small>` : ok ? `<button class="btn sm" data-act="sz_claim" data-i="${st}">${_t('Abholen')}</button>` : ''}</div>`;
}
function szPassHTML(M) {
  const L = szLevel(M.xp), n = szReady(), hero = SAVE.active >= 0 && P, lv = hero ? P.lv : 1;
  let cards = ''; for (let s = 1; s <= SZ_N; s++) cards += szCard(M, s, L.st, lv);
  return `${n ? (hero ? `<button class="btn szall" data-act="sz_claim" data-i="0">${_t('Alle abholen ({n})', { n })}</button>` : `<p class="sub">${_t('Wähle zuerst einen Helden (Spielen) – die Belohnungen holst du dann über Karte → Mehr → Saison ab.')}</p>`) : ''}
  <div class="szg">${cards}</div>
  <div class="box"><h3 style="margin-top:0">${_t('SO SAMMELST DU SAISON-PUNKTE')}</h3><ul class="szul"><li>${_t('Gegner besiegen: 1 Punkt, Elite 3, Champion 6, Boss 40')}</li><li>${_t('Auftrag abholen: 50 Punkte')}</li><li>${_t('Aus den Endlosen Landen entkommen: 60 Punkte')}</li><li>${_t('Saison-Helden sammeln 50 % mehr Punkte.')}</li></ul><p class="sub" style="font-size:16px;margin-bottom:0">${_t('Der Saison-Pass ist kostenlos. Die Belohnungen wachsen mit dem Level des Helden, der sie abholt. Am Ende der Saison verfällt, was du nicht abgeholt hast.')}</p></div>`;
}
function szHeroHTML(M) {
  const H = szHeroes(M.no);
  const rows = H.map((c, i) => `<div class="szrow"><span class="rk">${i + 1}</span><div><div class="nm">${esc(c.name)} ${c.hc ? '<span class="pill hc">HC</span>' : ''}</div><small>${esc(CLASSES[c.cls].name)} · ${_t('Akt {act}', { act: c.act })}</small></div><span class="pill sz">${_t('LV {lv}', { lv: c.lv })}${c.paragon ? ' · P' + c.paragon : ''}</span></div>`).join('');
  const hist = M.hist.slice().reverse().map(h => `<div class="szrow"><span class="rk">${h.no}</span><div><div class="nm">${esc(szName(h.no))}</div><small>${_t('Saison-Pass Stufe {st} von {n}', { st: h.st, n: SZ_N })}${h.lv ? ' · ' + _t('bester Saison-Held: LV {lv}', { lv: h.lv }) : ''}</small></div><span></span></div>`).join('');
  return `<h3>${_t('DEINE SAISON-HELDEN')}</h3>${rows || `<p class="sub">${_t('Noch kein Saison-Held. Erstelle im Titelmenü einen neuen Helden – er startet bei Level 1 und tritt automatisch in dieser Saison an.')}</p>`}
  <p class="sub" style="font-size:16px">${_t('Die Rangliste zeigt deine eigenen Saison-Helden auf diesem Gerät, der höchste Level steht oben. Nach der Saison bleiben sie ganz normale Helden.')}</p>${hist ? `<h3>${_t('FRÜHERE SAISONS')}</h3>${hist}` : ''}`;
}
function szShow() {
  const M = szM(), L = szLevel(M.xp), n = szReady(), d = szDaysLeft();
  const tab = (k, l, b) => `<button class="tab" role="tab" aria-selected="${SZ.tab === k}" data-act="sz_tab" data-id="${k}">${l}${b ? ` (${b})` : ''}</button>`;
  showOverlay(`<div class="head"><h2>${esc(szName(M.no)).toLocaleUpperCase(LOCALE)}</h2><div class="hbtns"><button class="btn alt sm" data-act="sz_back">${_t('Zurück')}</button></div></div>
  <div class="szhead"><b>${_t('SAISON-PASS · STUFE {st}/{n}', { st: L.st, n: SZ_N })}</b><small>${d === 1 ? _t('endet morgen') : _t('endet in {n} Tagen', { n: d })}</small></div>
  <div class="szbar"><i style="width:${L.need ? (L.in / L.need * 100).toFixed(1) : 100}%"></i><span>${L.need ? _t('{a} / {b} Punkte', { a: L.in, b: L.need }) : _t('Alle Stufen erreicht!')}</span></div>
  <div class="tabs" role="tablist">${tab('pass', _t('SAISON-PASS'), n)}${tab('held', _t('RANGLISTE'))}</div>${SZ.tab === 'held' ? szHeroHTML(M) : szPassHTML(M)}`, true);
}
function szOpen(from) {
  if (typeof landeActive === 'function' && landeActive()) return;
  if (from) SZ.from = from; SZ.tab = 'pass';
  if (SZ.from === 'map') { setState('menu'); showHud(false); }
  sfx('page'); szShow();
}
ON.sz_open = id => szOpen(id || 'title');
ON.sz_back = () => { sfx('click'); if (SZ.from === 'map') { setState('map'); showMapMore(); } else showTitle(); };
ON.sz_tab = id => { SZ.tab = id === 'held' ? 'held' : 'pass'; sfx('click'); szShow(); panel.scrollTop = 0; };
ON.sz_claim = (id, b, i) => {
  const r = szClaim(i > 0 ? i : 'all');
  if (r.ok) { const top = lvrTop(r.got); toast((r.n > 1 ? _t('{n} Stufen abgeholt', { n: r.n }) : _t('Stufe abgeholt')) + ': ' + lvrLine(r.got).join(' · '), '#79c24e'); sfx(top.best ? 'ach' : 'buy'); }
  else { toast(r.err === 'hero' ? _t('Wähle zuerst einen Helden.') : _t('Hier gibt es gerade nichts abzuholen.'), '#ff6a5a'); sfx('deny'); }
  szShow();
};
const szBtn = from => { const n = szReady(); return `<button class="btn alt" data-act="sz_open" data-id="${from}">${esc(szName(szNo()))}${n ? `<span class="badge">${n}</span>` : ''}</button>`; };
HOOK.titleBtns.push(() => { try { return szBtn('title'); } catch (e) { return ''; } });
HOOK.mapMore.push(() => { try { return P ? szBtn('map') : ''; } catch (e) { return ''; } });
