'use strict';
/* =========================================================
   KLINGENHORT – Neuigkeiten: Changelog und Vorschau
   Bei jedem Update oben einen Eintrag ergänzen und VERSION in
   js/data.js sowie sw.js anheben. k: neu | besser | fix
   ========================================================= */

const CHANGELOG = [
  {
    v: '6.2.0', d: '2026-10-26', t: 'Sammeln & Bauen', items: [
      ['neu', 'Holz, Stein, Fasern, Federn und seltene Rohstoffe wie Eisenholz, Sternholz, Marmor und Obsidian: Fälle Bäume, schlag Steine ab und ernte Pflanzen in den Endlosen Landen – und am Holzplatz und Steinbruch deines Verstecks.'],
      ['neu', 'Felder im Kräutergarten: Pflanze Samen von Flachs bis Sternblume, sie wachsen in echter Zeit – auch während das Spiel zu ist.'],
      ['neu', 'Bauen braucht jetzt Zeit: Ausbauten laufen von 10 Sekunden bis zu 20 Stunden. Wer nicht warten will, beschleunigt mit Gold oder Glücksmünzen. Alle Gebäude haben mehr Stufen, die Schatzkammer sogar 15.'],
      ['neu', 'Sattlerei: größere Taschen – Beutel bis 90 Plätze, Rucksack in den Landen bis 40, mehr Platz in der Begleiter-Tasche. Die Schatzkammer fasst bis zu 400 Gegenstände.'],
      ['neu', 'Sammelbeutel: Gold, Materialien, Edelsteine, Bauteile und Mods nehmen in den Landen keinen Rucksack-Platz mehr weg.'],
      ['neu', 'Magische Vögel aus dem Vogelhaus: Spatz, Taube, Rabe, Eule und Phönixfeder fliegen bis zu 10 Dinge aus den Landen sicher nach Hause.'],
      ['besser', 'Händler, Basar, Werkbank, Schmiede und Juwelier können jetzt auch direkt mit Gegenständen aus dem Lager arbeiten.'],
      ['fix', 'Wer seinen ersten Mod im Basar kauft, sieht jetzt zuerst „Gekauft!“.']
    ]
  },
  {
    v: '6.1.2', d: '2026-10-26', t: 'Besser spielen am PC', items: [
      ['neu', 'Steuerung am PC: Linke Maustaste greift an, rechte rollt, 1 2 3 für die Fähigkeiten, 4 für die Ultimative, 5 für den Trank, WASD zum Laufen. Angriffe und Fähigkeiten zielen auf den Mauszeiger.'],
      ['neu', 'HD-Grafik: Am PC werden Schrift, Licht und Effekte in voller Bildschirmauflösung gezeichnet – die Pixel bleiben gestochen scharf, auch bei 125 % oder 150 % Windows-Skalierung und in 4K. Umschalten: Einstellungen → Grafik.'],
      ['besser', 'Auf großen Bildschirmen sind Spielwelt, Anzeigen und Menüs jetzt deutlich größer. Neuer Knopf „Vollbild“.'],
      ['fix', 'Laptops mit Touchscreen: Die Maus funktioniert jetzt immer – die Handy-Knöpfe erscheinen nur, wenn du wirklich tippst.']
    ]
  },
  {
    v: '6.1.1', d: '2026-10-26', t: 'Bis zum Rand der Welt', items: [
      ['neu', 'Die Endlosen Lande sind jetzt bis zum Rand voller Neuem: 20 Grenzen statt 11 und 26 neue Biome – von der Kristallwüste über Uhrwerk-Ruinen und Titanengräber bis zum Ufer des Nichts. 74 Biome insgesamt.'],
      ['neu', 'Meisterwerkzeuge: Hinter der 11. Grenze brauchst du die zweite Stufe deiner Werkzeuge – Seil II, Eishaken II, Feuermantel II und mehr. Sie schützen auch vor den Gefahren der tiefen Biome.'],
      ['neu', 'Das Ende der Welt: Am Rand stehen Monumente mit einem Wächter. Wer als Erstes dort ankommt, wird reich belohnt.'],
      ['besser', 'Tief draußen sind die Gegner stärker und tragen öfter besondere Eigenschaften.'],
      ['fix', 'Entfernungen wie „770 m“ und „450 Schritte“ brechen nicht mehr mitten im Wort um. Werkzeuge aus Artefakt-Schätzen passen jetzt zur Tiefe.']
    ]
  },
  {
    v: '6.1.0', d: '2026-10-26', t: 'Die Endlosen Lande', items: [
      ['neu', 'Die Verlorenen Lande sind jetzt die Endlosen Lande: eine riesige, feste Welt – für alle Spieler gleich. Vom Weltentor bis zum Rand läufst du 24 Stunden. Unterwegs: 48 Biome, Regionen mit eigenen Namen, Wahrzeichen, Ruinen und Außenposten.'],
      ['neu', 'Nicht jeder Weg ist offen: Schluchten, Flüsse, Lava, Eis, Giftnebel und Finsternis überquerst du nur mit Wegwerkzeugen wie Seil, Eishaken oder Feuermantel. Sie liegen in bewachten Horten.'],
      ['neu', 'Leuchtfeuer: Setze bis zu 12 Checkpoints. Sie speichern deine Karte, sind Startpunkt für den nächsten Ausflug und ein sicherer Ausgang. Stirbst du, vergisst du alles, was du seit dem letzten Leuchtfeuer entdeckt hast.'],
      ['neu', '1200 Bosse – von leicht bis fast unmöglich, mit 29 Mechaniken, die sich vorher ankündigen. Der Boss-Kodex sammelt Trophäen, die dich dauerhaft stärker machen. Besiegte Bosse kehren nach 3 Tagen zurück.'],
      ['neu', 'Über 5000 Artefakte in 830 Geschichten: Jedes Fundstück erzählt ein Stück und verrät, wo das nächste liegt. Am Ende wartet ein versiegelter Schatz. Dazu 35 mystische Begegnungen – von der Sphinx bis zum Feenring.'],
      ['neu', 'Kreaturen: 77 Arten, Monster-Eier, Zucht mit Genen, 16 Mischformen und seltene Mutationen. Begleiter bekommen Ausrüstung, Talente und Zauber.'],
      ['neu', 'Mods: Runen, Glyphen, Essenzen, Kerne und Prägungen in den Mod-Plätzen deiner Gegenstände, 36 geheime Resonanzen, dazu Umschmieden, Veredeln und Extrahieren in der Werkbank.'],
      ['besser', 'Tag und Nacht in den Landen statt Zeitdruck: Nachts jagen dich gefährlichere Monster.'],
      ['besser', 'Beim Verschenken reisen Mods und veredelte Werte mit dem Gegenstand.'],
      ['fix', 'Der Countdown am Ausgang läuft jetzt in echter Zeit.']
    ]
  },
  {
    v: '6.0.0', d: '2026-10-25', t: 'Die Verlorenen Lande', items: [
      ['neu', 'Die Verlorenen Lande: Durch das Weltentor in deinem Versteck betrittst du eine riesige, jedes Mal neue Freiwelt. Die beste Beute des Spiels liegt hier – in Truhen, Verstecken, Erzadern und bei gefallenen Abenteurern, immer an anderen Orten.'],
      ['neu', 'Hohes Risiko: Was du findest, gehört dir erst, wenn du durch einen Ausgang entkommst. Stirbst du, ist alles verloren, was du angelegt und im Rucksack hast – du wachst im Versteck auf.'],
      ['neu', 'Dein Begleiter ist ein mystisches Wesen: Was in seiner Tasche liegt, bringt er dir beim Tod nach Hause. Danach ist er verletzt und braucht Ruhe.'],
      ['neu', 'Zufällige Bosse ziehen durch die Lande. Traust du dir den Kampf nicht zu, lauf weg! Dazu Händler, die tauschen, Auftraggeber mit Missionen, Rivalen, die selbst plündern, und Weltstufen bis in den Abgrund.'],
      ['neu', 'Begleiter schlüpfen jetzt aus Eiern: Im Brutnest wärmst, fütterst und streichelst du sie, bis sie schlüpfen – das kann bei seltenen Eiern Tage dauern. 24 Kreaturen in sieben Seltenheiten, von der Feldmaus bis zur Weltenschlange.'],
      ['neu', 'Dein erstes Ei bekommst du vom ersten Boss der Geschichte. Weitere findest du in den Verlorenen Landen, in Truhen, bei Bossen und im Basar.'],
      ['neu', 'Basar: Kaufe Angebote, verkaufe an Händlerin Hedda oder stelle deine Beute in Auktionen ein und biete selbst mit. Jeder Gegenstand zeigt jetzt seinen Marktwert.'],
      ['neu', 'Jeder Gegenstand sieht anders aus: Material und Seltenheit erkennst du auf einen Blick, Legenden, Set-Teile und Mythisches haben eigene Formen und Farben.'],
      ['neu', 'Auren: Legendäre und mythische Gegenstände und volle Sets umgeben deinen Helden mit Leuchten, Flammen, Frost, Blitzen oder Funken.'],
      ['besser', 'Die Schmiede ist aufgeräumt: nur noch vier Bereiche – Verbessern, Schmieden, Zerlegen und Werkstatt. Dein Meisterwerk entsteht Schritt für Schritt, mit Vorschau und Hilfe zu jedem Begriff.'],
      ['besser', 'Bestehende Begleiter bleiben dir erhalten.']
    ]
  },
  {
    v: '5.0.1', d: '2026-10-25', t: 'Die Glücksrolle', items: [
      ['neu', 'Glücksrolle: Wie beim Case-Opening rauscht eine Reihe Belohnungen vorbei, wird langsamer und bleibt auf deinem Gewinn stehen. Antippen überspringt.'],
      ['neu', 'Auch die Schicksalstruhen öffnen sich jetzt mit der Rolle.'],
      ['besser', 'Reiner Zufall: Es gibt keine Garantie nach einer bestimmten Zahl von Drehungen mehr – Mythisch kann bei jedem Dreh kommen. Die Chancen stehen direkt unter der Rolle.'],
      ['besser', 'Glückstempel Stufe 2 macht Glücksmünzen im Münztausch 25 % günstiger.'],
      ['fix', 'Beim Tauschen werden Bauteile mit richtigem Namen und Bild angezeigt.']
    ]
  },
  {
    v: '5.0.0', d: '2026-10-25', t: 'Meisterwerk', items: [
      ['neu', 'Begleiter: Glutdrache, Geisterkatze, Goldkäfer, Frosteule, Giftnatter und Sturmfunke kämpfen an deiner Seite, sammeln Beute ein und wachsen mit dir – von Level 1 bis 100, in sechs Entwicklungsstufen bis zur mythischen Form.'],
      ['neu', 'Jeder bekommt einen Begleiter geschenkt. Weitere schlüpfen aus Eiern von Bossen und aus der Drachentruhe – in vielen Farben und als seltene schillernde Exemplare.'],
      ['neu', 'Elemente: Feuer, Frost, Blitz, Gift, Licht und Schatten. Triff Gegner an ihrer Schwäche für 50 % mehr Schaden – Rüstungen mit Element schützen dich.'],
      ['neu', 'Schmiede der Meister: Sammle Bauteile in zehn Stufen, verbinde drei zu einem besseren und schmiede daraus dein eigenes Meisterwerk. Die Schmiedemeisterschaft wächst bis Level 100.'],
      ['neu', 'Zerlegen: Alte Gegenstände werden zu Bauteilen und Materialien.'],
      ['neu', 'Meisterschaft: Jede Fähigkeit wird durch Benutzen stärker – bis Level 50 mit sechs Rängen. Jeder Rang sieht anders aus, ganz oben golden.'],
      ['neu', 'Tauschen: Verschenke Gegenstände, Materialien und Begleiter per Code oder Link an Freunde. Die Tauschhändlerin hat jeden Tag neue Angebote.'],
      ['neu', 'Aussehen: Am Spiegel wählst du das Aussehen deiner Waffe und Rüstung aus deiner Sammlung – die Werte bleiben gleich.'],
      ['besser', 'Heldenbilder zeigen jetzt auch die Waffe.']
    ]
  },
  {
    v: '4.3.1', d: '2026-10-25', t: 'Langer Weg nach oben', items: [
      ['besser', 'Aufsteigen dauert länger: Alle Talente hast du erst nach dem Ende der Geschichte voll, Level 50 ist ein Ziel für das Endgame.'],
      ['besser', 'Dafür bringt jedes Level mehr Lebenspunkte und Schaden – die Kämpfe unterwegs bleiben fair.'],
      ['besser', 'Seltene Beute ist wieder etwas Besonderes: Selten, Episch, Legendär und Set-Teile fallen deutlich seltener. Bosse, Champions und Truhen bleiben die besten Quellen.']
    ]
  },
  {
    v: '4.3.0', d: '2026-10-25', t: 'Sechs Sprachen', items: [
      ['neu', 'Klingenhort spricht jetzt sechs Sprachen: Deutsch, Englisch, Türkisch, Spanisch, Italienisch und Französisch.'],
      ['neu', 'Das Spiel startet in der Sprache deines Handys. Wechseln geht jederzeit über 🌐 im Titelmenü oder in den Einstellungen – dein Spielstand bleibt erhalten.'],
      ['besser', 'Zahlen und Daten erscheinen im Format deiner Sprache.'],
      ['fix', 'Lange Hinweise rutschen nicht mehr über den Bildschirmrand hinaus.']
    ]
  },
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
  ['6.3', 'Aufträge & Ruf: Tages- und Wochenaufträge, Fraktionen mit Ruf-Stufen und besseren Tauschangeboten'],
  ['6.4', 'Neues Gebiet: der Sturmgipfel mit Blitz-Gegnern, eigenem Boss und Sturmsilber'],
  ['6.5', 'Saison 1: kostenloser Saison-Pass, Saison-Helden und eigene Rangliste'],
  ['6.6', 'Begleiter-Expeditionen: Schick deine Begleiter allein in die Endlosen Lande – sie bringen Beute, Eier und Artefakte mit']
];

const NEWS_KIND = { neu: [_t('NEU'), '#79c24e'], besser: [_t('BESSER'), '#57a7d6'], fix: [_t('BEHOBEN'), '#e8b04a'] };
// Ungesehene Neuigkeiten: Version des Spielstands ist älter als die aktuelle
function newsUnseen() { return !!(SAVE && SAVE.meta.seenVer && SAVE.meta.seenVer !== VERSION); }
function newsSeen() { if (SAVE && SAVE.meta.seenVer !== VERSION) { SAVE.meta.seenVer = VERSION; persist(); } }
function newsHTML() {
  const seen = SAVE.meta.seenVer;
  let h = '';
  CHANGELOG.forEach((E, i) => {
    const fresh = seen && seen !== VERSION && verNewer(E.v, seen);
    const date = new Date(E.d + 'T12:00').toLocaleDateString(LOCALE);
    h += `<details class="news"${i === 0 || fresh ? ' open' : ''}><summary><b>${E.v}</b> ${esc(E.t)}<small>${date}${fresh ? ' · <span style="color:var(--moss)">' + _t('NEU FÜR DICH') + '</span>' : ''}</small></summary><ul>${E.items.map(([k, t]) => `<li><span class="nk" style="--c:${NEWS_KIND[k][1]}">${NEWS_KIND[k][0]}</span>${esc(t)}</li>`).join('')}</ul></details>`;
  });
  return h;
}
function verNewer(a, b) { const x = a.split('.').map(Number), y = String(b).split('.').map(Number); for (let i = 0; i < 3; i++) { if ((x[i] || 0) !== (y[i] || 0)) return (x[i] || 0) > (y[i] || 0); } return false; }
function showNews(back) {
  newsBack = back || 'title';
  const html = `<div class="head"><h2>${_t('NEUIGKEITEN')}</h2><div class="hbtns"><span class="pill dim">${_t('VERSION {v}', { v: VERSION })}</span><button class="btn alt sm" data-act="newsback">${_t('Zurück')}</button></div></div>
  <div class="newsgrid"><div>${newsHTML()}</div>
  <div class="box"><h3 style="margin-top:0">${_t('DEMNÄCHST')}</h3>${COMING.map(([v, t]) => `<div class="soon"><b>${_t('Update {v}', { v })}</b>${esc(t)}</div>`).join('')}<p class="sub" style="font-size:16px;margin-bottom:0">${_t('Klingenhort wird jede Woche erweitert. Die installierte App aktualisiert sich von selbst.')}</p></div></div>`;
  newsSeen();
  showOverlay(html, true);
}
let newsBack = 'title';
