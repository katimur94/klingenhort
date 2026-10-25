'use strict';
/* =========================================================
   KLINGENHORT – Neuigkeiten: Changelog und Vorschau
   Bei jedem Update oben einen Eintrag ergänzen und VERSION in
   js/data.js sowie sw.js anheben. k: neu | besser | fix
   ========================================================= */

const CHANGELOG = [
  {
    v: '4.2.0', d: '2026-10-25', t: 'Wochen-Ereignisse', items: [
      ['neu', 'Jede Woche gilt eine neue Regel für alle: Goldrausch, Blutmond, Drachenwoche, Glückswoche oder Schmiedewoche. Wechsel ist immer montags.'],
      ['neu', 'Goldrausch bringt 50 % mehr Gold, im Blutmond tauchen doppelt so viele Elite-Gegner auf – mit 30 % mehr Beute.'],
      ['neu', 'In der Drachenwoche fallen viel mehr Drachenschuppen und Jungdrachen streifen durch die Gebiete.'],
      ['neu', 'In der Glückswoche gibt es jeden Tag einen Gratis-Dreh am Glücksrad, in der Schmiedewoche ist Aufwerten 40 % günstiger.'],
      ['besser', 'Titelmenü und Weltkarte zeigen das aktuelle Ereignis, wie lange es noch läuft und was nächste Woche kommt.'],
      ['besser', 'Einstellungen: große Schrift für alle Menüs, Bildschirm-Wackeln und Blitzen lassen sich abschalten.']
    ]
  },
  {
    v: '4.1.0', d: '2026-10-25', t: 'Das Handy-Update', items: [
      ['neu', 'Hochformat: Klingenhort lässt sich jetzt auch hochkant spielen – Menüs, Weltkarte und Kämpfe. Drehen ist kein Muss mehr.'],
      ['neu', 'Eigene Knopf-Anordnung für Hoch- und Querformat. Der Editor speichert beide getrennt.'],
      ['neu', 'Neuigkeiten: Hier siehst du ab sofort jedes Update und was als Nächstes kommt.'],
      ['besser', 'Wichtige Knöpfe wie Zurück, Betreten oder Aufwerten bleiben immer unten sichtbar – kein Suchen mehr.'],
      ['besser', 'Charakter, Werkbank und Schatzkammer zeigen Gegenstand und Details nebeneinander.'],
      ['besser', 'Größere Knöpfe, Reiter und Farbfelder, besser lesbare Schrift auf kleinen Bildschirmen.'],
      ['besser', 'Weltkarte: Ort antippen zeigt ihn direkt auf der Karte, zweites Antippen betritt ihn.'],
      ['besser', 'Hinweise erscheinen oben und verdecken keine Knöpfe mehr.'],
      ['fix', 'iPhone: Wer das Handy nicht drehen konnte (Ausrichtungssperre oder TikTok-Browser), blieb beim Hinweis „Handy quer drehen“ hängen. Der Hinweis ist weg – es geht jetzt auch hochkant.'],
      ['besser', 'Im TikTok-, Instagram- oder Facebook-Browser erklärt ein Hinweis, wie du Klingenhort im richtigen Browser öffnest.'],
      ['besser', 'Touch-Knöpfe halten auf dem iPhone sicher Abstand zu Notch und Home-Balken.'],
      ['fix', 'Das Spiel hält nicht mehr an, wenn das Handy gedreht wird.']
    ]
  },
  {
    v: '4.0.1', d: '2026-10-25', t: 'Bosse im Rampenlicht', items: [
      ['besser', 'Bosse tragen einen pulsierenden Umriss in ihrer Farbe.'],
      ['fix', 'Todesritter Varkas war auf dunklem Boden kaum zu sehen.']
    ]
  },
  {
    v: '4.0.0', d: '2026-10-25', t: 'Das Versteck', items: [
      ['neu', 'Begehbares Versteck mit 12 Stationen, Händlern und Ausbaustufen.'],
      ['neu', 'Verschmelzen: zwei Gegenstände werden einer – mit Chance auf Mythisch.'],
      ['neu', 'Glückstempel mit Glücksrad, Schicksalstruhen, Flügeln, Auren und Umhängen.'],
      ['neu', 'Charakter-Editor: 11 Körper, Haare, Haut, Umhänge – jederzeit im Spiegel änderbar.'],
      ['neu', '8 Materialien von Eisen bis Ätherium und 27 Waffenformen mit eigener Grafik.'],
      ['neu', '46 Gegner, 8 Bosse mit eigener Geschichte, Ereignisse, Rätsel und Champions.'],
      ['neu', 'Frei verschiebbare Touch-Knöpfe, Joystick fest oder schwebend, Trank-Modus „Halten“.'],
      ['fix', 'Beim Rollen wurde manchmal aus Versehen ein Trank getrunken.']
    ]
  },
  {
    v: '3.0.2', d: '2026-10-25', t: 'Selbst-Update', items: [
      ['besser', 'Die installierte App holt sich neue Versionen jetzt selbst.']
    ]
  },
  {
    v: '3.0.1', d: '2026-10-25', t: 'Sichere Spielstände', items: [
      ['fix', 'Alte Spielstände werden robuster übernommen, klarere Meldung bei Startfehlern.']
    ]
  },
  {
    v: '3.0.0', d: '2026-10-25', t: 'Klassen & Weltkarte', items: [
      ['neu', 'Vier Klassen mit Talentbäumen, Werkbank, Weltkarte mit Wegen und das Endgame mit Qual-Stufen.']
    ]
  },
  {
    v: '1.0.0', d: '2026-10-25', t: 'Der Anfang', items: [
      ['neu', 'Klingenhort als installierbare App – offline spielbar.']
    ]
  }
];

// Vorschau: was in den nächsten Wochen kommt (Version, Text – siehe ROADMAP.md)
const COMING = [
  ['4.4', 'Tägliche und wöchentliche Aufträge mit Belohnungen im Versteck'],
  ['4.5', 'Neues Gebiet: der Sturmgipfel mit eigenem Boss und vier neuen Gegnern'],
  ['5.0', 'Saison 1: kostenloser Saison-Pass, Saison-Helden und eigene Rangliste'],
  ['5.1', 'Begleiter: Mini-Drache, Geisterkatze und Goldkäfer sammeln Beute für dich']
];

const NEWS_KIND = { neu: ['NEU', '#79c24e'], besser: ['BESSER', '#57a7d6'], fix: ['BEHOBEN', '#e8b04a'] };
// Ungesehene Neuigkeiten: Version des Spielstands ist älter als die aktuelle
function newsUnseen() { return !!(SAVE && SAVE.meta.seenVer && SAVE.meta.seenVer !== VERSION); }
function newsSeen() { if (SAVE && SAVE.meta.seenVer !== VERSION) { SAVE.meta.seenVer = VERSION; persist(); } }
function newsHTML() {
  const seen = SAVE.meta.seenVer;
  let h = '';
  CHANGELOG.forEach((E, i) => {
    const fresh = seen && seen !== VERSION && verNewer(E.v, seen);
    const date = E.d.split('-').reverse().join('.');
    h += `<details class="news"${i === 0 || fresh ? ' open' : ''}><summary><b>${E.v}</b> ${esc(E.t)}<small>${date}${fresh ? ' · <span style="color:var(--moss)">NEU FÜR DICH</span>' : ''}</small></summary><ul>${E.items.map(([k, t]) => `<li><span class="nk" style="--c:${NEWS_KIND[k][1]}">${NEWS_KIND[k][0]}</span>${esc(t)}</li>`).join('')}</ul></details>`;
  });
  return h;
}
function verNewer(a, b) { const x = a.split('.').map(Number), y = String(b).split('.').map(Number); for (let i = 0; i < 3; i++) { if ((x[i] || 0) !== (y[i] || 0)) return (x[i] || 0) > (y[i] || 0); } return false; }
function showNews(back) {
  newsBack = back || 'title';
  const html = `<div class="head"><h2>NEUIGKEITEN</h2><div class="hbtns"><span class="pill dim">VERSION ${VERSION}</span><button class="btn alt sm" data-act="newsback">Zurück</button></div></div>
  <div class="newsgrid"><div>${newsHTML()}</div>
  <div class="box"><h3 style="margin-top:0">DEMNÄCHST</h3>${COMING.map(([v, t]) => `<div class="soon"><b>${_t('Update {v}', { v })}</b>${esc(t)}</div>`).join('')}<p class="sub" style="font-size:16px;margin-bottom:0">Klingenhort wird jede Woche erweitert. Die installierte App aktualisiert sich von selbst.</p></div></div>`;
  newsSeen();
  showOverlay(html, true);
}
let newsBack = 'title';
