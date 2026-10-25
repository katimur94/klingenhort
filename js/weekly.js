'use strict';
/* =========================================================
   KLINGENHORT – Wochen-Ereignisse: jede Kalenderwoche (ab Montag)
   gilt automatisch eine andere Regel, für alle Spieler gleich.
   Neue Ereignisse einfach unten anhängen. fx: gold, loot, elite,
   dragon, fate, spin, smith, upChance
   ========================================================= */

const WEEKLY = [
  { id: 'gold', n: 'Goldrausch', d: '+50 % Gold aus Gegnern, Truhen und Räumen', c: '#ffd24a', icon: ['s', 320, 416, 16, 16], fx: { gold: .5 } },
  { id: 'blut', n: 'Blutmond', d: 'Doppelt so viele Elite-Gegner – und 30 % mehr Beute', c: '#ff5a3a', icon: ['s', 288, 432, 16, 16], fx: { elite: 1, loot: .3 } },
  { id: 'drache', n: 'Drachenwoche', d: 'Drachenschuppen fallen viel häufiger, Jungdrachen streifen durch die Gebiete', c: '#ff8a3a', icon: ['mat', 'schuppe'], fx: { dragon: 1 } },
  { id: 'glueck', n: 'Glückswoche', d: 'Jeden Tag ein Gratis-Dreh am Glücksrad, doppelt so viele Glücksmünzen', c: '#ff4fd8', icon: ['pa', 'rad'], fx: { spin: 1, fate: 1 } },
  { id: 'schmiede', n: 'Schmiedewoche', d: 'Aufwerten und Verschmelzen 40 % günstiger, Aufwerten +10 % Erfolgschance', c: '#57a7d6', icon: ['pa', 'amboss'], fx: { smith: .4, upChance: .1 } }
];

// Nummer der Woche (Montag bis Sonntag, Ortszeit) seit 1970
function weekNo(t) {
  const d = new Date(t || Date.now()), day = Math.floor((d.getTime() - d.getTimezoneOffset() * 60000) / 864e5);
  return Math.floor((day + 3) / 7);
}
// WEEK_FORCE (Tests, Clips) wählt ein Ereignis von Hand
function weekEvent(off) { const f = window.WEEK_FORCE && !off && WEEKLY.find(w => w.id === window.WEEK_FORCE); return f || WEEKLY[((weekNo() + (off || 0)) % WEEKLY.length + WEEKLY.length) % WEEKLY.length]; }
// Wirkung des aktuellen Ereignisses; die Tages-Challenge bleibt für alle gleich
function weekFx(k) { if (typeof G !== 'undefined' && G && G.daily) return 0; return weekEvent().fx[k] || 0; }
function weekDaysLeft() { const d = new Date(); return 7 - ((d.getDay() + 6) % 7); }
function dayKey() { const d = new Date(); return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate(); }
// Gratis-Dreh: einmal pro Akt ab Tempel-Stufe 3, in der Glückswoche zusätzlich einmal pro Tag
function freeSpin() {
  if (hideLv('tempel') >= 3 && !P.story['spin' + P.act]) return 'act';
  if (weekFx('spin') && SAVE.meta.luck.day !== dayKey()) return 'day';
  return null;
}
function weekHTML() {
  const E = weekEvent(), N = weekEvent(1), left = weekDaysLeft();
  return `<div class="weekbox" style="--c:${E.c}"><img class="px" src="${iconURL(E.icon)}" alt=""><div><b>${left === 1 ? _t('WOCHEN-EREIGNIS · NOCH 1 TAG') : _t('WOCHEN-EREIGNIS · NOCH {n} TAGE', { n: left })}</b><div class="nm" style="color:${E.c}">${E.n}</div>${E.d}.<small>${_t('Nächste Woche: {name}', { name: N.n })}</small></div></div>`;
}
// Neues Ereignis einmal ankündigen
function weekAnnounce() {
  const w = weekNo(); if (SAVE.meta.weekSeen === w) return; SAVE.meta.weekSeen = w; persist();
  const E = weekEvent(); toast(_t('Wochen-Ereignis: {name}!', { name: E.n }), E.c); sfx('ach');
}
