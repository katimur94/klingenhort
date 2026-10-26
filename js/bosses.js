'use strict';
/* =========================================================
   KLINGENHORT – Tausend Bosse: Generator, Mechaniken, Höhlen, Boss-Kodex, Trophäen
   Hängt sich über HOOK/ON (js/core.js) ins Spiel ein.
   1200 feste Bosse (für alle Spieler gleich): bossDef(id) → Körper (EN-Art samt KI), Element, Größe, Farbe, Name, Titel, Legende,
   1–5 angekündigte Mechaniken (BMECH), Elite-Affixe, Signatur-Beute. Rang r = id / (BOSS_N − 1): 0 leicht … 1 fast unmöglich.
   Höhere Ränge: mehr Mechaniken, kürzere Warnzeiten, mehrere gleichzeitig, mehr Geschosse.
   Welt (js/lande.js): bossForLair(lairKey, ctx) → id · bossSpawn(id, x, y, { ctx, lair, stage }) → Gegner · bossLairReady(lairKey)
     bossLairLeft(lairKey) → ms bis zur Rückkehr · bossShift(dx, dy) beim Verschieben des Ursprungs · bossKodex(zurück) öffnet den Kodex
   Spielstand SAVE.meta.bosses: b = { id: [erster Sieg (Minute), Siege, cx, cy] } (Eintrag = gesehen), l = { Höhle: Sieg (ms) } (nach 3 Tagen gelöscht),
     tt = gewählter Titel, h = gezeigte Tipps (Bits)
   Trophäe = erster Sieg über einen Boss: alle 25 Trophäen ein kleiner Kontobonus (HOOK.stats, gedeckelt), Titel bei Meilensteinen.
   Ohne Welt: bossArena(id, o) – Übungskampf aus dem Kodex (keine Beute, kein Risiko), Tests mit { practice: false }.
   ========================================================= */

/* ---------- Grundwerte & Zufall (fest für alle) ---------- */
const BOSS_N = 1200, BOSS_SEED = 0x6b1e55, BOSS_RESPAWN = 3 * 864e5, BOSS_BANDS = 12, BOSS_BAND_N = BOSS_N / BOSS_BANDS;
function bHash(...a) {
  let h = 2166136261;
  for (const v of a) { const s = String(v); for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619); h = Math.imul(h ^ 124, 16777619); }
  h ^= h >>> 16; h = Math.imul(h, 0x7feb352d); h ^= h >>> 15; h = Math.imul(h, 0x846ca68b); h ^= h >>> 16;
  return h >>> 0;
}
function bRng(...a) { return mulberry(bHash(BOSS_SEED, ...a)); }
const bFill = (s, v) => String(s).replace(/\{(\w+)\}/g, (m, k) => (v[k] != null ? v[k] : m));
const bLerp = (a, b, r) => a + (b - a) * clamp(r, 0, 1);
const bPick = (a, R) => a[Math.floor(R() * a.length)];
const BRGBA = {};
function bRgba(hex, a) { const k = hex + (a * 50 | 0); if (BRGBA[k]) return BRGBA[k]; const [r, g, b] = hexRgb(hex); return BRGBA[k] = `rgba(${r},${g},${b},${(a * 50 | 0) / 50})`; }
const BERR = {};
function bSafe(k, fn, def) { return (...a) => { try { return fn(...a); } catch (e) { if (!BERR[k]) { BERR[k] = 1; console.error('Bosse (' + k + '):', e); } return def; } }; }

/* ---------- Körper, Farben, Namen ---------- */
// t = Gegnerart (KI, Waffe, Geschosse aus EN), sc = Grundgröße, h = LP-Faktor, g = Geschlecht für den Titel, r = ab Rang
//   (die Kampagnen-Bosse ab dem Rang, der zu ihrem Akt passt; Zauberer und Flieger nicht ganz unten)
const BBODY = [
  { t: 'ogre', sc: 1.5, h: 1.1, g: 'm' }, { t: 'shaman', sc: 1.9, h: .9, g: 'm', r: .06 }, { t: 'zombie', sc: 1.55, h: 1.15, g: 'm', r: .02 }, { t: 'demon', sc: 1.6, h: 1.1, g: 'm', r: .1 },
  { t: 'frostra', sc: 1.9, h: .9, g: 'f', r: .12 }, { t: 'morbus', sc: 1.9, h: .95, g: 'm', r: .14 }, { t: 'varkas', sc: 1.9, h: 1, g: 'm', r: .16 }, { t: 'pyraxis', sc: 1.85, h: 1.2, g: 'm', r: .2 },
  { t: 'golem', sc: 1.45, h: 1.2, g: 'm', r: .02 }, { t: 'frostoger', sc: 1.45, h: 1.1, g: 'm', r: .05 }, { t: 'zwerg', sc: 2, h: 1, g: 'm' }, { t: 'berserker', sc: 2, h: 1, g: 'm' },
  { t: 'todesritter', sc: 2, h: 1, g: 'm', r: .08 }, { t: 'jungdrache', sc: 2.3, h: 1.1, g: 'm', r: .06 }, { t: 'orc', sc: 2.1, h: 1, g: 'm' }, { t: 'lizard', sc: 2, h: .95, g: 'm' },
  { t: 'chort', sc: 2, h: .95, g: 'm', r: .02 }, { t: 'lavadaemon', sc: 2, h: 1, g: 'm', r: .05 }, { t: 'imp', sc: 2.2, h: .85, g: 'm', r: .03 }, { t: 'engel', sc: 2.3, h: .9, g: 'f', r: .07 },
  { t: 'schattenimp', sc: 2.2, h: .85, g: 'm', r: .06 }, { t: 'pyro', sc: 2, h: .85, g: 'm', r: .04 }, { t: 'hexe', sc: 2, h: .85, g: 'f', r: .05 }, { t: 'skelmage', sc: 2.1, h: .85, g: 'm', r: .04 },
  { t: 'mage', sc: 2, h: .85, g: 'm', r: .04 }, { t: 'lizshaman', sc: 2, h: .9, g: 'f', r: .03 }, { t: 'elfe', sc: 2, h: .85, g: 'f', r: .06 }, { t: 'skelarcher', sc: 2.2, h: .85, g: 'm', r: .02 },
  { t: 'wurm', sc: 2.2, h: 1, g: 'm', r: .02 }, { t: 'geist', sc: 2.1, h: .9, g: 'm', r: .02 }, { t: 'eisgeist', sc: 2.2, h: .9, g: 'm', r: .05 }, { t: 'kuerbis', sc: 2.3, h: .9, g: 'm' },
  { t: 'seuche', sc: 2, h: .9, g: 'm', r: .05 }, { t: 'bomber', sc: 2.1, h: .9, g: 'm', r: .01 }, { t: 'goldmimik', sc: 2.4, h: 1, g: 'm', r: .03 }, { t: 'slime', sc: 2.4, h: 1, g: 'm' },
  { t: 'toxslime', sc: 2.4, h: 1, g: 'm', r: .02 }, { t: 'glutschleim', sc: 2.5, h: .95, g: 'm', r: .02 }, { t: 'skeleton', sc: 2.2, h: .95, g: 'm' }, { t: 'goblin', sc: 2.4, h: .9, g: 'm' }
];
// Färbung je Element; selten eine besondere (Gold, Leere, Blut, Geisterlicht)
const BTINT = {
  feuer: ['rgba(255,90,30,.38)', 'rgba(220,40,20,.42)', 'rgba(255,170,40,.36)', 'rgba(140,20,10,.45)'],
  frost: ['rgba(140,210,255,.45)', 'rgba(200,240,255,.5)', 'rgba(80,140,255,.4)', 'rgba(170,230,255,.35)'],
  blitz: ['rgba(255,230,60,.38)', 'rgba(255,250,170,.4)', 'rgba(200,170,30,.42)', 'rgba(120,200,255,.32)'],
  gift: ['rgba(120,220,60,.38)', 'rgba(170,60,230,.38)', 'rgba(60,140,40,.45)', 'rgba(200,240,90,.32)'],
  licht: ['rgba(255,240,180,.45)', 'rgba(255,215,90,.4)', 'rgba(255,255,255,.4)', 'rgba(255,190,220,.35)'],
  schatten: ['rgba(90,40,160,.45)', 'rgba(30,10,40,.55)', 'rgba(160,100,255,.38)', 'rgba(70,0,30,.48)']
};
const BTINTX = ['rgba(255,210,60,.5)', 'rgba(10,0,20,.62)', 'rgba(200,0,20,.42)', 'rgba(220,255,240,.5)'];
// Silben für erfundene Namen (bleiben in allen Sprachen gleich)
const BSYL = {
  a: ['Vor', 'Kra', 'Mor', 'Ush', 'Zar', 'Gal', 'Thar', 'Xe', 'Bra', 'Dro', 'Ul', 'Ka', 'Ny', 'Ves', 'Gor', 'Sha', 'Il', 'Rha', 'Ty', 'Om', 'Kel', 'Fa', 'Ash', 'Bel', 'Nar', 'Grim', 'Skar', 'Vel', 'Hal', 'Ruk', 'Ys', 'Zu', 'Mal', 'Ost', 'Car', 'Eth', 'Fen', 'Hra', 'Jor', 'Lur', 'Qua', 'Sel', 'Tor', 'Wy', 'Ix', 'Az'],
  b: ['ga', 'ro', 'ma', 'ka', 'the', 'lu', 'di', 'ra', 'zo', 'ne', 'vi', 'ta', 'gu', 'sha', 'mo', 'ri', 'do', 'la', 'xi', 'be', 'que', 'ny'],
  c: ['th', 'rax', 'gor', 'mar', 'dun', 'zar', 'os', 'ith', 'ul', 'ak', 'en', 'orn', 'yx', 'ash', 'iel', 'ok', 'ar', 'uun', 'is', 'ek', 'um', 'oth', 'ir', 'ax', 'ys', 'ur', 'an', 'ex', 'og', 'ia', 'ond', 'eth']
};
// keine Namen, die nach Schimpfwörtern klingen (junge Spieler)
const BBAD = /nazi|hitl|sex|fick|arsch|hur|nig|neger|fag|gay|homo|porn|piss|kak|kack|kac|kot|fot|wix|wich|nutt|pim|schei|mist|penis|anal|cum|tit|dick|cock|shit|fuck|rape|slut|kkk|ss$/i;
// Titel: Rolle + Reich (Genitiv mit eigenem Artikel) – „{name}, Hüter des Ewigen Eises“
const BJOIN = _t('{name}, {title}');
const BROLE = [
  [_t('Hüter {d}'), _t('Hüterin {d}')], [_t('Herr {d}'), _t('Herrin {d}')], [_t('Fürst {d}'), _t('Fürstin {d}')], [_t('Wächter {d}'), _t('Wächterin {d}')],
  [_t('König {d}'), _t('Königin {d}')], [_t('Tyrann {d}'), _t('Tyrannin {d}')], [_t('Schlächter {d}'), _t('Schlächterin {d}')], [_t('Bote {d}'), _t('Botin {d}')],
  [_t('Bewahrer {d}'), _t('Bewahrerin {d}')], [_t('Verschlinger {d}'), _t('Verschlingerin {d}')], [_t('Wanderer {d}'), _t('Wanderin {d}')], [_t('Rufer {d}'), _t('Ruferin {d}')],
  [_t('Schmied {d}'), _t('Schmiedin {d}')], [_t('Prophet {d}'), _t('Prophetin {d}')], [_t('Jäger {d}'), _t('Jägerin {d}')], [_t('Erbe {d}'), _t('Erbin {d}')],
  [_t('Hirte {d}'), _t('Hirtin {d}')], [_t('Bezwinger {d}'), _t('Bezwingerin {d}')], [_t('Richter {d}'), _t('Richterin {d}')], [_t('Herold {d}'), _t('Heroldin {d}')],
  [_t('Geißel {d}')], [_t('Schrecken {d}')], [_t('Plage {d}')], [_t('Stimme {d}')], [_t('Faust {d}')], [_t('Auge {d}')], [_t('Zorn {d}')], [_t('Albtraum {d}')], [_t('Klinge {d}')], [_t('Herz {d}')]
];
const BDOM = {
  feuer: [_t('der Lodernden Glut'), _t('des Weltenfeuers'), _t('der Aschenfelder'), _t('des Brennenden Himmels'), _t('der Feuerberge'), _t('des Roten Mondes'), _t('der Ewigen Flamme'), _t('des Schwarzen Rauchs'), _t('der Glühenden Tiefe'), _t('des Letzten Funkens')],
  frost: [_t('des Ewigen Eises'), _t('der Gefrorenen Tiefe'), _t('des Weißen Sturms'), _t('der Frostgipfel'), _t('des Stillen Winters'), _t('der Klirrenden Kälte'), _t('des Kristallthrons'), _t('der Gläsernen Seen'), _t('des Nordwinds'), _t('der Erstarrten Zeit')],
  blitz: [_t('des Donners'), _t('der Sturmküste'), _t('des Zuckenden Himmels'), _t('der Tausend Blitze'), _t('des Grollenden Berges'), _t('der Gewitternacht'), _t('des Eisernen Sturms'), _t('der Funkenschmiede'), _t('des Rasenden Windes'), _t('der Zerrissenen Wolken')],
  gift: [_t('des Fauligen Moors'), _t('der Grünen Pest'), _t('des Schwarzen Sumpfs'), _t('der Tausend Seuchen'), _t('des Verdorbenen Waldes'), _t('der Giftigen Nebel'), _t('des Bitteren Kelchs'), _t('der Modernden Wurzeln'), _t('des Kriechenden Todes'), _t('der Stillen Fäulnis')],
  licht: [_t('des Goldenen Morgens'), _t('der Gefallenen Sonne'), _t('des Heiligen Feuers'), _t('der Gläsernen Kathedrale'), _t('des Ersten Lichts'), _t('der Weißen Türme'), _t('des Blendenden Throns'), _t('der Sternenhallen'), _t('des Ewigen Mittags'), _t('der Strahlenden Klinge')],
  schatten: [_t('der Schattenhallen'), _t('des Ewigen Zwielichts'), _t('der Leere'), _t('des Vergessenen Grabes'), _t('der Mondlosen Nacht'), _t('des Flüsternden Abgrunds'), _t('der Schwarzen Sonne'), _t('des Letzten Atems'), _t('der Verlorenen Seelen'), _t('des Stummen Schreis')],
  all: [_t('der Verlorenen Lande'), _t('des Alten Ordens'), _t('der Tiefen Gruft'), _t('des Endlosen Hungers'), _t('der Gebrochenen Krone'), _t('des Letzten Tores'), _t('der Tausend Schlachten'), _t('des Rostigen Throns'), _t('der Knochenberge'), _t('der Ersten Stunde'), _t('des Weltenrands'), _t('der Uralten Wege')]
};
// Legende: ein bis zwei Sätze aus Vorlagen; Orte sind erfundene Namen
const BLORE = [_t('Man sagt, {name} habe einst {deed}.'), _t('Seit {n} Wintern haust {name} in {place}.'), _t('{name} sammelt {thing} – und die Knochen derer, die danach fragen.'), _t('Wer {name} begegnet, hört zuerst {sound}.'), _t('Die Kundschafter meiden {place}, seit {name} dort erwacht ist.'), _t('{name} fürchtet nur eines: {fear}.'), _t('Alte Lieder erzählen, {name} sei aus {origin} geboren.'), _t('Auf {name} steht ein Kopfgeld von {g} Gold. Niemand hat es je abgeholt.'), _t('Die Karten des Ordens nennen {place} nur „das Revier von {name}“.'), _t('{name} spricht nie. Doch in {place} flüstern die Steine diesen Namen.')];
const BLW = {
  deed: [_t('ein ganzes Heer in Stein verwandelt'), _t('den Mond eine Nacht lang verschluckt'), _t('drei Könige an einem Tag gestürzt'), _t('eine Stadt unter Eis begraben'), _t('einen Fluss zum Kochen gebracht'), _t('hundert Ritter des Ordens besiegt'), _t('einen Drachen mit bloßen Händen bezwungen'), _t('ein Tor der Alten versiegelt'), _t('die Sonne einen Tag lang verdunkelt'), _t('einen Wald in Asche gelegt'), _t('einen Gott betrogen'), _t('die Toten eines ganzen Tals geweckt'), _t('eine Flotte im Sturm versenkt'), _t('den Schatz eines Zwergenkönigs gestohlen')],
  thing: [_t('Kronen gefallener Könige'), _t('Zähne von Drachen'), _t('Glocken versunkener Tempel'), _t('zerbrochene Schwerter'), _t('leuchtende Steine'), _t('die Schädel von Helden'), _t('alte Karten der Lande'), _t('gestohlene Sterne'), _t('Federn des Phönix'), _t('die Rüstungen des Ordens')],
  sound: [_t('ein fernes Glockenläuten'), _t('das Knirschen von Eis'), _t('ein leises Lachen'), _t('das Rasseln schwerer Ketten'), _t('das Summen tausender Fliegen'), _t('Donner aus klarem Himmel'), _t('ein altes Wiegenlied'), _t('das Knistern von Feuer')],
  fear: [_t('Sonnenlicht'), _t('Lieder über Helden'), _t('den Klang von Silber'), _t('Spiegel'), _t('die Stille'), _t('Kinderlachen'), _t('frisches Wasser'), _t('das Licht der Sterne')],
  origin: [_t('der ersten Flamme'), _t('dem Schlamm der Urzeit'), _t('einem zerbrochenen Stern'), _t('dem letzten Atemzug eines Gottes'), _t('einem Fluch des Ordens'), _t('der tiefsten Gruft'), _t('einem Riss in der Leere'), _t('den Tränen eines Riesen')]
};
const BBAND = [_t('Leicht'), _t('Fordernd'), _t('Gefährlich'), _t('Brutal'), _t('Grausam'), _t('Höllisch'), _t('Mörderisch'), _t('Albtraum'), _t('Episch'), _t('Legendär'), _t('Mythisch'), _t('Fast unmöglich')];
const BBANDC = ['#79c24e', '#a8d84a', '#e8d04a', '#e8b04a', '#ff9a3a', '#ff6a3a', '#e8402a', '#c8342c', '#b892f4', '#ff8a3a', '#ff4fd8', '#ffffff'];
// Signatur-Beute: „Zorn von Vorgath“ – Legendär, Element des Bosses, Affixe passend zum Element
const BSIGN = _t('{noun} von {name}');
const BSIGW = { weapon: [_t('Zorn'), _t('Biss'), _t('Urteil'), _t('Schwur'), _t('Hunger'), _t('Ruf'), _t('Splitter'), _t('Kuss'), _t('Fluch'), _t('Wille'), _t('Klage'), _t('Echo')], armor: [_t('Haut'), _t('Panzer'), _t('Mantel'), _t('Wacht'), _t('Schuppen'), _t('Bollwerk'), _t('Hülle'), _t('Schutz')], helm: [_t('Krone'), _t('Blick'), _t('Maske'), _t('Haupt'), _t('Diadem'), _t('Traum'), _t('Gedanken')] };
const BSIGA = {
  weapon: { feuer: ['feuer', 'wucht', 'krit'], frost: ['frost', 'krit', 'wucht'], blitz: ['tempo', 'krit', 'wucht'], gift: ['raub', 'tempo', 'feuer'], licht: ['raub', 'krit', 'tempo'], schatten: ['krit', 'wucht', 'raub'] },
  armor: { feuer: ['panzer', 'leben', 'schutz'], frost: ['schutz', 'panzer', 'leben'], blitz: ['eile', 'schutz', 'heil'], gift: ['heil', 'leben', 'eile'], licht: ['heil', 'leben', 'glueck'], schatten: ['eile', 'schutz', 'glueck'] }
};
const BAFF = ['schnell', 'explosiv', 'gepanzert', 'vampir', 'teleport', 'frostig', 'brennend'];
// Diener je Element (keine Beschwörer, damit sich nichts aufschaukelt)
const BMIN = { feuer: ['imp', 'chort', 'glutschleim', 'kuerbis'], frost: ['icez', 'eisgeist', 'skelarcher'], blitz: ['goblin', 'bomber', 'zwerg', 'gobarcher'], gift: ['toxslime', 'slime', 'lizard'], licht: ['engel', 'orc', 'gobarcher'], schatten: ['skeleton', 'skelarcher', 'geist', 'schattenimp'] };
const BORB = { feuer: 'fireball', frost: 'waterorb', blitz: 'lightbolt', gift: 'plant', licht: 'purebolt', schatten: 'darkorb' };
const BCOLX = { rot: ['#5a1010', '#c8463c', '#ff6a4a', '#ffd0b0'], erde: ['#3a2a1a', '#8a6a3a', '#d8a860', '#fff0c0'], blut: ['#3a0a10', '#a8202a', '#ff4a5a', '#ffc0c8'] };
function bCol(k) { return (typeof ELEM !== 'undefined' && ELEM[k] && ELEM[k].c) || BCOLX[k] || BCOLX.rot; }
// Heiltotem: unsichtbare Hülle (eigenes Bild in HOOK.drawEnemy), taucht nie in Wellen oder im Bestiarium auf
EN.btotem = { name: _t('Heiltotem'), sp: 'necro', hp: 50, atk: 0, spd: 0, r: 7, xp: 0, gold: 0, ai: 'melee', reach: 0, wind: 1, cd: 99, cost: 99, from: 1e9, mass: 99, blood: '#79e04a', drop: {}, hidden: 1, desc: '' };

/* ---------- Mechaniken ----------
   n = Name, d = Erklärung (Kodex), ic = Bild, el = passt zu (häufiger), r = ab Rang, cd = Abklingzeit, c = Farbe der Warnung, p = passiv, tip = Hinweis beim ersten Mal */
const BMECH = {
  nova: { n: _t('Frostnova'), d: _t('Ein eisiger Ring um den Boss friert ein, wer drinsteht. Raus aus dem Kreis!'), ic: ['fx', 'icelance', 1], el: ['frost'], r: 0, cd: 9, c: 'frost', snd: 'frost' },
  meteor: { n: _t('Meteorregen'), d: _t('Brennende Felsen fallen vom Himmel. Die Kreise zeigen, wo sie einschlagen.'), ic: ['fx', 'firebomb', 3], el: ['feuer'], r: 0, cd: 10, c: 'feuer', snd: 'fire' },
  wave: { n: _t('Schockwellen'), d: _t('Der Boss stampft – Wellen rollen nach außen. Rolle durch die Welle oder bleib außer Reichweite.'), ic: ['fx', 'ring', 10], el: ['blitz'], r: 0, cd: 9, c: 'erde', snd: 'boom', tip: _t('Tipp: Während du rollst, kann dich nichts treffen – rolle durch Wellen hindurch!') },
  charge: { n: _t('Sturmangriff'), d: _t('Eine Bahn zeigt, wohin der Boss gleich stürmt. Geh zur Seite!'), ic: ['w', 'knight_sword'], el: [], r: 0, cd: 7, c: 'rot', snd: 'lunge' },
  summon: { n: _t('Beschwörung'), d: _t('Aus Portalen kriechen Diener. Erledige sie, bevor es zu viele werden.'), ic: ['sp', 'tinyz'], el: ['schatten'], r: 0, cd: 18, c: 'schatten', snd: 'cast' },
  shield: { n: _t('Schutzschild'), d: _t('Ein Schild schluckt viel Schaden. Brich ihn – dann ist der Boss kurz benommen.'), ic: ['fx', 'shield', 2], el: ['licht', 'frost'], r: 0, cd: 22, c: 'frost', snd: 'shield', tip: _t('Tipp: Brich den Schild – dann ist der Boss ein paar Sekunden benommen.') },
  blink: { n: _t('Schattensprung'), d: _t('Der Boss verschwindet und taucht am markierten Ort wieder auf – mit einem Schlag.'), ic: ['fx', 'darkbolt', 2], el: ['schatten'], r: 0, cd: 9, c: 'schatten', snd: 'cast' },
  poison: { n: _t('Giftwolken'), d: _t('Giftblasen platzen und hinterlassen Wolken, die lange brennen.'), ic: ['fx', 'plant', 1], el: ['gift'], r: 0, cd: 12, c: 'gift', snd: 'poison' },
  mark: { n: _t('Blitzschlag'), d: _t('Ein Zeichen folgt dir und bleibt dann stehen – lauf weg, bevor der Blitz einschlägt.'), ic: ['fx', 'bolt', 5], el: ['blitz'], r: 0, cd: 8, c: 'blitz', snd: 'zap', tip: _t('Tipp: Das Zeichen folgt dir – sobald es stehen bleibt, lauf weg!') },
  cone: { n: _t('Atemstoß'), d: _t('Ein Fächer vor dem Boss wird gleich in Feuer, Eis oder Gift getaucht. Geh hinter ihn oder zur Seite.'), ic: ['fx', 'fireball', 2], el: ['feuer', 'gift'], r: 0, cd: 8, c: 'feuer', snd: 'fire' },
  leap: { n: _t('Todessprung'), d: _t('Der Boss springt dorthin, wo du stehst. Der Schatten am Boden zeigt die Landung.'), ic: ['fx', 'ring', 4], el: [], r: 0, cd: 9, c: 'rot', snd: 'lunge' },
  ring: { n: _t('Kugelring'), d: _t('Ein Ring aus Geschossen fliegt nach außen. Stell dich in eine Lücke.'), ic: ['fx', 'sparks', 2], el: ['licht', 'schatten'], r: 0, cd: 7, c: 'el', snd: 'cast' },
  cross: { n: _t('Kreuzschnitt'), d: _t('Leuchtende Linien durch den Boss werden gleich zu Klingen. Weg von den Linien!'), ic: ['fx', 'lightbolt', 2], el: ['licht'], r: 0, cd: 9, c: 'licht', snd: 'swing2' },
  quake: { n: _t('Erdspalten'), d: _t('Der Boden reißt vom Boss in deine Richtung auf. Geh aus der Spur.'), ic: ['fx', 'boom', 8], el: ['blitz', 'feuer'], r: 0, cd: 9, c: 'erde', snd: 'dig' },
  blades: { n: _t('Klingenwirbel'), d: _t('Klingen kreisen um den Boss. Erst sind sie blass – dann schneiden sie.'), ic: ['fx', 'slash', 4], el: [], r: .04, cd: 14, c: 'rot', snd: 'swing2' },
  firewall: { n: _t('Flammenmeer'), d: _t('Ein ganzes Feld fängt Feuer. Verlass die markierte Fläche schnell.'), ic: ['fx', 'fireball', 4], el: ['feuer'], r: .04, cd: 16, c: 'feuer', snd: 'fire' },
  drain: { n: _t('Lebensraub'), d: _t('Im Kreis um den Boss saugt er dir Leben aus und heilt sich. Verlass den Kreis.'), ic: ['fx', 'darkorb', 2], el: ['schatten', 'gift'], r: .06, cd: 13, c: 'blut', snd: 'cast', tip: _t('Tipp: Verlass den roten Kreis, dann reißt der Lebensraub ab.') },
  enrage: { n: _t('Raserei'), d: _t('Unter 30 % Leben wird der Boss schneller und stärker.'), ic: ['fx', 'boom', 5], el: ['feuer'], r: .05, cd: 99, c: 'rot', p: 1 },
  phase: { n: _t('Phasen'), d: _t('Bei 66 % und 33 % Leben stößt der Boss alle zurück und kämpft danach schneller – manchmal mit neuen Kräften.'), ic: ['fx', 'purebolt', 3], el: [], r: .1, cd: 99, c: 'licht', p: 1 },
  homing: { n: _t('Seelenjäger'), d: _t('Langsame Geister verfolgen dich. Weiche aus oder zerschlag sie mit Nahkampfhieben.'), ic: ['fx', 'darkorb', 4], el: ['schatten'], r: .08, cd: 11, c: 'schatten', snd: 'cast' },
  mines: { n: _t('Sprengsaat'), d: _t('Der Boss verstreut Minen. Kommst du zu nah, zünden sie – der rote Kreis zeigt die Explosion.'), ic: ['s', 288, 320, 16, 16], el: ['feuer', 'blitz'], r: .08, cd: 14, c: 'feuer', snd: 'fuse' },
  heal: { n: _t('Regeneration'), d: _t('Der Boss heilt sich. Viel Schaden in kurzer Zeit unterbricht ihn.'), ic: ['fx', 'splash', 2], el: ['licht', 'gift'], r: .1, cd: 26, c: 'gift', snd: 'heal', tip: _t('Tipp: Viel Schaden in kurzer Zeit unterbricht die Heilung.') },
  totem: { n: _t('Heiltotems'), d: _t('Totems heilen den Boss, solange sie stehen. Zerstöre sie zuerst.'), ic: ['fx', 'magicorb', 2], el: ['gift', 'licht'], r: .14, cd: 25, c: 'gift', snd: 'cast', tip: _t('Tipp: Die Totems heilen den Boss – zerstöre sie zuerst!') },
  pull: { n: _t('Sog'), d: _t('Der Boss zieht dich zu sich – in seiner Mitte wartet Schaden. Lauf dagegen an.'), ic: ['fx', 'waterorb', 2], el: ['schatten', 'frost'], r: .15, cd: 15, c: 'schatten', snd: 'cast' },
  spiral: { n: _t('Kugelspirale'), d: _t('Drehende Arme aus Geschossen. Bewege dich mit der Drehung.'), ic: ['fx', 'windbolt', 2], el: ['blitz', 'licht'], r: .18, cd: 12, c: 'el', snd: 'cast' },
  chain: { n: _t('Kettenblitz'), d: _t('Blitze springen zwischen Punkten um dich herum. Stell dich nicht auf eine Linie.'), ic: ['fx', 'bolt', 8], el: ['blitz'], r: .2, cd: 10, c: 'blitz', snd: 'zap' },
  mirror: { n: _t('Spiegelbilder'), d: _t('Trugbilder des Bosses erscheinen. Nur der echte leuchtet und hat den Lebensbalken oben.'), ic: ['fx', 'arcane', 2], el: ['schatten', 'licht'], r: .22, cd: 24, c: 'schatten', snd: 'smoke', tip: _t('Tipp: Nur der echte Boss hat den leuchtenden Rand – die Trugbilder zerfallen schnell.') },
  beam: { n: _t('Todesstrahl'), d: _t('Eine dünne Linie zeigt den Strahl an – dann dreht er sich durch die Arena. Bleib hinter ihm.'), ic: ['fx', 'purebolt', 1], el: ['licht', 'feuer'], r: .25, cd: 14, c: 'licht', snd: 'zapbolt' },
  dark: { n: _t('Finsternis'), d: _t('Alle Lichter erlöschen für ein paar Sekunden. Gefahren leuchten trotzdem.'), ic: ['fx', 'darkorb', 0], el: ['schatten'], r: .35, cd: 30, c: 'schatten', snd: 'smoke' }
};
const BM_KEYS = Object.keys(BMECH);
const BTIP0 = _t('Tipp: Farbige Flächen zeigen, wo gleich Schaden kommt. Raus da, bevor sie aufleuchten!');

/* ---------- Generator: bossDef(id) ---------- */
const BDEF = new Array(BOSS_N); let BNAMES = null;
function bNameOf(R) { const S = BSYL; if (R() < .08) return bPick(S.a, R) + "'" + bPick(S.a, R).toLowerCase() + bPick(S.c, R); return bPick(S.a, R) + (R() < .45 ? bPick(S.b, R) : '') + bPick(S.c, R); }
// Alle Namen auf einmal: so ist jeder einmalig und trotzdem für alle gleich
function bNames() {
  if (BNAMES) return BNAMES;
  const used = new Set(), out = [];
  for (let i = 0; i < BOSS_N; i++) { const R = bRng('n', i); let n = ''; for (let k = 0; k < 60; k++) { n = bNameOf(R); if (!used.has(n.toLowerCase()) && !BBAD.test(n)) break; if (k === 59) n += bPick(BSYL.c, R); } used.add(n.toLowerCase()); out.push(n); }
  return BNAMES = out;
}
function bPickW(keys, w, n, R) {
  const out = [], pool = keys.slice(), ww = pool.map(k => w(k));
  while (out.length < n && pool.length) { let s = 0; for (const x of ww) s += x; let x = R() * s, i = 0; for (; i < pool.length - 1; i++) { x -= ww[i]; if (x <= 0) break; } out.push(pool[i]); pool.splice(i, 1); ww.splice(i, 1); }
  return out;
}
function bossDef(id) {
  id = Math.floor(+id); if (!(id >= 0 && id < BOSS_N)) return null;
  if (BDEF[id]) return BDEF[id];
  const R = bRng('b', id), r = id / (BOSS_N - 1), name = bNames()[id];
  const bodies = BBODY.filter(b => !b.r || r >= b.r), body = bodies[Math.floor(R() * bodies.length)], D = EN[body.t];
  const nat = (typeof EN_EL !== 'undefined' && EN_EL[body.t]) || null, el = nat && R() < .6 ? nat : bPick(ELORDER, R);
  const tint = R() < .06 ? bPick(BTINTX, R) : bPick(BTINT[el], R);
  const sc = +(body.sc * (.92 + R() * .3) * (1 + r * .18)).toFixed(2);
  // Mechaniken: 1 bei Rang 0, 5 ganz oben; passende Elemente häufiger
  const n = clamp(1 + Math.floor(r * 4.3 + R() * .8 - .3), 1, 5);
  const pool = BM_KEYS.filter(k => BMECH[k].r <= r + 1e-9), w = k => (BMECH[k].el.includes(el) ? 3 : 1) * (BMECH[k].p ? .6 : 1);
  let mech = bPickW(pool, w, n, R);
  if (mech.every(k => BMECH[k].p)) mech[0] = bPickW(pool.filter(k => !BMECH[k].p), w, 1, R)[0];
  const res = mech.includes('phase') ? bPickW(pool.filter(k => !mech.includes(k) && !BMECH[k].p), w, r > .5 ? 2 : 1, R) : [];
  // Affixe der Elite-Gegner, ab Rang ~3 %; keine doppelten Kräfte (Schild ↔ gepanzert, Sprung ↔ Teleport)
  const na = r < .03 ? 0 : clamp(Math.floor(r * 3.4 + R() * .6), 0, 3);
  const okA = a => a !== 'heiler' && !(a === 'gepanzert' && mech.includes('shield')) && !(a === 'teleport' && mech.includes('blink'));
  const aff = (D.aff || []).filter(okA), ap = BAFF.filter(a => okA(a) && !aff.includes(a)), na0 = aff.length;   // eigene Affixe der Art bleiben
  while (aff.length < na0 + na && ap.length) aff.push(ap.splice(Math.floor(R() * ap.length), 1)[0]);
  // Name, Titel, Legende
  const role = bPick(BROLE, R), tpl = body.g === 'f' && role[1] ? role[1] : role[0], dom = R() < .7 ? bPick(BDOM[el], R) : bPick(BDOM.all, R);
  const title = bFill(tpl, { d: dom }), full = bFill(BJOIN, { name, title });
  const RL = bRng('l', id); let place = bNameOf(RL); for (let k = 0; k < 9 && BBAD.test(place); k++) place = bNameOf(RL);
  const lv = { name, place, n: 10 + Math.floor(RL() * 990), g: (1000 * (1 + Math.floor(RL() * 99))).toLocaleString(LOCALE) };
  for (const k in BLW) lv[k] = bPick(BLW[k], RL);
  const l1 = Math.floor(RL() * BLORE.length); let lore = bFill(BLORE[l1], lv);
  if (RL() < .35) lore += ' ' + bFill(BLORE[(l1 + 1 + Math.floor(RL() * (BLORE.length - 1))) % BLORE.length], lv);
  // Signatur-Beute für etwa 40 % (und jeden 50. Rang)
  let sig = null;
  if (R() < .4 || id % 50 === 49) { const slot = bPick(['weapon', 'weapon', 'armor', 'helm'], R); sig = { slot, noun: Math.floor(R() * 12), aff: BSIGA[slot === 'weapon' ? 'weapon' : 'armor'][el].slice() }; }
  const hpK = .9 * Math.pow(75, r) * body.h * (.95 + R() * .1), atkK = .62 * Math.pow(6, r) * (.95 + R() * .1), spdK = .95 + r * .35 + R() * .1;
  return BDEF[id] = { id, r, rank: id + 1, band: Math.min(BOSS_BANDS - 1, Math.floor(id / BOSS_BAND_N)), t: body.t, sp: D.sp, g: body.g, el, tint, sc, name, title, full, lore, mech, res, aff, sig, hpK, atkK, spdK };
}
function bossRankName(id) { const B = bossDef(id); return B ? BBAND[B.band] : ''; }

/* ---------- Stärke ---------- */
// Stufe ohne Welt (Kodex-Übung, Tests): wie die Welt in dieser Tiefe, sonst eine eigene Kurve (Rang 0 ≈ 4, Rang 1 ≈ 2000)
function bossStage(r) {
  r = clamp(+r || 0, 0, 1);
  if (typeof worldStage === 'function') { try { const s = Math.round(worldStage(r)); if (s > 0 && Number.isFinite(s)) return s; } catch (_) { } }
  return Math.round(4 + 56 * r + 1950 * r * r * r);
}
function bossPower(B, stage) {
  const S = scaleOf(stage), q = Math.pow(1.3, qualOf(P.act));
  // feste Stärke je Rang und Stufe: die Qual-Verstärkung der Kampagne gilt nicht
  return { hp: Math.max(1, Math.round(650 * B.hpK * S.hm / q)), atk: 22 * B.atkK * S.am / Math.pow(q, .8), xp: Math.round(70 * S.rm * (1 + B.r * 3)), gold: Math.round(45 * S.rm * (1 + B.r * 2)) };
}
const bTw = (B, k) => bLerp(1.25, .62, Math.pow(B.r, .8)) * (k || 1);   // Warnzeit vor dem Schaden
const bMaxAct = r => r < .25 ? 1 : r < .6 ? 2 : 3;                     // Mechaniken gleichzeitig

/* ---------- Spielstand ---------- */
const BTITLE = [[1, _t('Mutiges Herz')], [10, _t('Schrecken der Höhlen')], [25, _t('Geißel der Ungeheuer')], [50, _t('Hammer der Bosse')], [100, _t('Legende der Lande')], [200, _t('Albtraum der Tyrannen')], [300, _t('Stern der Jagd')], [500, _t('Erbe des Ordens')], [750, _t('Sturm der Tausend')], [1000, _t('Unsterbliche Legende')], [1200, _t('Ende aller Bosse')]];
const BBONUS = [['dmg', .01], ['hp', .01], ['gold', .02], ['loot', .01]], BTIER_MAX = BOSS_N / 25;
function bM() { return SAVE && SAVE.meta ? SAVE.meta.bosses : null; }
const bObj = v => v && typeof v === 'object' && !Array.isArray(v) ? v : {};
function bMetaFix(d) {
  d = bObj(d); const b = {}, src = bObj(d.b), now = Date.now();
  for (const k of Object.keys(src)) {
    const id = +k; if (!Number.isInteger(id) || id < 0 || id >= BOSS_N || String(id) !== k) continue;
    const a = Array.isArray(src[k]) ? src[k] : [], t = Math.max(0, Math.floor(+a[0]) || 0), n = clamp(Math.floor(+a[1]) || 0, 0, 1e6);
    const ok = v => v != null && v !== '' && Number.isFinite(+v), rec = [t, t && !n ? 1 : n];
    if (ok(a[2]) && ok(a[3])) rec.push(Math.round(+a[2]), Math.round(+a[3]));
    b[id] = rec;
  }
  const ls = bObj(d.l), ent = Object.keys(ls).filter(k => k.length <= 80 && k !== '__proto__').map(k => [k, +ls[k]]).filter(([, t]) => Number.isFinite(t) && t > 0 && now - t < BOSS_RESPAWN && t < now + 864e5).sort((x, y) => y[1] - x[1]).slice(0, 400), l = {};
  for (const [k, t] of ent) l[k] = t;
  const tt = Number.isInteger(d.tt) && d.tt >= -1 && d.tt < BTITLE.length ? d.tt : -1;
  return { v: 1, b, l, tt, h: Math.max(0, Math.floor(+d.h) || 0) % 2147483648 };
}
HOOK.meta.push(m => { BTROPH = -1; try { m.bosses = bMetaFix(m.bosses); } catch (e) { console.error('Bosse (meta):', e); m.bosses = bMetaFix(null); } });
let BTROPH = -1;
function bossTrophies() { const M = bM(); if (!M) return 0; if (BTROPH < 0) { let n = 0; for (const k in M.b) if (M.b[k][0] > 0) n++; BTROPH = n; } return BTROPH; }
function bTiers(n) { return Math.min(BTIER_MAX, Math.floor(n / 25)); }
function bBonus(n) { const t = bTiers(n), r = { dmg: 0, hp: 0, gold: 0, loot: 0 }; for (let i = 0; i < t; i++) { const [k, v] = BBONUS[i % 4]; r[k] += v; } return r; }
function bTitleNow() { const M = bM(), n = bossTrophies(); if (!M || M.tt < 0 || !BTITLE[M.tt] || BTITLE[M.tt][0] > n) return ''; return BTITLE[M.tt][1]; }
function bSeen(id, ctx) {
  const M = bM(); if (!M || id == null) return;
  const r = M.b[id] || (M.b[id] = [0, 0]);
  if (ctx && r.length < 4 && Number.isFinite(+ctx.cx) && Number.isFinite(+ctx.cy)) r.push(Math.round(+ctx.cx), Math.round(+ctx.cy));
}
function bPruneLairs(M) { const now = Date.now(), ks = Object.keys(M.l); for (const k of ks) if (!(now - M.l[k] < BOSS_RESPAWN)) delete M.l[k]; if (ks.length > 400) Object.keys(M.l).sort((a, b) => M.l[a] - M.l[b]).slice(0, Object.keys(M.l).length - 400).forEach(k => delete M.l[k]); }
// Kontobonus der Trophäen (alle Helden): Schaden, LP, Gold, Beute im Wechsel, höchstens 48 Stufen
HOOK.stats.push(bSafe('stats', add => { const n = bossTrophies(); if (!n) return; const b = bBonus(n); for (const k in b) if (b[k]) add(k, b[k]); }));

/* ---------- Schnittstelle zur Welt ---------- */
// Boss einer Höhle: Rang-Fenster um die Tiefe, für alle Spieler gleich
function bossForLair(lairKey, ctx) {
  const d = clamp(+(ctx && ctx.depth) || 0, 0, 1), c = d * (BOSS_N - 1), w = 6 + BOSS_N * .02, h = bHash('lair', lairKey) / 4294967296;
  return clamp(Math.round(c + (h * 2 - 1) * w), 0, BOSS_N - 1);
}
function bossLairLeft(lairKey) { const M = bM(); if (!M) return 0; const t = M.l[String(lairKey)]; return t ? Math.max(0, t + BOSS_RESPAWN - Date.now()) : 0; }
function bossLairReady(lairKey) { return bossLairLeft(lairKey) <= 0; }
// o: { ctx (Weltstelle: Stufe, Tiefe, cx, cy), lair (Schlüssel der Höhle), stage, instant, quiet, practice }
function bossSpawn(id, x, y, o) {
  o = o || {}; const B = bossDef(id); if (!B || !P || !G) return null;
  const ctx = o.ctx || null, stage = Math.max(1, Math.round(+o.stage || (ctx && +ctx.stage) || bossStage(B.r)));
  if (x == null || y == null) { x = AW / 2; y = BD.y0 + 40; }
  const e = spawnEnemy(B.t, { x, y, boss: true, sc: B.sc, name: B.name, tint: B.tint, instant: !!o.instant, bossId: B.id, bStage: stage, bLair: o.lair != null ? String(o.lair) : null, bCtx: ctx, bPractice: !!o.practice });
  if (!e.bz) return e;
  if (!o.practice) { bSeen(B.id, ctx); persist(); }
  if (!o.quiet) {
    $('bossName').textContent = B.name.toLocaleUpperCase(LOCALE); $('bossbar').hidden = false; BBAR.k = '';
    banner(B.name.toLocaleUpperCase(LOCALE), B.title + ' · ' + _t('Rang {n}', { n: B.rank })); shake(6); sfx('boom');
  }
  return e;
}
// Verschiebt alles Laufende, wenn die Welt ihren Ursprung versetzt (HOOK.shift oder direkt)
function bossShift(dx, dy) {
  for (const z of BZ.fx) for (const [a, b] of [['x', 'y'], ['x0', 'y0'], ['x1', 'y1'], ['sx', 'sy']]) if (z[a] != null) { z[a] += dx; z[b] += dy; }
  for (const e of enemies) { const Z = e.bz; if (!Z) continue; if (Z.leap) { Z.leap.sx += dx; Z.leap.sy += dy; Z.leap.tx += dx; Z.leap.ty += dy; } }
}
HOOK.shift = HOOK.shift || []; HOOK.shift.push(bossShift);

/* ---------- Boss im Kampf ---------- */
HOOK.spawn.push(bSafe('spawn', (e, o) => {
  if (o && o.bossId != null) bSetup(e, o);
  if (BA && BA.practice && G && G.type === 'bossarena') { e.xp = 0; e.gold = 0; }
}));
function bSetup(e, o) {
  const B = bossDef(o.bossId); if (!B) return;
  const W = bossPower(B, o.bStage);
  e.bossId = B.id; e.bDef = B; e.bStage = o.bStage; e.bLair = o.bLair || null; e.bCtx = o.bCtx || null; e.bPractice = !!o.bPractice; e.el = B.el;
  e.elite = false; e.affixes = B.aff.slice(); e.spd = EN[B.t].spd * B.spdK; e.cdMul = bLerp(1.3, .72, B.r); e.mass = 9;
  if (e.affixes.includes('schnell')) { e.spd *= 1.35; e.cdMul *= .8; }
  e.hp = e.maxHp = W.hp; e.atk = W.atk; e.xp = e.bPractice ? 0 : W.xp; e.gold = e.bPractice ? 0 : W.gold;
  e.armor = e.armorMax = 0; if (e.affixes.includes('gepanzert')) e.armor = e.armorMax = Math.round(W.hp * .35);
  e.bz = { m: B.mech.filter(k => !BMECH[k].p).map(k => ({ k, cd: BMECH[k].cd * (.15 + Math.random() * .35) })), gcd: 2.6, hold: 0, inv: 0, ph: 0, enr: false, cdm: 1, t: 0, busy: [], shield: null, heal: null, leap: null, dash: null };
}
HOOK.enemyUpd.push(bSafe('tick', (e, dt) => { if (e.bz) bTick(e, dt); else if (e.bOwn) bOwnTick(e, dt); }));
function bTick(e, dt) {
  const Z = e.bz, B = e.bDef; Z.t += dt;
  if (Z.inv > 0) { Z.inv -= dt; e.fade = 1; e.alpha = Z.blink ? .1 : .45; if (Z.inv <= 0) { e.fade = 0; e.alpha = e.ai === 'ghost' ? .6 : null; Z.blink = 0; } }
  if (Z.leap) bLeapTick(e, Z, dt);
  if (Z.dash) bDashTick(e, Z, dt);
  if (Z.heal) bHealTick(e, Z, dt);
  if (Z.hold > 0) { Z.hold -= dt; e.stun = Math.max(e.stun, dt + .01); if (e.st === 'wind' || e.st === 'act') { e.st = 'move'; e.cd = Math.max(e.cd, .5); } }
  if (Z.shield) {
    Z.shield.t -= dt;
    if (e.armor <= 0) { Z.shield = null; Z.hold = Math.max(Z.hold, 1.8); bCall(_t('Schild gebrochen!'), '#8ad8ff'); burst(e.x, e.y, 14 * e.sc, '#bfefff', 24, 90, 1); sfx('crit'); shake(4); }
    else if (Z.shield.t <= 0) { e.armor = 0; Z.shield = null; }
  }
  const f = e.hp / e.maxHp;
  if (B.mech.includes('phase') && Z.ph < 2 && f < (Z.ph ? .33 : .66)) bPhase(e, Z, B);
  if (B.mech.includes('enrage') && !Z.enr && f < .3) bEnrage(e, Z);
  if (Z.gcd > 0) Z.gcd -= dt;
  for (const m of Z.m) if (m.cd > 0) m.cd -= dt;
  if (state !== 'play' || Z.gcd > 0 || Z.inv > 0 || Z.leap || Z.dash || Z.heal || Z.hold > 0 || e.under > 0) return;
  const d = Math.hypot(P.x - e.x, P.y - e.y); if (d > 300) return;
  Z.busy = Z.busy.filter(t => t > Z.t); if (Z.busy.length >= bMaxAct(B.r)) return;
  const ready = Z.m.filter(m => m.cd <= 0 && bCan(e, m.k, d)); if (!ready.length) return;
  bCast(e, ready[Math.floor(Math.random() * ready.length)]);
}
function bCast(e, m) {
  const Z = e.bz, B = e.bDef, M = BMECH[m.k];
  const dur = BCAST[m.k](e, Z, B) || 1;
  m.cd = M.cd * bLerp(1.25, .6, B.r) * Z.cdm; Z.gcd = bLerp(3.4, 1.1, B.r) * Z.cdm; Z.busy.push(Z.t + dur);
  bCall(M.n, bCol(M.c === 'el' ? e.el : M.c)[3]);
  if (M.snd) sfx(M.snd);
  bTip(m.k);
  return dur;
}
// Zum Testen und für Skripte: eine Mechanik sofort auslösen
function bossCast(e, k) { if (!e || !e.bz || !BMECH[k] || BMECH[k].p) return 0; let m = e.bz.m.find(x => x.k === k); if (!m) { m = { k, cd: 0 }; e.bz.m.push(m); } return bCast(e, m); }
function bCan(e, k, d) {
  const Z = e.bz;
  switch (k) {
    case 'summon': return enemies.length < 22 && bOwned(e, x => !x.bTotem && !x.bMirror) < 4 + Math.floor(e.bDef.r * 4);
    case 'totem': return bOwned(e, x => x.bTotem) < 3 && enemies.length < 24;
    case 'mirror': return !bOwned(e, x => x.bMirror) && enemies.length < 22;
    case 'shield': return !Z.shield && !e.armorMax;
    case 'heal': return e.hp < e.maxHp * .85;
    case 'drain': case 'pull': return d < 150;
    case 'charge': return d > 40;
    case 'dark': return !BZ.dark && !!G;
    case 'nova': return d < 140;
  }
  return true;
}
function bOwned(o, f) { let n = 0; for (const x of enemies) if (!x.dead && x.bOwn === o && f(x)) n++; return n; }
function bPhase(e, Z, B) {
  Z.ph++; Z.inv = 2; Z.hold = 2; Z.cdm *= .82; Z.gcd = 2.2;
  const R = 58 + e.r * e.sc;
  bzAdd({ k: 'c', x: e.x, y: e.y, r: R, t: 1.25, dmg: e.atk * .6, c: 'licht', o: e, vis: 'nova', push: 1 });
  banner(_t('PHASE {n}', { n: Z.ph + 1 }), e.name); sfx('spec'); shake(5); flash = { a: .25, c: '255,240,200' };
  const k = B.res[Z.ph - 1]; if (k && !Z.m.some(m => m.k === k)) { Z.m.push({ k, cd: 1.2 }); setTimeout(() => { if (!e.dead && G) bCall(_t('Neu: {m}', { m: BMECH[k].n }), '#ffd24a'); }, 1300); }
}
function bEnrage(e, Z) {
  Z.enr = true; Z.hold = Math.max(Z.hold, 1); e.spd *= 1.3; e.atk *= 1.25; e.cdMul *= .75; Z.cdm *= .8;
  bCall(_t('Raserei!'), '#ff4a3a'); sfx('spec'); shake(5); flash = { a: .2, c: '255,60,40' };
  burst(e.x, e.y, 12 * e.sc, '#ff4a3a', 26, 90, 1);
}
function bLeapTick(e, Z, dt) {
  const L = Z.leap; L.t += dt; e.stun = Math.max(e.stun, dt + .01);
  if (L.t < 0) { e.squash = .2; return; }
  const p = Math.min(1, L.t / L.T); e.x = lerp(L.sx, L.tx, p); e.y = lerp(L.sy, L.ty, p); e.z = Math.sin(p * Math.PI) * 46;
  if (p >= 1) { e.z = 0; Z.leap = null; e.squash = -.2; if (e.bDef.r > .3) { const n = 6 + Math.floor(e.bDef.r * 6); for (let i = 0; i < n; i++) { const a = i / n * 6.283; projs.push({ k: 'rock', x: e.x, y: e.y, h: 4, vx: Math.cos(a) * 100, vy: Math.sin(a) * 100, life: 1.3, max: 1.3, dmg: e.atk * .5, from: 'e', r: 4, src: e }); } } }
}
function bDashTick(e, Z, dt) {
  const D = Z.dash; D.t -= dt; e.stun = Math.max(e.stun, dt + .01);
  const R = e.r * e.sc; e.x += D.dx * D.sp * dt; e.y += D.dy * D.sp * dt; e.face = D.dx >= 0 ? 1 : -1; e.moving = true;
  if (Math.random() < .7) dust(e.x, e.y, 2);
  if (!D.hit && Math.hypot(P.x - e.x, P.y - e.y) < R + P.r + 4) { D.hit = true; hurtPlayer(e.atk * 1.3, e); }
  const wall = e.x < BD.x0 + R || e.x > BD.x1 - R || e.y < BD.y0 || e.y > BD.y1;
  if (D.t <= 0 || wall) { e.x = clamp(e.x, BD.x0 + R, BD.x1 - R); e.y = clamp(e.y, BD.y0, BD.y1); Z.dash = null; Z.hold = .5; shake(wall ? 5 : 2); if (wall) sfx('boom'); if (D.again) bCharge(e, Z, e.bDef, .75); }
}
function bHealTick(e, Z, dt) {
  const H = Z.heal; H.t -= dt; e.stun = Math.max(e.stun, dt + .01);
  if (e.hp < H.last) H.dmg += H.last - e.hp;
  if (H.dmg >= H.need) { Z.heal = null; Z.hold = 1.4; bCall(_t('Unterbrochen!'), '#ffd24a'); sfx('crit'); return; }
  const h = e.maxHp * .025 * dt; e.hp = Math.min(e.maxHp, e.hp + h); H.last = e.hp; H.acc += h;
  if (H.acc > e.maxHp * .02) { txt(e.x, e.y - 18 * e.sc, '+' + fmt(H.acc), '#79e04a'); H.acc = 0; }
  if (Math.random() < .5) part(e.x + rnd(-10, 10) * e.sc, e.y, rnd(2, 14) * e.sc, 0, 0, rnd(25, 45), pick(['#79e04a', '#c8f06a', '#ffffff']), rnd(.5, .9), 1, -10, 1);
  if (H.t <= 0) Z.heal = null;
}
// Totems und Trugbilder: stehen still bzw. vergehen, verschwinden mit ihrem Boss
function bOwnTick(e, dt) {
  const o = e.bOwn;
  if (!o || o.dead) { e.dead = true; burst(e.x, e.y, 8, '#b892f4', 12, 50, 1); return; }
  if (e.bTotem) {
    e.stun = Math.max(e.stun, dt + .01); e.alpha = .001; e.kbx = e.kby = 0;
    e.bT = (e.bT || 0) - dt;
    if (e.bT <= 0) { e.bT = 1; const h = o.maxHp * .008; if (o.hp < o.maxHp) { o.hp = Math.min(o.maxHp, o.hp + h); fx.push({ k: 'zap', pts: [[e.x, e.y - 20], [o.x, o.y - 10 * o.sc]], life: .25, max: .25 }); txt(o.x, o.y - 16 * o.sc, '+' + fmt(h), '#79e04a'); } }
  }
  if (e.bMirror) { e.bLife -= dt; if (e.bLife <= 0) { e.dead = true; burst(e.x, e.y, 10 * e.sc, '#6a5a8a', 16, 60, 1); } }
}

/* ---------- Mechaniken auslösen (Rückgabe: wie lange sie läuft) ---------- */
function bClampX(x) { return clamp(x, BD.x0 + 12, BD.x1 - 12); }
function bClampY(y) { return clamp(y, BD.y0 + 8, BD.y1 - 6); }
function bNear(x, y, d0, d1) { const a = rnd(0, 6.283), d = rnd(d0, d1); return [bClampX(x + Math.cos(a) * d), bClampY(y + Math.sin(a) * d * .7)]; }
function bOrb(e, a, sp, k) { projs.push({ k: 'orb', fxn: BORB[e.el] || 'darkorb', x: e.x + Math.cos(a) * 10, y: e.y + Math.sin(a) * 6, h: 10 + 5 * e.sc, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 3.6, max: 3.6, dmg: e.atk * (k || .75), from: 'e', r: 4, src: e, slow: e.el === 'frost' }); }
function bCharge(e, Z, B, k) {
  const a = Math.atan2(P.y - e.y, P.x - e.x), len = clamp(Math.hypot(P.x - e.x, P.y - e.y) + 70, 120, 270), w = e.r * e.sc * 2 + 8, tw = bTw(B, k || 1), sp = 360 + B.r * 170;
  Z.hold = tw + .1;
  bzAdd({ k: 'l', x: e.x, y: e.y, a, l0: 0, len, w, t: tw, dmg: 0, c: 'rot', o: e, fn: () => { if (!e.dead) Z.dash = { dx: Math.cos(a), dy: Math.sin(a), t: len / sp, sp, hit: false, again: !k && B.r > .6 }; } });
  return tw + len / sp;
}
const BCAST = {
  nova(e, Z, B) { const tw = bTw(B, 1.05), R = 44 + e.r * e.sc * 1.3 + B.r * 22; Z.hold = tw + .25; bzAdd({ k: 'c', x: e.x, y: e.y, r: R, t: tw, dmg: e.atk, c: 'frost', o: e, vis: 'nova', slow: 2.2 }); return tw + .3; },
  meteor(e, Z, B) { const tw = bTw(B, 1.15), n = 3 + Math.floor(B.r * 6), r = 22 + B.r * 8; for (let i = 0; i < n; i++) { const [x, y] = i ? bNear(P.x, P.y, 20, 95) : [P.x, P.y]; bzAdd({ k: 'c', x, y, r, t: tw + i * .22, dmg: e.atk * 1.1, c: 'feuer', o: e, vis: 'meteor' }); } return tw + n * .22; },
  wave(e, Z, B) {
    const tw = bTw(B, .85), n = 1 + Math.floor(B.r * 2.6), sp = 115 + B.r * 70, max = 190, x = e.x, y = e.y;
    Z.hold = tw + .35; bzAdd({ k: 'c', x, y, r: max, t: tw, dmg: 0, c: 'erde', o: e, pre: 1, fn: () => { if (e.dead) return; shake(6); sfx('boom'); dust(x, y, 14); for (let i = 0; i < n; i++) bzAdd({ k: 'z', t: i * .45, o: e, fn: () => bzAdd({ k: 'w', x, y, r: e.r * e.sc, sp, max, band: 8, dmg: e.atk * .85, c: 'erde', o: e }) }); } });
    return tw + n * .45 + max / sp;
  },
  charge(e, Z, B) { return bCharge(e, Z, B); },
  summon(e, Z, B) { const n = 2 + Math.floor(B.r * 3), L = BMIN[e.el] || BMIN.schatten; for (let i = 0; i < n; i++) { const [x, y] = bNear(e.x, e.y, 34, 70); bzAdd({ k: 'o', x, y, t: 1, o: e, what: 'min', type: L[i % L.length] }); } return 1.4; },
  shield(e, Z, B) { Z.hold = .7; bzAdd({ k: 'z', t: .6, o: e, fn: () => { e.armor = Math.round(e.maxHp * bLerp(.12, .28, B.r)); Z.shield = { t: 12, max: e.armor }; rings.push({ x: e.x, y: e.y, r: 4, max: 40 * e.sc, life: .4, max2: .4, col: '#bfefff' }); } }); return 2; },
  blink(e, Z, B) {
    const tw = bTw(B, .95), a = rnd(0, 6.283), d = rnd(24, 40), tx = bClampX(P.x + Math.cos(a) * d), ty = bClampY(P.y + Math.sin(a) * d * .7);
    Z.inv = tw + .4; Z.blink = 1; Z.hold = tw + .4; burst(e.x, e.y, 10 * e.sc, '#6a48c0', 18, 70, 1);
    bzAdd({ k: 'c', x: tx, y: ty, r: 30 + B.r * 10, t: tw, dmg: e.atk * 1.1, c: 'schatten', o: e, vis: 'boom', fn: z => { if (e.dead) return; e.x = z.x; e.y = z.y; Z.inv = .05; burst(e.x, e.y, 10 * e.sc, '#b892f4', 18, 70, 1); } });
    return tw + .5;
  },
  poison(e, Z, B) { const tw = bTw(B, 1.1), n = 3 + Math.floor(B.r * 4), r = 20 + B.r * 6; for (let i = 0; i < n; i++) { const [x, y] = i ? bNear(P.x, P.y, 26, 90) : [P.x, P.y]; bzAdd({ k: 'c', x, y, r, t: tw + i * .15, dmg: e.atk * .35, c: 'gift', o: e, vis: 'gift', fn: z => hazards.push({ k: 'gift', x: z.x, y: z.y, r: z.r * .85, life: 5.5, max: 5.5, dmg: e.atk * .22, tick: .3 }) }); } return tw + 1; },
  mark(e, Z, B) { const tw = bTw(B, 1.15), n = 1 + Math.floor(B.r * 2.6), step = tw + .45 + .3, r = 22 + B.r * 6; for (let i = 0; i < n; i++) bzAdd({ k: 'z', t: i * step, o: e, fn: () => bzAdd({ k: 'c', x: P.x, y: P.y, r, fol: tw, t: .45, dmg: e.atk * 1.35, c: 'blitz', o: e, vis: 'bolt' }) }); return n * step; },
  cone(e, Z, B) { const tw = bTw(B, 1.1), a = Math.atan2(P.y - e.y, P.x - e.x), R = 110 + B.r * 40 + e.r * e.sc; Z.hold = tw + .3; bzAdd({ k: 'v', x: e.x, y: e.y, a, arc: 1.15, r: R, t: tw, dmg: e.atk * 1.2, c: e.el === 'frost' || e.el === 'gift' ? e.el : 'feuer', o: e }); return tw + .3; },
  leap(e, Z, B) { const tw = bTw(B, 1.05), tx = bClampX(P.x), ty = bClampY(P.y); Z.leap = { sx: e.x, sy: e.y, tx, ty, t: -.3, T: tw }; bzAdd({ k: 'c', x: tx, y: ty, r: 30 + e.r * e.sc * .5 + B.r * 8, t: .3 + tw, dmg: e.atk * 1.3, c: 'rot', o: e, vis: 'land' }); return tw + .5; },
  ring(e, Z, B) {
    const tw = bTw(B, .75), n = 10 + Math.floor(B.r * 14), a0 = rnd(0, 6.283), sp = 72 + B.r * 55;
    Z.hold = tw + .1; bzAdd({ k: 'r', o: e, n, a0, t: tw, fn: () => { if (e.dead) return; for (let i = 0; i < n; i++) bOrb(e, a0 + i / n * 6.283, sp); } });
    if (B.r > .45) bzAdd({ k: 'r', o: e, n, a0: a0 + Math.PI / n, t: tw + .5, fn: () => { if (e.dead) return; for (let i = 0; i < n; i++) bOrb(e, a0 + (i + .5) / n * 6.283, sp); } });
    return tw + .7;
  },
  cross(e, Z, B) {
    const tw = bTw(B, 1.1), w = 14 + B.r * 6, a0 = Math.random() < .5 ? 0 : Math.PI / 4, x = e.x, y = e.y;
    Z.hold = tw + .2; for (const a of [a0, a0 + Math.PI / 2]) bzAdd({ k: 'l', x, y, a, l0: -300, len: 300, w, t: tw, dmg: e.atk * 1.1, c: 'licht', o: e, vis: 'slash' });
    if (B.r > .5) { for (const a of [a0 + Math.PI / 4, a0 + Math.PI * .75]) bzAdd({ k: 'l', x, y, a, l0: -300, len: 300, w, t: tw + .65, dmg: e.atk * 1.1, c: 'licht', o: e, vis: 'slash' }); Z.hold += .65; }
    return tw + .8;
  },
  quake(e, Z, B) { const tw = bTw(B, 1.05), n = 1 + Math.floor(B.r * 2.2), a = Math.atan2(P.y - e.y, P.x - e.x); Z.hold = tw + .3; for (let k = 0; k < n; k++) bzAdd({ k: 'l', x: e.x, y: e.y, a: a + (k - (n - 1) / 2) * .4, l0: 0, len: 280, w: 16, t: tw, dmg: e.atk * 1.15, c: 'erde', o: e, travel: 300, front: 0 }); return tw + 1; },
  blades(e, Z, B) { const n = 2 + Math.floor(B.r * 3.2), life = 4.5 + B.r * 1.5; bzAdd({ k: 's', o: e, n, a: rnd(0, 6.283), va: (1.5 + B.r * 1.4) * (Math.random() < .5 ? -1 : 1), rad: e.r * e.sc + 24 + B.r * 16, warm: .9, life, dmg: e.atk * .7, c: 'rot' }); return life + .9; },
  firewall(e, Z, B) { const tw = bTw(B, 1.5), w = 220, h = 150, cx = clamp(P.x, BD.x0 + w / 2, BD.x1 - w / 2), cy = clamp(P.y, BD.y0 + h / 2, BD.y1 - h / 2); bzAdd({ k: 'q', x: cx, y: cy, x0: cx - w / 2, y0: cy - h / 2, x1: cx + w / 2, y1: cy + h / 2, t: tw, dmg: e.atk * .5, c: 'feuer', o: e, burn: 3, tick: 0 }); return tw + 3; },
  drain(e, Z, B) { const tw = bTw(B, .85); bzAdd({ k: 'd', o: e, R: 100 + B.r * 20, warm: tw, W: tw, life: 3.2, tick: 0, dmg: e.atk * .22, c: 'blut' }); return tw + 3.2; },
  homing(e, Z, B) { const n = 2 + Math.floor(B.r * 3); for (let i = 0; i < n; i++) { const a = i / n * 6.283; bzAdd({ k: 'h', x: e.x + Math.cos(a) * 22, y: e.y + Math.sin(a) * 14, t: .7, T: .7, dmg: e.atk * .85, o: e, home: 1.5 + B.r * 1.2, sp: 58 + B.r * 35 }); } return 1.6; },
  mines(e, Z, B) { const n = 3 + Math.floor(B.r * 3); for (let i = 0; i < n; i++) { const [x, y] = bNear(e.x, e.y, 45, 150); bzAdd({ k: 'm', sx: e.x, sy: e.y, x, y, fly: .55, F: .55, arm: .9, life: 9, fuse: -1, r: 30, dmg: e.atk, c: 'feuer', o: e }); } return 2; },
  heal(e, Z, B) { Z.heal = { t: 3, dmg: 0, need: e.maxHp * .05, last: e.hp, acc: 0 }; return 3; },
  totem(e, Z, B) { const n = 2 + Math.floor(B.r * 2); for (let i = 0; i < n; i++) { const [x, y] = bNear(e.x, e.y, 70, 115); bzAdd({ k: 'o', x, y, t: .9, o: e, what: 'totem' }); } return 1.2; },
  pull(e, Z, B) { const warm = .8, life = 2.6 + B.r; Z.hold = warm + life; bzAdd({ k: 'p', o: e, R: 30 + e.r * e.sc * .6, warm, W: warm, life, str: 45 + B.r * 45, tick: 0, dmg: e.atk * .5, c: 'schatten' }); return warm + life; },
  spiral(e, Z, B) {
    const tw = bTw(B, .75), arms = 2 + Math.floor(B.r * 2.5), dur = 2.2 + B.r * .8, a0 = rnd(0, 6.283), va = 1.9 * (Math.random() < .5 ? -1 : 1);
    Z.hold = tw + dur; bzAdd({ k: 'r', o: e, n: arms, a0, t: tw, fn: () => { if (!e.dead) bzAdd({ k: 'e', o: e, n: arms, a: a0, va, every: .13 - B.r * .03, life: dur, acc: 0, sp: 75 + B.r * 35 }); } });
    return tw + dur;
  },
  chain(e, Z, B) {
    const tw = bTw(B, 1.15), n = 3 + Math.floor(B.r * 2), a0 = rnd(0, 6.283), pts = [[e.x, e.y]];
    for (let i = 0; i < n; i++) { const a = a0 + i * 2.4, d = 38 + (i % 2) * 34; pts.push([bClampX(P.x + Math.cos(a) * d), bClampY(P.y + Math.sin(a) * d * .7)]); }
    for (let i = 0; i < pts.length - 1; i++) { const [x0, y0] = pts[i], [x1, y1] = pts[i + 1]; bzAdd({ k: 'l', x: x0, y: y0, a: Math.atan2(y1 - y0, x1 - x0), l0: 0, len: Math.hypot(x1 - x0, y1 - y0), w: 12, t: tw + i * .08, dmg: e.atk * .95, c: 'blitz', o: e, vis: 'zap' }); }
    return tw + .6;
  },
  mirror(e, Z, B) {
    const n = 2 + Math.floor(B.r * 2.5), spots = [[e.x, e.y]];
    for (let i = 0; i < n; i++) spots.push(bNear(e.x, e.y, 46, 80));
    for (const [x, y] of spots) bzAdd({ k: 'o', x, y, t: .6, o: e, what: 'puff' });
    Z.hold = .7; bzAdd({ k: 'z', t: .6, o: e, fn: () => { if (e.dead) return; const s = spots.splice(Math.floor(Math.random() * spots.length), 1)[0]; e.x = s[0]; e.y = s[1]; for (const [x, y] of spots) bMirror(e, x, y); } });
    return 1.2;
  },
  beam(e, Z, B) { const tw = bTw(B, 1.1), life = 2.4 + B.r; Z.hold = tw + life; bzAdd({ k: 'b', o: e, a: Math.atan2(P.y - e.y, P.x - e.x), va: (.55 + B.r * .5) * (Math.random() < .5 ? -1 : 1), len: 250, w: 8 + B.r * 4, warm: tw, W: tw, life, tick: 0, dmg: e.atk * .55, c: 'licht' }); return tw + life; },
  dark(e, Z, B) { BZ.dark = { t: 5 + B.r * 2, prev: G.dark || 0, o: e }; return 1.5; }
};
function bMirror(o, x, y) {
  const B = o.bDef, c = spawnEnemy(B.t, { x, y, instant: true, sc: B.sc * .92, name: o.name, tint: o.tint });
  c.def = Object.assign({}, EN[B.t], { drop: {}, split: false, boomDeath: 0, summon: null, glow: null });
  c.hp = c.maxHp = Math.max(1, Math.round(o.maxHp * bLerp(.03, .006, B.r))); c.atk = o.atk * .35; c.xp = 0; c.gold = 0; c.affixes = []; c.armor = c.armorMax = 0;
  c.bOwn = o; c.bMirror = 1; c.bLife = 12 + B.r * 6; c.el = o.el; c.spd = o.spd; c.elite = false;
  return c;
}
function bTotem(o, x, y) {
  const t = spawnEnemy('btotem', { x, y, instant: true });
  t.hp = t.maxHp = Math.max(1, Math.round(o.maxHp * bLerp(.06, .012, o.bDef.r))); t.atk = 0; t.xp = 0; t.gold = 0; t.bOwn = o; t.bTotem = 1; t.el = null; t.alpha = .001; t.mass = 99; t.affixes = []; t.bC = bCol(o.el);
  return t;
}
function bMinion(o, type, x, y) {
  if (!EN[type]) return null;
  const m = spawnEnemy(type, { x, y }), A = scaleOf(stageNum()), S = scaleOf(o.bStage), kh = S.hm / A.hm, ka = S.am / A.am;   // Stufe des Bosses
  m.hp = m.maxHp = Math.max(1, Math.round(m.maxHp * kh)); m.atk *= ka; if (m.armorMax) { m.armorMax *= kh; m.armor = m.armorMax; }
  m.bOwn = o; m.xp = Math.round(m.xp * .5); m.gold = Math.round(m.gold * .5);
  return m;
}

/* ---------- Warnflächen & Effekte ---------- */
// k: c Kreis (fol = folgt dem Helden) · l Linie (travel = Spalte läuft) · v Fächer · q Fläche (burn) · w Welle · b Strahl · s Klingen · d Lebensraub
//    p Sog · m Mine · o Portal (Diener, Totem, Rauch) · h Seelenjäger · r Strahlen-Vorschau · e Spiralen-Werfer · z Verzögerung
const BZ = { fx: [], g: null, dark: null, call: null };
// Ansage der Mechanik: groß unter der Bossleiste, nie vom HUD verdeckt
function bCall(s, col) { BZ.call = { s: String(s).toLocaleUpperCase(LOCALE), col: col || '#ffd24a', t: 1.7 }; }
function bzAdd(z) { if (z.t != null && z.T == null) z.T = z.t; BZ.fx.push(z); return z; }
function bzHurt(z, k, x, y) { if (state !== 'play' || !(z.dmg > 0)) return; const o = z.o; hurtPlayer(z.dmg * (k || 1), { x: x != null ? x : z.x != null ? z.x : o.x, y: y != null ? y : z.y != null ? z.y : o.y, src: o }); }
// Treffer-Prüfung wie gezeichnet: Kreise am Boden sind flache Ellipsen (Höhe halb so groß)
function bIn(x, y, cx, cy, r) { const dx = x - cx, dy = (y - cy) * 2, R = r + P.r; return dx * dx + dy * dy < R * R; }
function bSegD(px, py, x, y, a, l0, l1) { const c = Math.cos(a), s = Math.sin(a), dx = px - x, dy = py - y, u = dx * c + dy * s, t = clamp(u, l0, l1); return [Math.hypot(dx - c * t, dy - s * t), u]; }
function bOnLine(z) { const [d, u] = bSegD(P.x, P.y, z.x, z.y, z.a, z.l0, z.len); return d < z.w / 2 + P.r && u >= z.l0 - P.r && u <= z.len + P.r; }
function bzBoom(x, y, r, c) {
  const C = bCol(c); fxAnim('boom', x, y - Math.min(r, 30) * .3, { sc: Math.min(1.8, r / 18), dur: .5 }); rings.push({ x, y, r: 4, max: r * 1.15, life: .35, max2: .35, col: C[3] });
  for (let i = 0; i < 12; i++) { const a = rnd(0, 6.28), v = rnd(30, 110); part(x, y, rnd(2, 8), Math.cos(a) * v, Math.sin(a) * v * .5, rnd(40, 100), C[1 + (i % 3)], rnd(.3, .6), i % 3 ? 1 : 2, 160, 1); }
  scorch(x, y, r * .7); shake(3); sfx('boom');
}
function bzZap(x, y) { fx.push({ k: 'zap', pts: [[x + rnd(-6, 6), y - 150], [x + rnd(-12, 12), y - 75], [x, y]], life: .3, max: .3 }); fxAnim('bolt', x, y - 18, { dur: .4, add: true }); flash = { a: .15, c: '200,220,255' }; shake(3); sfx('zap'); }
function bzFrost(x, y, r) { fxAnim('ring', x, y - 4, { sc: r / 22, dur: .5, add: true }); for (let k = 0; k < 14; k++) fx.push({ k: 'shard', x, y, ang: k / 14 * 6.283, life: .4, max: .4, d: r }); sfx('frost'); }
function bzVis(z, hit) {
  switch (z.vis) {
    case 'nova': bzFrost(z.x, z.y, z.r); if (z.push && hit) { const dx = P.x - z.x, dy = P.y - z.y, d = Math.hypot(dx, dy) || 1; P.vx += dx / d * 260; P.vy += dy / d * 260; } break;
    case 'bolt': bzZap(z.x, z.y); break;
    case 'gift': burst(z.x, z.y, 4, '#79e04a', 16, 60, 1); sfx('poison'); break;
    case 'land': bzBoom(z.x, z.y, z.r, 'erde'); dust(z.x, z.y, 14); shake(6); break;
    case 'meteor': bzBoom(z.x, z.y, z.r, 'feuer'); break;
    case 'boom': bzBoom(z.x, z.y, z.r, z.c); break;
    case 'zap': fx.push({ k: 'zap', pts: [[z.x, z.y - 6], [z.x + Math.cos(z.a) * z.len, z.y + Math.sin(z.a) * z.len - 6]], life: .3, max: .3 }); sfx('zap'); break;
    case 'slash': { const C = bCol(z.c); for (let i = 0; i < 16; i++) { const u = rnd(z.l0, z.len); part(z.x + Math.cos(z.a) * u, z.y + Math.sin(z.a) * u, rnd(2, 10), rnd(-20, 20), rnd(-10, 10), rnd(20, 60), C[2 + (i % 2)], rnd(.3, .5), 1, 60, 1); } sfx('swing2'); shake(2); break; }
  }
}
function bzStep(z, dt) {
  const o = z.o;
  if (o && o.dead) return false;
  switch (z.k) {
    case 'z': z.t -= dt; if (z.t <= 0) { z.fn(); return false; } return true;
    case 'c': {
      if (z.fol > 0) { z.fol -= dt; z.x = P.x; z.y = P.y; if (z.fol <= 0) sfx('tick'); return true; }
      z.t -= dt; if (z.t > 0) return true;
      const hit = z.dmg > 0 && bIn(P.x, P.y, z.x, z.y, z.r);
      if (hit) { bzHurt(z); if (z.slow) P.slowT = Math.max(P.slowT, z.slow); }
      bzVis(z, hit); if (z.fn) z.fn(z, hit); return false;
    }
    case 'l': {
      if (z.t > 0) { z.t -= dt; if (z.t > 0) return true; if (!z.travel) { if (bOnLine(z)) bzHurt(z, 1, z.x + Math.cos(z.a) * (z.l0 + z.len) / 2, z.y + Math.sin(z.a) * (z.l0 + z.len) / 2); bzVis(z); if (z.fn) z.fn(z); return false; } }
      // Erdspalte: läuft vom Boss weg; trifft, wenn die Spitze am Helden vorbeikommt
      const f0 = z.front; z.front += z.travel * dt;
      const ex = z.x + Math.cos(z.a) * z.front, ey = z.y + Math.sin(z.a) * z.front;
      if (Math.random() < .9) { part(ex + rnd(-5, 5), ey + rnd(-3, 3), 2, rnd(-30, 30), rnd(-15, 15), rnd(60, 120), pick(['#6a5e52', '#8a7a6a', '#d8a860']), rnd(.4, .7), 2); }
      if (Math.floor(f0 / 28) !== Math.floor(z.front / 28)) { decal(ex, ey, '#1a1410', 8, 6); if (Math.random() < .5) sfx('dig'); }
      if (!z.hit) { const [d, u] = bSegD(P.x, P.y, z.x, z.y, z.a, 0, z.len); if (d < z.w / 2 + P.r && u >= f0 - 6 && u <= z.front + 6) { z.hit = 1; bzHurt(z, 1, ex, ey); } }
      return z.front < z.len;
    }
    case 'v': {
      z.t -= dt; if (z.t > 0) return true;
      const dx = P.x - z.x, dy = P.y - z.y; if (Math.hypot(dx, dy) < z.r + P.r && Math.abs(angDiff(Math.atan2(dy, dx), z.a)) < z.arc / 2 + .08) bzHurt(z);
      const C = bCol(z.c); for (let i = 0; i < 40; i++) { const a = z.a + rnd(-z.arc / 2, z.arc / 2), v = rnd(80, 200); part(z.x, z.y, 10, Math.cos(a) * v, Math.sin(a) * v, rnd(0, 20), C[1 + (i % 3)], rnd(.4, .7), 2, 0, 1); }
      sfx(z.c === 'frost' ? 'frost' : z.c === 'gift' ? 'poison' : 'fire'); shake(3); return false;
    }
    case 'q': {
      if (z.t > 0) { z.t -= dt; if (z.t <= 0) { sfx('fire'); shake(3); } return true; }
      z.burn -= dt; z.tick -= dt;
      if (z.tick <= 0) { z.tick = .5; if (P.x > z.x0 - P.r && P.x < z.x1 + P.r && P.y > z.y0 - P.r && P.y < z.y1 + P.r) bzHurt(z, 1, P.x, P.y - 1); }
      if (Math.random() < .9) { const x = rnd(z.x0, z.x1), y = rnd(z.y0, z.y1); part(x, y, 0, rnd(-6, 6), 0, rnd(20, 50), pick(['#ff6a2a', '#ffb03a', '#ffd27a']), rnd(.4, .8), 2, -20, 1); }
      return z.burn > 0;
    }
    case 'w': {
      z.r += z.sp * dt;
      if (!z.hit) { const de = Math.hypot(P.x - z.x, (P.y - z.y) * 2); if (Math.abs(de - z.r) < z.band + P.r) { z.hit = 1; bzHurt(z, 1, z.x, z.y); } }
      if (Math.random() < .6) { const a = rnd(0, 6.283); part(z.x + Math.cos(a) * z.r, z.y + Math.sin(a) * z.r * .5, 1, 0, 0, rnd(20, 40), '#8a7a6a', .4, 2); }
      return z.r < z.max;
    }
    case 'b': {
      z.x = o.x; z.y = o.y;
      if (z.warm > 0) { z.warm -= dt; return true; }
      z.a += z.va * dt; z.life -= dt; z.tick -= dt;
      if (z.tick <= 0) { const [d, u] = bSegD(P.x, P.y, z.x, z.y, z.a, 0, z.len); if (d < z.w / 2 + P.r && u > 0) { z.tick = .35; bzHurt(z, 1, P.x - Math.cos(z.a) * 10, P.y - Math.sin(z.a) * 10); } }
      if (Math.random() < .5) { const u = rnd(10, z.len); part(z.x + Math.cos(z.a) * u, z.y + Math.sin(z.a) * u, 8, rnd(-10, 10), rnd(-10, 10), rnd(10, 30), '#fff2b0', .3, 1, 0, 1); }
      return z.life > 0;
    }
    case 's': {
      z.a += z.va * dt;
      if (z.warm > 0) { z.warm -= dt; return true; }
      z.life -= dt;
      for (let i = 0; i < z.n; i++) { const a = z.a + i / z.n * 6.283, bx = o.x + Math.cos(a) * z.rad, by = o.y + Math.sin(a) * z.rad * .55; if (Math.hypot(P.x - bx, (P.y - by) * 1.4) < 8 + P.r) { bzHurt(z, 1, bx, by); break; } }
      return z.life > 0;
    }
    case 'd': {
      if (z.warm > 0) { z.warm -= dt; return true; }
      z.life -= dt; z.tick -= dt; z.on = bIn(P.x, P.y, o.x, o.y, z.R);
      if (z.on && z.tick <= 0 && state === 'play') { z.tick = .5; bzHurt(z, 1, o.x, o.y); const h = o.maxHp * .012; o.hp = Math.min(o.maxHp, o.hp + h); txt(o.x, o.y - 18 * o.sc, '+' + fmt(h), '#ff6a7a'); }
      return z.life > 0;
    }
    case 'p': {
      if (z.warm > 0) { z.warm -= dt; return true; }
      z.life -= dt; z.tick -= dt;
      const dx = o.x - P.x, dy = o.y - P.y, d = Math.hypot(dx, dy) || 1;
      if (state === 'play' && d > 6 && !P.dash && !P.leap) { const s = z.str * dt * (P.roll > 0 ? .5 : 1); P.x = clamp(P.x + dx / d * s, BD.x0 + P.r, BD.x1 - P.r); P.y = clamp(P.y + dy / d * s, BD.y0, BD.y1); }
      if (z.tick <= 0 && bIn(P.x, P.y, o.x, o.y, z.R)) { z.tick = .5; bzHurt(z, 1, o.x, o.y); }
      if (Math.random() < .8) { const a = rnd(0, 6.283), r = rnd(40, 110); part(o.x + Math.cos(a) * r, o.y + Math.sin(a) * r * .5, rnd(2, 10), -Math.cos(a) * r * 1.2, -Math.sin(a) * r * .6, 0, pick(['#6a48c0', '#b892f4', '#3a2a5a']), .6, 1, 0, 1); }
      return z.life > 0;
    }
    case 'm': {
      if (z.fly > 0) { z.fly -= dt; return true; }
      if (z.fuse >= 0) { z.fuse -= dt; if (z.fuse <= 0) { if (bIn(P.x, P.y, z.x, z.y, z.r)) bzHurt(z); bzBoom(z.x, z.y, z.r, 'feuer'); return false; } return true; }
      z.arm -= dt; z.life -= dt;
      if ((z.arm <= 0 && bIn(P.x, P.y, z.x, z.y, 22)) || z.life <= 0) { z.fuse = .6; z.T = .6; sfx('fuse'); }
      return true;
    }
    case 'o': {
      z.t -= dt; if (Math.random() < .4) part(z.x + rnd(-8, 8), z.y, rnd(0, 8), 0, 0, rnd(20, 40), z.what === 'totem' ? '#79e04a' : '#b892f4', .5, 1, -10, 1);
      if (z.t > 0) return true;
      if (z.what === 'min') bMinion(o, z.type, z.x, z.y);
      else if (z.what === 'totem') bTotem(o, z.x, z.y);
      else burst(z.x, z.y, 8, '#4a4058', 18, 60);
      return false;
    }
    case 'h': {
      z.t -= dt; if (z.t > 0) return true;
      const a = Math.atan2(P.y - z.y, P.x - z.x);
      projs.push({ k: 'orb', fxn: 'darkorb', x: z.x, y: z.y, h: 14, vx: Math.cos(a) * z.sp, vy: Math.sin(a) * z.sp, life: 4.2, max: 4.2, dmg: z.dmg, from: 'e', r: 4, src: o, bHome: z.home, bSp: z.sp });
      return false;
    }
    case 'r': z.t -= dt; if (z.t <= 0) { z.fn(); return false; } return true;
    case 'e': {
      z.life -= dt; z.a += z.va * dt; z.acc += dt;
      while (z.acc >= z.every) { z.acc -= z.every; for (let i = 0; i < z.n; i++) bOrb(o, z.a + i / z.n * 6.283, z.sp, .6); }
      return z.life > 0;
    }
  }
  return false;
}
function bDarkEnd() { if (BZ.dark) { if (G) G.dark = BZ.dark.prev; BZ.dark = null; } }
HOOK.update.push(bSafe('update', dt => {
  if (BZ.g !== G) { BZ.fx = []; if (BZ.dark) BZ.dark = null; BZ.g = G; }
  if (!G) return;
  const L = BZ.fx; let w = 0;
  for (let i = 0; i < L.length; i++) { const z = L[i]; if (bzStep(z, dt)) L[w++] = z; }
  L.length = w;
  if (BZ.dark) { const D = BZ.dark; D.t -= dt; if (D.t <= 0 || !D.o || D.o.dead) bDarkEnd(); else G.dark = Math.min(.92, Math.max(D.prev, (G.dark || 0) + dt * 2)); }
  for (const p of projs) if (p.bHome && p.life > 0) { const a = Math.atan2(p.vy, p.vx), t = Math.atan2(P.y - p.y, P.x - p.x), na = a + clamp(angDiff(t, a), -p.bHome * dt, p.bHome * dt); p.vx = Math.cos(na) * p.bSp; p.vy = Math.sin(na) * p.bSp; if (Math.random() < .4) part(p.x, p.y, p.h, 0, 0, 0, '#b892f4', .35, 1, 0, 1); }
  if (BA) bArenaTick(dt);
  if (BZ.call) { BZ.call.t -= dt; if (BZ.call.t <= 0) BZ.call = null; }
  bBarUpd();
}));

/* ---------- Zeichnen ---------- */
function bzEll(x, y, r, fill, stroke, lw) { ctx.beginPath(); ctx.ellipse(Math.round(x - CX), Math.round(y - CY), Math.max(.5, r), Math.max(.5, r * .5), 0, 0, 6.283); if (fill) { ctx.fillStyle = fill; ctx.fill(); } if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lw || 1; ctx.stroke(); } }
// Warnung: Fläche, ein Kern wächst bis zum Einschlag, kurz davor blinkt der Rand weiß
function bzWarnC(x, y, r, c, p, pre) {
  const C = bCol(c), blink = p > .8 && Math.floor(T * 16) % 2;
  if (pre) { ctx.setLineDash([3, 3]); bzEll(x, y, r, bRgba(C[1], .08 + .08 * p), bRgba(C[3], .7), 1); ctx.setLineDash([]); addLight(x - CX, y - CY, r * .6, .3); return; }
  bzEll(x, y, r, bRgba(C[1], .16 + .16 * p), blink ? '#ffffff' : C[3], blink ? 2 : 1);
  if (p > 0) bzEll(x, y, r * p, bRgba(C[2], .2 + .25 * p));
  addLight(x - CX, y - CY, r * 1.1, .55);
}
function bzWarnL(x, y, a, l0, l1, w, c, p) {
  const C = bCol(c), blink = p > .8 && Math.floor(T * 16) % 2;
  ctx.save(); ctx.translate(Math.round(x - CX), Math.round(y - CY)); ctx.rotate(a);
  ctx.fillStyle = bRgba(C[1], .16 + .16 * p); ctx.fillRect(l0, -w / 2, l1 - l0, w);
  if (p > 0) { ctx.fillStyle = bRgba(C[2], .25 + .25 * p); ctx.fillRect(l0, -w / 2 * p, l1 - l0, w * p); }
  ctx.strokeStyle = blink ? '#ffffff' : C[3]; ctx.lineWidth = 1; ctx.strokeRect(l0, -w / 2, l1 - l0, w);
  ctx.restore();
  for (let u = l0; u <= l1; u += 60) addLight(x + Math.cos(a) * u - CX, y + Math.sin(a) * u - CY, w + 10, .4);
}
function bzDrawG() {
  for (const z of BZ.fx) {
    switch (z.k) {
      case 'c': if (z.fol > 0) { const C = bCol(z.c), q = .5 + .5 * Math.sin(T * 14); bzEll(z.x, z.y, z.r, bRgba(C[1], .12), bRgba(C[3], .5 + .4 * q), 1); ctx.fillStyle = C[3]; ctx.fillRect(Math.round(z.x - CX) - 1, Math.round(z.y - CY) - 4, 2, 8); ctx.fillRect(Math.round(z.x - CX) - 4, Math.round(z.y - CY) - 1, 8, 2); addLight(z.x - CX, z.y - CY, z.r, .5); } else bzWarnC(z.x, z.y, z.r, z.c, 1 - z.t / z.T, z.pre); break;
      case 'l': if (z.t > 0) bzWarnL(z.x, z.y, z.a, z.l0, z.len, z.w, z.c, 1 - z.t / z.T); else if (z.travel) bzWarnL(z.x, z.y, z.a, z.front, z.len, z.w, z.c, .3); break;
      case 'v': {
        const C = bCol(z.c), p = 1 - z.t / z.T, blink = p > .8 && Math.floor(T * 16) % 2, x = Math.round(z.x - CX), y = Math.round(z.y - CY);
        ctx.beginPath(); ctx.moveTo(x, y); ctx.arc(x, y, z.r, z.a - z.arc / 2, z.a + z.arc / 2); ctx.closePath(); ctx.fillStyle = bRgba(C[1], .16 + .16 * p); ctx.fill(); ctx.strokeStyle = blink ? '#ffffff' : C[3]; ctx.lineWidth = 1; ctx.stroke();
        ctx.beginPath(); ctx.moveTo(x, y); ctx.arc(x, y, z.r * p, z.a - z.arc / 2, z.a + z.arc / 2); ctx.closePath(); ctx.fillStyle = bRgba(C[2], .2 + .25 * p); ctx.fill();
        addLight(x + Math.cos(z.a) * z.r * .5, y + Math.sin(z.a) * z.r * .5, z.r * .7, .5); break;
      }
      case 'q': {
        const C = bCol(z.c), x0 = Math.round(z.x0 - CX), y0 = Math.round(z.y0 - CY), w = Math.round(z.x1 - z.x0), h = Math.round(z.y1 - z.y0);
        if (z.t > 0) { const p = 1 - z.t / z.T, blink = p > .8 && Math.floor(T * 16) % 2; ctx.fillStyle = bRgba(C[1], .14 + .16 * p); ctx.fillRect(x0, y0, w, h); ctx.save(); ctx.beginPath(); ctx.rect(x0, y0, w, h); ctx.clip(); ctx.strokeStyle = bRgba(C[2], .35 + .3 * p); ctx.lineWidth = 2; const o = (T * 20) % 16; ctx.beginPath(); for (let s = -h; s < w; s += 16) { ctx.moveTo(x0 + s + o, y0 + h); ctx.lineTo(x0 + s + o + h, y0); } ctx.stroke(); ctx.restore(); ctx.strokeStyle = blink ? '#ffffff' : C[3]; ctx.lineWidth = 1; ctx.strokeRect(x0 + .5, y0 + .5, w - 1, h - 1); }
        else { ctx.fillStyle = `rgba(255,${100 + Math.floor(40 * Math.sin(T * 9))},30,.28)`; ctx.fillRect(x0, y0, w, h); ctx.strokeStyle = C[3]; ctx.strokeRect(x0 + .5, y0 + .5, w - 1, h - 1); }
        addLight(x0 + w / 2, y0 + h / 2, Math.max(w, h) * .6, .45); break;
      }
      case 'w': { const C = bCol(z.c); bzEll(z.x, z.y, z.r, null, C[3], 3); bzEll(z.x, z.y, z.r, null, '#ffffff', 1); addLight(z.x - CX, z.y - CY, z.r + 10, .25); break; }
      case 'd': { const o = z.o, C = bCol(z.c); ctx.setLineDash(z.warm > 0 ? [2, 3] : [4, 2]); bzEll(o.x, o.y, z.R, bRgba(C[1], z.warm > 0 ? .08 : .14), bRgba(C[3], z.warm > 0 ? .6 : .85), 1); ctx.setLineDash([]); addLight(o.x - CX, o.y - CY, z.R * .7, .3); break; }
      case 'p': { const o = z.o, C = bCol(z.c), p = z.warm > 0 ? 1 - z.warm / z.W : 1; bzEll(o.x, o.y, z.R, bRgba(C[1], .15 + .15 * p), C[3], 1); ctx.strokeStyle = bRgba(C[2], .5); ctx.lineWidth = 1; for (let i = 0; i < 3; i++) { const a = T * 3 + i * 2.09, r = 60 + i * 25; ctx.beginPath(); ctx.ellipse(o.x - CX, o.y - CY, r, r * .5, 0, a, a + 1.2); ctx.stroke(); } addLight(o.x - CX, o.y - CY, z.R, .4); break; }
      case 'm': {
        const x = Math.round(z.x - CX), y = Math.round(z.y - CY);
        if (z.fly > 0) break;
        if (z.fuse >= 0) bzWarnC(z.x, z.y, z.r, 'feuer', 1 - z.fuse / z.T);
        if (z.fuse < 0 && z.arm <= 0) { ctx.setLineDash([2, 3]); bzEll(z.x, z.y, 22, 'rgba(255,60,40,.1)', 'rgba(255,90,60,.6)', 1); ctx.setLineDash([]); }
        const f = z.fuse >= 0 ? 2 : z.arm > 0 ? 0 : 1; ctx.drawImage(SHEET, 288 + f * 16, 320, 16, 16, x - 12, y - 18, 24, 24);
        if (z.arm <= 0 && Math.floor(T * (z.fuse >= 0 ? 14 : 4)) % 2) { ctx.fillStyle = 'rgba(255,60,40,.6)'; ctx.fillRect(x - 4, y - 13, 8, 7); }
        addLight(x, y - 6, 22, .7); break;
      }
      case 'o': { const p = 1 - z.t / z.T, col = z.what === 'totem' ? '121,224,74' : '180,120,255'; ctx.strokeStyle = `rgba(${col},${.5 + .5 * p})`; ctx.lineWidth = 1; for (let i = 0; i < 2; i++) { ctx.beginPath(); ctx.ellipse(z.x - CX, z.y - CY, 4 + 10 * p + i * 3, 2 + 5 * p + i * 1.5, 0, 0, 6.283); ctx.stroke(); } addLight(z.x - CX, z.y - CY, 22, .5); break; }
      case 'r': { const o = z.o, C = bCol(o.el), p = 1 - z.t / z.T; ctx.fillStyle = bRgba(C[3], .35 + .5 * p); for (let i = 0; i < z.n; i++) { const a = z.a0 + i / z.n * 6.283; for (let d = 14; d < 14 + 34 * p + 6; d += 6) ctx.fillRect(Math.round(o.x - CX + Math.cos(a) * d), Math.round(o.y - CY + Math.sin(a) * d * .7), 2, 2); } addLight(o.x - CX, o.y - CY, 40, .5); break; }
    }
  }
}
function bzDrawT() {
  for (const z of BZ.fx) {
    switch (z.k) {
      case 'c': if (z.vis === 'meteor' && z.t < .55 && !(z.fol > 0)) { const h = z.t / .55 * 130; drawFxFrame('firebomb', Math.floor(T * 14), z.x - CX, z.y - CY - h, 1.4, Math.PI / 2); addLight(z.x - CX, z.y - CY - h, 26, .8); } break;
      case 'b': {
        const o = z.o, x = o.x - CX, y = o.y - CY - 8 * o.sc, C = bCol(z.c);
        ctx.save(); ctx.translate(Math.round(x), Math.round(y)); ctx.rotate(z.a);
        if (z.warm > 0) {
          const p = 1 - z.warm / z.W; ctx.setLineDash([4, 3]); ctx.strokeStyle = bRgba(C[3], .5 + .4 * p); ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(8, 0); ctx.lineTo(z.len, 0); ctx.stroke(); ctx.setLineDash([]);
          // wohin er sich dreht: blasser Fächer
          ctx.fillStyle = bRgba(C[2], .08 + .08 * p); ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, z.len, 0, z.va * .9, z.va < 0); ctx.closePath(); ctx.fill();
        } else {
          ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = bRgba(C[2], .55); ctx.fillRect(6, -z.w / 2, z.len, z.w); ctx.fillStyle = 'rgba(255,255,255,.85)'; ctx.fillRect(6, -z.w / 6, z.len, z.w / 3); ctx.globalCompositeOperation = 'source-over';
        }
        ctx.restore(); for (let u = 30; u < z.len; u += 60) addLight(x + Math.cos(z.a) * u, y + Math.sin(z.a) * u, 24, z.warm > 0 ? .3 : .8); break;
      }
      case 's': {
        const o = z.o, spr = namedWeapon('anime_sword');
        ctx.globalAlpha = z.warm > 0 ? .35 + .2 * Math.sin(T * 20) : 1;
        for (let i = 0; i < z.n; i++) { const a = z.a + i / z.n * 6.283, bx = o.x + Math.cos(a) * z.rad - CX, by = o.y + Math.sin(a) * z.rad * .55 - CY - 6; drawWeapon(spr, bx, by + 8, T * 18 + i, 1); if (z.warm <= 0) addLight(bx, by, 14, .5); }
        ctx.globalAlpha = 1; break;
      }
      case 'd': if (z.on && z.warm <= 0) { const o = z.o; ctx.strokeStyle = `rgba(255,60,80,${.55 + .3 * Math.sin(T * 25)})`; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(o.x - CX, o.y - CY - 10 * o.sc); ctx.lineTo(P.x - CX, P.y - CY - 8); ctx.stroke(); if (Math.random() < .5) part(lerp(P.x, o.x, Math.random()), lerp(P.y, o.y, Math.random()), 8, 0, 0, 0, '#ff4a5a', .3, 1, 0, 1); } break;
      case 'm': if (z.fly > 0) { const p = 1 - z.fly / z.F, x = lerp(z.sx, z.x, p) - CX, y = lerp(z.sy, z.y, p) - CY - Math.sin(p * Math.PI) * 40; ctx.drawImage(SHEET, 288, 320, 16, 16, Math.round(x) - 8, Math.round(y) - 12, 16, 16); } break;
      case 'h': { const p = 1 - z.t / z.T; ctx.globalAlpha = .3 + .6 * p; drawFxFrame('darkorb', Math.floor(T * 14), z.x - CX, z.y - CY - 14, .6 + .4 * p, 0); ctx.globalAlpha = 1; addLight(z.x - CX, z.y - CY - 14, 18, .6); break; }
    }
  }
}
const BZ_G = { y: -1e9, draw: bSafe('drawG', () => { ctx.globalAlpha = 1; bzDrawG(); ctx.globalAlpha = 1; ctx.setLineDash([]); }) }, BZ_T = { y: 1e9, draw: bSafe('drawT', () => { bzDrawT(); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'; ctx.setLineDash([]); }) };
HOOK.draw.push(list => { if (BZ.fx.length && G && BZ.g === G) { list.push(BZ_G); list.push(BZ_T); } });
// Am Boss: Schild, Raserei, Heilung; Totems bekommen ihr eigenes Bild
HOOK.drawEnemy.push(bSafe('drawE', e => {
  if (e.bTotem) { bDrawTotem(e); return; }
  const Z = e.bz; if (!Z || e.st === 'spawn') return;
  const sx = Math.round(e.x - CX), sy = Math.round(e.y - CY - (e.z || 0)), R = e.r * e.sc;
  addLight(sx, sy - R, R * 2.6, BZ.dark ? .25 : .6);   // der Boss bleibt auch in dunklen Gebieten sichtbar
  if (Z.shield && e.armor > 0) { ctx.globalAlpha = .4 + .1 * Math.sin(T * 6); drawFxFrame('shield', Math.floor(T * 10) % 6, sx, sy - R * 1.1, R * 2.8 / 48); ctx.globalAlpha = 1; addLight(sx, sy - R, R * 2, .5); }
  if (Z.enr) { if (Math.random() < .5) part(e.x + rnd(-R, R), e.y + rnd(-2, 2), rnd(2, R * 2), 0, 0, rnd(15, 35), pick(['#ff4a3a', '#ff8a3a']), rnd(.3, .6), 1, -10, 1); addLight(sx, sy - R, R * 1.6, .45); }
  if (Z.heal) {
    const H = Z.heal, w = Math.round(30 * Math.min(1.6, e.sc)), y = Math.round(e.y - CY) + 7, k = clamp(H.dmg / H.need, 0, 1), q = .5 + .5 * Math.sin(T * 10);
    ctx.strokeStyle = `rgba(121,224,74,${.5 + .4 * q})`; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(sx, y - 7, R * 1.6 + 3 * q, R * .8 + 1.5 * q, 0, 0, 6.283); ctx.stroke();
    ctx.fillStyle = '#000'; ctx.fillRect(sx - w / 2 - 1, y - 1, w + 2, 5); ctx.fillStyle = '#3a6a2a'; ctx.fillRect(sx - w / 2, y, w, 3); ctx.fillStyle = '#ffd24a'; ctx.fillRect(sx - w / 2, y, Math.round(w * k), 3);
    addLight(sx, sy - R, R * 2.4, .6);
  }
}));
function bDrawTotem(e) {
  const x = Math.round(e.x - CX), y = Math.round(e.y - CY), C = e.bC || bCol('gift'), pu = Math.sin(T * 4 + e.seed);
  ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.beginPath(); ctx.ellipse(x, y, 9, 3.5, 0, 0, 6.283); ctx.fill();
  ctx.fillStyle = e.flash > 0 ? '#ffffff' : '#4a4450'; ctx.fillRect(x - 6, y - 6, 12, 6); ctx.fillStyle = '#5e5866'; ctx.fillRect(x - 5, y - 8, 10, 2);
  ctx.fillStyle = e.flash > 0 ? '#ffffff' : C[1]; ctx.fillRect(x - 3, y - 20, 6, 13); ctx.fillStyle = C[2]; ctx.fillRect(x - 2, y - 24 - Math.round(pu), 4, 6); ctx.fillStyle = C[3]; ctx.fillRect(x - 1, y - 23 - Math.round(pu), 1, 3);
  addLight(x, y - 18, 22, .7);
}

// Boss außerhalb des Bildes: roter Pfeil am Rand zeigt hin
function bArrow() {
  const e = enemies.find(x => x.bz && !x.dead && x.st !== 'spawn'); if (!e) return;
  const sx = e.x - CX, sy = e.y - CY - 10 * e.sc, top = BBAR.y + 12;
  if (sx > 0 && sx < VW && sy > top && sy < VH) return;
  const cx = VW / 2, cy = (top + VH) / 2, a = Math.atan2(sy - cy, sx - cx), x = clamp(sx, 16, VW - 16), y = clamp(sy, top + 4, VH - 16), q = .7 + .3 * Math.sin(T * 8);
  ctx.save(); ctx.translate(Math.round(x), Math.round(y)); ctx.rotate(a); ctx.globalAlpha = q;
  ctx.fillStyle = '#000'; ctx.beginPath(); ctx.moveTo(12, 0); ctx.lineTo(-7, -9); ctx.lineTo(-7, 9); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#ff6a4a'; ctx.beginPath(); ctx.moveTo(9, 0); ctx.lineTo(-5, -6); ctx.lineTo(-5, 6); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#ffd0b0'; ctx.fillRect(-3, -1, 5, 2);
  ctx.restore(); ctx.globalAlpha = 1;
}
HOOK.postRender.push(bSafe('call', () => {
  if (state !== 'play' || !G) return;
  const C = BZ.call; if (!C && !enemies.some(x => x.bz)) return;
  if (T > BBAR.yt) { BBAR.yt = T + .5; const el = $('bossbar'), r = el && !el.hidden ? el.getBoundingClientRect() : null; BBAR.y = r && r.height ? Math.round(r.bottom / SCALE) + 9 : Math.round(VH * .16); }
  bArrow(); if (!C) return;
  ctx.font = '8px "Press Start 2P", monospace'; const w = Math.ceil(ctx.measureText(C.s).width) + 12, a = clamp(C.t / .3, 0, 1), y = BBAR.y;
  ctx.globalAlpha = a; ctx.fillStyle = 'rgba(12,8,16,.72)'; ctx.fillRect(Math.round(VW / 2 - w / 2), y - 8, w, 16); ctx.fillStyle = C.col; ctx.fillRect(Math.round(VW / 2 - w / 2), y + 7, w, 1);
  ptext(C.s, VW / 2, y, C.col, 8); ctx.globalAlpha = 1;
}));
/* ---------- Bossleiste: Titel, Rang, Schild ---------- */
const BBAR = { k: '', sub: null, sh: null, shi: null, y: 60, yt: 0 };
(() => {
  const bb = $('bossbar'); if (!bb) return;
  bb.insertAdjacentHTML('beforeend', '<div id="bossSub"></div><div class="bar bsh" id="bossSh" hidden><i></i></div>');
  BBAR.sub = $('bossSub'); BBAR.sh = $('bossSh'); BBAR.shi = BBAR.sh.querySelector('i');
})();
function bBarUpd() {
  if (!BBAR.sub) return;
  const b = enemies.find(e => e.boss || e.champ), B = b && b.bz ? b.bDef : null, Z = b && b.bz;
  const sh = B && Z.shield && b.armor > 0 ? Math.round(100 * b.armor / Math.max(1, Z.shield.max)) : -1;
  const k = B ? B.id + '|' + sh + '|' + Z.ph : '';
  if (k === BBAR.k) return; BBAR.k = k;
  BBAR.sub.textContent = B ? B.title + ' · ' + _t('Rang {n}', { n: B.rank }) : '';
  $('bossbar').classList.toggle('bph', !!(B && B.mech.includes('phase')));
  BBAR.sh.hidden = sh < 0; if (sh >= 0) BBAR.shi.style.width = sh + '%';
}

/* ---------- Sieg, Beute, Trophäen ---------- */
function bCleanup(e) {
  BZ.fx = BZ.fx.filter(z => z.o !== e);
  if (BZ.dark && BZ.dark.o === e) bDarkEnd();
  for (const x of enemies) if (!x.dead && x.bOwn === e && (x.bTotem || x.bMirror)) { x.dead = true; burst(x.x, x.y, 8, '#b892f4', 14, 60, 1); }
  e.armor = 0;
}
HOOK.kill.push(bSafe('kill', e => { if (e.bz && e.bossId != null) bKilled(e); else if (e.bTotem) delete SAVE.meta.bestiary.btotem; }));   // Totems zählen nicht als Gegnerart
function bKilled(e) {
  const B = e.bDef, M = bM(); bCleanup(e); e.bFirst = false;
  if (e.bPractice || !M) return;
  const rec = M.b[B.id] || (M.b[B.id] = [0, 0]), first = !rec[0];
  rec[1] = Math.min(1e6, (rec[1] || 0) + 1); if (first) rec[0] = Math.floor(Date.now() / 6e4);
  BTROPH = -1;
  if (e.bLair) { M.l[e.bLair] = Date.now(); bPruneLairs(M); }
  e.bFirst = first;
  // was direkt gutgeschrieben wird, gleich hier: die Freiwelt legt neue Eier und Bauteile nach den Kill-Hooks in den Rucksack
  if (first) bFirstDirect(e, B); else bRepeatDirect(e, B);
  persist();
  if (first && P && P.st) { const k = P.hp / P.st.hp; computeStats(); P.hp = Math.min(P.st.hp, P.st.hp * k); }
}
function bDepth(e) { return e.bCtx && Number.isFinite(+e.bCtx.depth) ? clamp(+e.bCtx.depth, 0, 1) : e.bDef.r; }
function bFirstDirect(e, B) {
  gainFate(1 + Math.floor(B.r * 4), true);
  if (typeof partGive === 'function' && typeof partRoll === 'function' && typeof partGrade === 'function' && typeof PARTORDER !== 'undefined') { const n = 2 + Math.floor(B.r * 2); for (let i = 0; i < n; i++) partGive(partRoll(pick(PARTORDER), partGrade(e.bStage, .5 + B.r * .5), e.el), e.x, e.y - 40 * e.sc, i + 3); }
  if (typeof eggGive === 'function') {   // ein Ei ist beim ersten Sieg sicher (wenn im Nest Platz ist)
    const luck = 1 + B.r * 6; let g = null;
    try { const x = typeof eggForBiome === 'function' && e.bCtx ? eggForBiome(e.bCtx.biome, bDepth(e), luck) : null; if (x && typeof x === 'object' && x.sp) g = eggGive(x.sp, false, { tier: x.tier }); else if (typeof x === 'string') g = eggGive(x, false); } catch (_) { g = null; }
    if (!g) eggGive(null, false, { luck });
  }
  bModGive(e, 1 + Math.floor(B.r * 2), 1 + B.r * 4);
}
function bRepeatDirect(e, B) { if (Math.random() < .25) bModGive(e, 1, 1 + B.r * 2); }
function bModGive(e, n, luck) {
  if (typeof modRoll !== 'function' || typeof modGive !== 'function') return;
  for (let i = 0; i < n; i++) { try { const k = modRoll(bDepth(e), luck); if (k) modGive(k, 1); } catch (_) { } }
}
HOOK.loot.push(bSafe('loot', (e, lm) => { if (e.bz && e.bossId != null && !e.bPractice) bLoot(e, lm || 1); }));
function bLoot(e, lm) {
  const B = e.bDef, st = e.bStage;
  if (e.bFirst) {
    dropCoins(e.x, e.y, e.gold * 3, true);
    for (let i = 0; i < 2; i++) dropItem(e.x + rnd(-14, 14), e.y + rnd(-8, 8), randomItem(st, 3, { setChance: .05 }));
    if (Math.random() < .3 + B.r * .6) dropItem(e.x, e.y + 6, randomItem(st, 4, { setChance: .08 }));
    if (B.sig) dropItem(e.x, e.y - 6, bSigItem(B, st));
    dropGem(e.x, e.y, randomGem(st + 12));
    bTrophyFx(e, B);
  } else if (B.sig && Math.random() < .1 * lm) dropItem(e.x, e.y, bSigItem(B, st));
}
function bTrophyFx(e, B) {
  const n = bossTrophies(), g = G; sfx('ach');
  toast(_t('Neue Trophäe! Boss-Kodex {n} / {max}', { n, max: BOSS_N }), '#ffd24a');
  for (let i = 0; i < 40; i++) part(e.x, e.y, rnd(0, 20), rnd(-60, 60), rnd(-30, 30), rnd(60, 160), pick(['#ffd24a', '#fff3c0', '#e8b04a']), rnd(.6, 1.2), 1, 120, 1);
  setTimeout(() => {
    if (G !== g || !G) return;
    banner(_t('TROPHÄE: {name}', { name: B.name.toLocaleUpperCase(LOCALE) }), _t('Boss-Kodex {n} / {max}', { n, max: BOSS_N }));
    if (n % 25 === 0 && bTiers(n) <= BTIER_MAX) { const [k, v] = BBONUS[(bTiers(n) - 1) % 4]; setTimeout(() => toast(_t('Trophäen-Bonus: {b}', { b: bBonusName(k, v) }), '#79e04a'), 1200); }
    const T1 = BTITLE.find(t => t[0] === n); if (T1) setTimeout(() => toast(_t('Neuer Titel: „{t}“ – wähle ihn im Boss-Kodex', { t: T1[1] }), '#ffd24a'), 2600);
  }, 1700);
}
function bBonusName(k, v) { return k === 'dmg' ? _t('Schaden +{v}', { v: pct(v) }) : k === 'hp' ? _t('LP +{v}', { v: pct(v) }) : k === 'gold' ? _t('Gold +{v}', { v: pct(v) }) : _t('Beute +{v}', { v: pct(v) }); }
// Signatur-Beute: Legendär, Name des Bosses, Element und Affixe passend dazu (+25 %), mindestens zwei Sockel
function bSigItem(B, st) {
  const S = B.sig, slot = S.slot, C = CLASSES[P.cls], tier = clamp(Math.floor((st - 1) / 6) + 1, 0, TIERS - 1);
  const it = makeItem({ slot, base: slot === 'weapon' ? pick(C.weapons) : slot, tier, rar: 4 }), pool = slot === 'weapon' ? AFFW : AFFA;
  it.aff = {}; for (const k of S.aff) if (pool[k]) it.aff[k] = +(pool[k].f(4) * 1.25).toFixed(3);
  const W = BSIGW[slot]; it.name = bFill(BSIGN, { noun: W[S.noun % W.length], name: B.name }); it.suf = null; it.el = B.el; it.bsig = B.id;
  if (it.sockets < 2) it.sockets = 2;
  return it;
}
HOOK.itemLines.push(bSafe('lines', (it, L) => { if (it.bsig == null) return; const B = bossDef(it.bsig); if (B) L.push(_t('✦ Signatur-Beute von {name} · Rang {n}', { name: B.name, n: B.rank })); }));

/* ---------- Übungskampf ohne Beute: alles, was ein Kill gibt, wird zurückgenommen ---------- */
let BSNAP = null;
function bPrac() { return !!(BA && BA.practice && G && G.type === 'bossarena'); }
function bSnap(e) {
  if (!bPrac()) { BSNAP = null; return; }
  const S = SAVE.meta.stats, Pt = SAVE.meta.pets;
  BSNAP = { e, pk: pickups.length, fate: P.fate || 0, lore: SAVE.meta.lore.length, parts: JSON.stringify(P.parts || {}), mods: P.mods ? JSON.stringify(P.mods) : null, eggs: Pt && Array.isArray(Pt.eggs) ? Pt.eggs.map(g => g.id) : null, kills: P.stats.kills - 1, sk: (S.kills || 1) - 1, st: (S['k_' + e.t] || 1) - 1, xp: P.xp, pxp: P.pxp, gold: P.gold };
}
function bUnsnap(e) {
  const s = BSNAP; BSNAP = null; if (!s || s.e !== e) return;
  const S = SAVE.meta.stats, Pt = SAVE.meta.pets;
  pickups.length = Math.min(pickups.length, s.pk); P.fate = s.fate; SAVE.meta.lore.length = Math.min(SAVE.meta.lore.length, s.lore);
  P.parts = JSON.parse(s.parts); if (s.mods != null) P.mods = JSON.parse(s.mods);
  if (s.eggs && Pt && Array.isArray(Pt.eggs)) Pt.eggs = Pt.eggs.filter(g => s.eggs.includes(g.id));
  P.stats.kills = s.kills; S.kills = s.sk; S['k_' + e.t] = s.st; P.gold = s.gold;
  if (P.xp > s.xp || P.pxp > s.pxp) { P.xp = s.xp; P.pxp = s.pxp; }
}
HOOK.boot.push(() => { HOOK.kill.unshift(bSafe('snap', bSnap)); HOOK.loot.push(bSafe('unsnap', bUnsnap)); });

/* ---------- Kampfplatz (Kodex-Übung, Tests) ---------- */
Object.defineProperty(NODE, 'bossarena', { value: { n: _t('Bosskampf'), icon: ['pa', 'skull'], c: '#c8463c', d: '' }, enumerable: false });
const BARENA = { feuer: 4, frost: 5, gift: 6, schatten: 7, licht: 1, blitz: 3 };
let BA = null;
function bossArena(id, o) {
  o = o || {}; const B = bossDef(id); if (!B || !P || !P.st) return null;
  const stage = Math.max(1, Math.round(+o.stage || bossStage(B.r)));
  BA = { id: B.id, practice: o.practice !== false, t: 0, e: null, end: 0, dead: 0, stage, hp0: P.hp, pot0: P.potions, res0: P.res, buf: JSON.stringify(P.buffs || []), from: o.from || KX.from };
  hideOverlay(); startRoom('bossarena', 0, { bossId: B.id });
  prepArena(B.el === 'feuer' && B.r > .5 ? 8 : BARENA[B.el] || 1, bHash('arena', B.id) % 99991);
  G.row = stage - 1 - (P.act - 1) * 7; G.stage = stage; G.phase = 'fight';
  P.x = AW / 2; P.y = (BD.y0 + BD.y1) / 2 + 20; P.vx = P.vy = 0; P.hp = P.st.hp; P.res = P.st.resMax; P.inv = 1;
  cam.x = clamp(P.x - VW / 2, 0, Math.max(0, AW - VW)); cam.y = clamp(P.y - VH / 2, 0, Math.max(0, AH - VH));
  banner(B.name.toLocaleUpperCase(LOCALE), BA.practice ? _t('Übungskampf – ohne Beute, ohne Risiko') : B.title);
  setMusic(bg.b.root + 5, true); BZ.fx = []; BZ.g = G;
  return BA;
}
HOOK.roomUpd.push(bSafe('room', (h, dt) => {
  if (h || !G || G.type !== 'bossarena' || !BA) return h;
  BA.t += dt;
  if (!BA.e && BA.t > 1) { BA.e = bossSpawn(BA.id, AW / 2, Math.max(BD.y0 + 34, P.y - 120), { stage: BA.stage, practice: BA.practice }); BA.e.cd = 1; }
  if (BA.e && BA.e.dead && !BA.end && state === 'play') { BA.end = 2.6; banner(BA.practice ? _t('ÜBUNG GESCHAFFT') : _t('BOSS BESIEGT'), BA.e.name); }
  if (BA.end > 0) { for (const c of pickups) c.mag = 1; BA.end -= dt; if (BA.end <= 0) bArenaExit(); }
  return true;
}, false));
HOOK.die.push(h => {
  if (h || !BA || !G || G.type !== 'bossarena') return h;
  P.hp = 0; setState('dead'); deadT = 999; P.atkT = 0; P.spin = 0; P.leap = null; P.dash = null; BA.dead = 2;
  burst(P.x, P.y, 8, '#b8302a', 24, 90); sfx('die'); $('bossbar').hidden = true; slowmo = 1.4;
  return true;
});
function bArenaTick(dt) {
  if (BA.dead > 0) { BA.dead -= dt; if (BA.dead <= 0) bArenaDeath(); }
}
function bArenaDeath() {
  const B = bossDef(BA.id); setState('over'); showHud(false);
  showOverlay(`<div class="over center"><h2>${_t('BESIEGT')}</h2><p class="sub">${_t('{name} war diesmal stärker. Im Boss-Kodex stehen alle Mechaniken – Übung macht den Meister.', { name: esc(B.name) })}</p><div class="menu"><button class="btn" data-act="bk_again">${_t('Nochmal')}</button><button class="btn alt" data-act="bk_leave">${_t('Zum Boss-Kodex')}</button></div></div>`);
}
// Übung kostet nichts: Leben, Tränke, Ressource und Raum-Segen wie vorher
function bArenaRestore(A) { if (!A.practice) return; try { P.buffs = JSON.parse(A.buf); } catch (_) { } computeStats(); P.hp = Math.max(1, Math.min(P.st.hp, A.hp0)); P.potions = A.pot0; P.res = Math.min(P.st.resMax, A.res0); }
// Mitten im Kampf ins Hauptmenü: Übung trotzdem zurücksetzen
HOOK.titleBtns.push(() => { if (BA && P) { const A = BA; BA = null; bArenaRestore(A); if (SAVE.active >= 0) saveChar(); } return ''; });
function bArenaClear() { enemies = []; projs = []; hazards = []; pickups = []; BZ.fx = []; bDarkEnd(); $('bossbar').hidden = true; showHud(false); }
function bArenaExit() {
  const A = BA; if (!A) return; BA = null; bArenaClear();
  bArenaRestore(A); if (!A.practice) P.hp = Math.max(1, P.hp);
  saveChar(); bKodexBg(A.from); bossKodex();
}
// Hintergrund hinter dem Kodex nach dem Kampf: Karte, Versteck oder Titel
function bKodexBg(from) {
  if (from === 'map') { G = null; setState('map'); if (!P.map || P.map.act !== P.act) P.map = genMap(P.act); }
  else if (from === 'lib') { enterHideout(); setState('menu'); }
  else { titleScene(); setState('title'); }
}
ON.bk_again = () => { const A = BA; if (!A) return; BA = null; bArenaClear(); bArenaRestore(A); bossArena(A.id, { practice: A.practice, from: A.from }); if (BA) Object.assign(BA, { hp0: A.hp0, pot0: A.pot0, res0: A.res0, buf: A.buf }); };
ON.bk_leave = () => bArenaExit();

/* ---------- Boss-Kodex ---------- */
const KX = { from: 'title', band: 0, sel: -1, filt: 'all', back: null };
function bossKodex(from) {
  if (from != null) { if (typeof from === 'function') { KX.back = from; KX.from = 'fn'; } else { KX.from = String(from); KX.back = null; } }
  if (state === 'map' || state === 'play') setState('menu');
  showOverlay(bKodexHTML(), true);
}
ON.bk_open = id => { KX.sel = -1; bossKodex(id || 'title'); };
ON.bk_back = () => {
  const f = KX.from; KX.sel = -1;
  if (f === 'fn' && KX.back) { const b = KX.back; KX.back = null; b(); }
  else if (f === 'map') { setState('map'); showMapMore(); }
  else if (f === 'lib') { if (G && G.type === 'versteck') openStation('bibliothek', 'best'); else { enterHideout(); openStation('bibliothek', 'best'); } }
  else if (f === 'best') showBestiary(); else showTitle();
};
ON.bk_band = (id, b, i) => { KX.band = clamp(i, 0, BOSS_BANDS - 1); KX.sel = -1; bossKodex(); };
ON.bk_f = id => { KX.filt = id; KX.sel = -1; bossKodex(); };
ON.bk_sel = (id, b, i) => { KX.sel = i; sfx('click'); bossKodex(); };
ON.bk_title = (id, b, i) => { const M = bM(); if (!M) return; M.tt = M.tt === i ? -1 : i; persist(); sfx('click'); bossKodex(); };
ON.bk_fight = (id, b, i) => { if (!P || SAVE.active < 0 || landeActive2()) return; const from = KX.from; KX.sel = i; bossArena(i, { practice: true, from }); };
function landeActive2() { return typeof landeActive === 'function' && landeActive(); }
function bIcon(B) { return iconURL(['sp', B.sp, B.tint]); }
const BK_ICON = ['sp', 'demon', 'rgba(210,30,10,.38)'];   // Bild des Kodex: der Drache
function bKState(id) { const M = bM(), r = M && M.b[id]; return !r ? 'u' : r[0] > 0 ? 'k' : 's'; }
function bKodexHTML() {
  const M = bM(), n = bossTrophies(), seen = M ? Object.keys(M.b).length : 0, bo = bBonus(n), tier = bTiers(n);
  const bon = ['dmg', 'hp', 'gold', 'loot'].filter(k => bo[k]).map(k => `<span>${bBonusName(k, bo[k])}</span>`).join('');
  const next = tier < BTIER_MAX ? `${_t('Nächster Bonus bei {n} Trophäen: {b}', { n: (tier + 1) * 25, b: bBonusName(...BBONUS[tier % 4]) })}` : _t('Alle Trophäen-Boni freigeschaltet!');
  const ttl = BTITLE.map(([at, t], i) => `<button class="bk-ttl${M && M.tt === i ? ' sel' : ''}" data-act="bk_title" data-i="${i}" ${n >= at ? '' : 'disabled'}>${n >= at ? esc(t) : '🔒 ' + at}</button>`).join('');
  const bands = BBAND.map((nm, i) => { let k = 0; if (M) for (let j = i * BOSS_BAND_N; j < (i + 1) * BOSS_BAND_N; j++) if (M.b[j] && M.b[j][0] > 0) k++; return `<button class="bk-band${KX.band === i ? ' sel' : ''}" data-act="bk_band" data-i="${i}" style="--c:${BBANDC[i]}"><b>${i * BOSS_BAND_N + 1}–${(i + 1) * BOSS_BAND_N}</b><small>${esc(nm)} · ${k}</small></button>`; }).join('');
  const fl = (k, l) => `<button class="tab" role="tab" aria-selected="${KX.filt === k}" data-act="bk_f" data-id="${k}">${l}</button>`;
  let tiles = '';
  for (let id = KX.band * BOSS_BAND_N; id < (KX.band + 1) * BOSS_BAND_N; id++) {
    const s = bKState(id); if (KX.filt === 'k' && s !== 'k') continue; if (KX.filt === 'o' && s === 'k') continue;
    const B = bossDef(id), lbl = s === 'u' ? _t('Unbekannter Boss, Rang {n}', { n: B.rank }) : B.name;
    tiles += `<button class="bk-t ${s}${KX.sel === id ? ' sel' : ''}" data-act="bk_sel" data-i="${id}" aria-label="${esc(lbl)}"><img src="${bIcon(B)}" alt=""><span>${B.rank}</span>${s === 'k' ? '<i>★</i>' : ''}</button>`;
  }
  const side = KX.sel >= 0 && bossDef(KX.sel) ? `<div class="side sheet">${bDetailHTML(bossDef(KX.sel))}</div>` : `<div class="side"><p class="sub" style="margin-top:0">${_t('Tippe einen Boss an. Unbekannte zeigen nur ihren Schatten – finde ihre Höhlen in den Endlosen Landen.')}</p></div>`;
  const tt = bTitleNow();
  return `<div class="head"><h2>${_t('BOSS-KODEX')}</h2><div class="hbtns"><button class="btn alt sm bk-hb" data-act="bk_back">${_t('Zurück')}</button></div></div>
  <div class="bk"><div class="bk-top"><div class="bk-n"><img src="${iconURL(BK_ICON)}" alt=""><b>${n}</b><span>/ ${BOSS_N} ${_t('Trophäen')}</span></div><div class="bar bk-bar"><i style="width:${(n / BOSS_N * 100).toFixed(1)}%"></i></div>
  <div class="bk-l">${_t('{n} gesehen', { n: seen })}${tt ? ' · ' + _t('Titel: „{t}“', { t: esc(tt) }) : ''}</div>${bon ? `<div class="stats" style="margin:6px 0 0">${bon}</div>` : ''}<div class="bk-l">${next}</div></div>
  <details class="bk-tt"><summary>${_t('TITEL')}</summary><div class="bk-ttls">${ttl}</div></details>
  <div class="bk-bands">${bands}</div>
  <div class="split"><div><div class="tabs" role="tablist">${fl('all', _t('ALLE'))}${fl('k', _t('BESIEGT'))}${fl('o', _t('OFFEN'))}</div><div class="bk-grid">${tiles || `<p class="sub">${_t('Hier ist noch nichts.')}</p>`}</div></div>${side}</div></div>`;
}
function bDetailHTML(B) {
  const M = bM(), rec = M && M.b[B.id], s = bKState(B.id), x = `<button class="btn alt sm sheetx" data-act="bk_sel" data-i="-1" aria-label="${_t('Schließen')}"><span class="x">×</span></button>`;
  const head = (nm, sub) => `${x}<div class="bk-d"><div class="bk-pic${s === 'u' ? ' u' : ''}"><img src="${bIcon(B)}" alt=""></div><div><div class="nm" style="color:${BBANDC[B.band]}">${nm}</div><div class="st">${sub}</div><div class="st">${_t('Rang {n}', { n: B.rank })} · ${esc(BBAND[B.band])}${s !== 'u' && typeof elTag === 'function' ? ' · ' + elTag(B.el) : ''}</div></div></div>`;
  const where = _t('Höhlen dieses Rangs liegen etwa {d} % tief in den Endlosen Landen.', { d: Math.round(B.r * 100) });
  if (s === 'u') return head('???', _t('Unbekannter Boss')) + `<p class="sub">${where}</p><p class="sub">${_t('{n} Mechaniken', { n: B.mech.length })}${B.sig ? ' · ' + _t('mit Signatur-Beute') : ''}</p>`;
  const date = rec && rec[0] ? new Date(rec[0] * 6e4).toLocaleDateString(LOCALE) : '', loc = rec && rec.length >= 4 ? bWhere(rec[2], rec[3]) : '';
  const pills = `<div class="kv" style="justify-content:flex-start;margin:6px 0">${s === 'k' ? `<span class="pill">★ ${_t('TROPHÄE')}</span><span class="pill dim">${_t('{n} besiegt', { n: rec[1] })}</span><span class="pill dim">${_t('Erster Sieg {d}', { d: date })}</span>` : `<span class="pill dim">${_t('GESEHEN')}</span>`}</div>`;
  const mech = B.mech.concat(B.res).map(k => { const Mk = BMECH[k], extra = B.res.includes(k) ? ` <span style="color:var(--gold)">(${_t('ab Phase {n}', { n: B.res.indexOf(k) + 2 })})</span>` : ''; return `<div class="row bk-m" style="cursor:default"><div class="ic"><img src="${iconURL(Mk.ic)}" alt=""></div><div><div class="nm">${esc(Mk.n)}${extra}</div><div class="st">${esc(Mk.d)}</div></div><span></span></div>`; }).join('');
  const aff = B.aff.length ? `<div class="kv" style="justify-content:flex-start;margin:6px 0">${B.aff.map(a => `<span class="pill" style="background:${AFFIX[a].c}">${esc(AFFIX[a].n)}</span>`).join('')}</div>` : '';
  let sig = '';
  if (B.sig) { const S = B.sig, W = BSIGW[S.slot], pool = S.slot === 'weapon' ? AFFW : AFFA, nm = bFill(BSIGN, { noun: W[S.noun % W.length], name: B.name }); sig = `<h3>${_t('SIGNATUR-BEUTE')}</h3><div class="detail" style="margin-top:0"><div class="nm" style="color:${RAR[4].c}">${s === 'k' ? esc(nm) : '???'}</div><div class="st" style="font-size:16px;color:var(--parch-dim)">${s === 'k' ? S.aff.map(k => pool[k] ? esc(pool[k].s(pool[k].f(4) * 1.25)) : '').join(' · ') : _t('Besiege den Boss, um sie zu sehen. Garantiert beim ersten Sieg.')}</div></div>`; }
  const fight = P && SAVE.active >= 0 && !landeActive2() ? `<div class="acts" style="justify-content:flex-start;margin-top:8px"><button class="btn sm" data-act="bk_fight" data-i="${B.id}">${_t('Übungskampf')}</button></div><p class="sub" style="font-size:15px;margin:4px 0 0">${_t('Ohne Beute und ohne Risiko – zum Lernen der Mechaniken.')}</p>` : '';
  return head(esc(B.name), esc(B.title)) + pills + `<p class="sub" style="font-style:italic">„${esc(B.lore)}“</p>` + (loc ? `<p class="sub">${loc}</p>` : `<p class="sub">${where}</p>`) + `<h3>${_t('MECHANIKEN')}</h3>${mech}${aff}${sig}${fight}`;
}
function bWhere(cx, cy) {
  let d = Math.min(1, Math.hypot(cx, cy) / 9000), nm = '';
  try { if (typeof landeCtx === 'function') { const c = landeCtx(cx, cy); if (c && Number.isFinite(+c.depth)) d = +c.depth; const L = typeof LANDE_BIOMES !== 'undefined' && c && LANDE_BIOMES[c.biome]; if (L) nm = L.n || L.name || ''; } } catch (_) { }
  return _t('Gesehen bei Abschnitt {x}, {y} · {d} % tief', { x: cx, y: cy, d: Math.round(d * 100) }) + (nm ? ' · ' + esc(nm) : '');
}
HOOK.mapMore.push(() => `<button class="btn alt" data-act="bk_open" data-id="map">${_t('Boss-Kodex')} · ${bossTrophies()}/${BOSS_N}</button>`);
HOOK.bestiary = HOOK.bestiary || [];
HOOK.bestiary.push(() => `<button class="btn bk-open" data-act="bk_open" data-id="${G && G.type === 'versteck' ? 'lib' : 'best'}"><img src="${iconURL(BK_ICON)}" alt="">${_t('Boss-Kodex')} · ${bossTrophies()} / ${BOSS_N}</button>`);
// Tipps beim ersten Mal (einmal pro Konto), erst nach der Ansage – auf dem Handy liegt die Meldung oben über der Bossleiste
function bTip(k) {
  const M = bM(); if (!M) return;
  const bit = 1 << (BM_KEYS.indexOf(k) + 1), g = G, show = s => setTimeout(() => { if (G === g && state === 'play') toast(s, '#ffd24a'); }, 1800);
  if (!(M.h & 1)) { M.h |= 1; persist(); show(BTIP0); return; }
  if (BMECH[k].tip && !(M.h & bit)) { M.h |= bit; persist(); show(BMECH[k].tip); }
}

document.head.insertAdjacentHTML('beforeend', '<style>'
  + '#bossSub{font-size:6px;color:var(--parch-dim);margin-top:5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}#bossSub:empty{display:none}'
  + '#bossbar .bar.bsh{height:4px;margin-top:4px}#bossbar .bar.bsh i{background:#8ad8ff}'
  + '#bossbar.bph .bar:not(.bsh)::before,#bossbar.bph .bar:not(.bsh)::after{content:"";position:absolute;top:0;bottom:0;width:2px;background:rgba(255,255,255,.75);z-index:1}#bossbar.bph .bar:not(.bsh)::before{left:33%}#bossbar.bph .bar:not(.bsh)::after{left:66%}'
  + '.bk-top{background:var(--stone-lo);padding:10px;margin-bottom:8px}.bk-n{display:flex;align-items:center;gap:8px;font-family:var(--f-display);font-size:10px;color:var(--parch-dim)}.bk-n b{font-weight:400;font-size:20px;color:var(--gold)}.bk-n img{width:30px;height:30px;object-fit:contain;image-rendering:pixelated}'
  + '.bk-bar{width:100%;height:8px;margin:8px 0 6px}.bk-bar i{background:linear-gradient(90deg,var(--gold-dk),var(--gold))}.bk-l{font-size:17px;color:var(--parch-dim);margin-top:4px}'
  + '.bk-tt{margin:0 0 8px}.bk-tt summary{cursor:pointer;font-family:var(--f-display);font-size:8px;color:var(--gold);padding:12px 0;min-height:20px}.bk-ttls{display:flex;flex-wrap:wrap;gap:5px}'
  + '.bk-ttl{border:0;background:var(--stone-lo);color:var(--parch);font:17px var(--f-body);padding:8px 10px;min-height:44px;cursor:pointer}.bk-ttl.sel{box-shadow:inset 0 0 0 2px var(--gold);background:var(--stone-hi)}.bk-ttl:disabled{color:var(--parch-dim);cursor:default;opacity:.6}'
  + '.bk-bands{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:5px;margin-bottom:10px}@media (min-width:700px){.bk-bands{grid-template-columns:repeat(6,minmax(0,1fr))}}'
  + '.bk-band{border:0;background:var(--stone-lo);color:var(--parch);padding:6px 2px;min-height:48px;cursor:pointer;font-family:var(--f-display);font-size:7px;line-height:1.5;box-shadow:inset 0 -3px 0 var(--c)}.bk-band b{font-weight:400}.bk-band small{display:block;font-family:var(--f-body);font-size:14px;color:var(--parch-dim);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.bk-band.sel{background:var(--stone-hi);box-shadow:inset 0 0 0 2px var(--gold),inset 0 -3px 0 var(--c)}'
  + '.bk-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(56px,1fr));gap:5px}.bk-t{position:relative;aspect-ratio:1;min-height:52px;border:0;background:var(--night);cursor:pointer;padding:0;display:grid;place-items:center}'
  + '.bk-t img{width:78%;height:78%;object-fit:contain;image-rendering:pixelated}.bk-t.u img{filter:brightness(0);opacity:.55}.bk-t span{position:absolute;left:3px;bottom:2px;font-family:var(--f-display);font-size:6px;color:var(--parch-dim);text-shadow:1px 1px 0 #000}'
  + '.bk-t.k{box-shadow:inset 0 0 0 2px var(--gold-dk)}.bk-t i{position:absolute;right:3px;top:1px;color:var(--gold);font-style:normal;font-size:15px;text-shadow:1px 1px 0 #000}.bk-t.s{box-shadow:inset 0 0 0 1px var(--stone-hi)}.bk-t.sel{box-shadow:inset 0 0 0 3px var(--gold)}'
  + '.bk-d{display:flex;gap:10px;align-items:center;margin-bottom:4px}.bk-d .nm{font-size:22px;line-height:1}.bk-d .st{font-size:16px;color:var(--parch-dim);margin-top:3px;line-height:1.05}'
  + '.bk-pic{width:84px;height:84px;flex:none;display:grid;place-items:center;background:radial-gradient(circle,var(--stone-hi),var(--night) 70%)}.bk-pic img{width:72px;height:72px;object-fit:contain;image-rendering:pixelated}.bk-pic.u img{filter:brightness(0);opacity:.6}'
  + '.bk-hb,.bk .btn,.bk .tab,body.touch .btn.bk-hb,body.touch .bk .btn,body.touch .bk .tab{min-height:44px}.bk .sheetx,body.touch .bk .sheetx{min-width:44px;min-height:44px}.bk-m .st{font-size:15px}.bk-open{display:flex;align-items:center;justify-content:center;gap:8px;width:100%;margin:0 0 10px}.bk-open img{width:26px;height:26px;margin:-6px 0;object-fit:contain;image-rendering:pixelated}'
  + '</style>');
