'use strict';
/* =========================================================
   KLINGENHORT – Die Endlosen Lande (6.1): eine feste, endlose Welt für alle – aus Chunks gestreamt
   Hängt sich über HOOK/ON (js/core.js) ins Spiel ein. Welt-Saat WORLD_SEED: Gelände, Biome, Regionen, Barrieren, Tore, Horte sind für alle gleich;
   Truhen, Lager, Streifen und ihr Inhalt würfelt jeder Ausflug neu (Ausflugs-Saat).
   Maße: Kachel 16 px, Chunk 48 × 48 Kacheln = 768 px, Chunk (0, 0) = Lichtung am Weltentor, Weltrand bei 9000 Chunks (≈ 24 h Fußmarsch).
   Tiefe = min(1, hypot(cx, cy) / 9000) – alles wächst mit ihr: Gegnerstufe (worldStage), Glück, Eier, Mods, Bosse.
   Koordinaten im Spiel = Welt-Pixel + LOFF (fester Ursprung je Welt, nie verschoben – andere Systeme merken sich Positionen; Zahlen bleiben genau).
   Nur ein Fenster von Chunks um den Helden ist geladen (Daten 5 × 5, Boden 3 × 3, je Chunk eine wiederverwendete Leinwand), Gegner nur in der Nähe.
   Ausflug: Start am Weltentor oder an einem eigenen Leuchtfeuer → Beute in den Rucksack → raus durch ein Tor der Alten, das Weltentor oder ein Leuchtfeuer.
   Rucksack (LW.pack, packCap(): 20 + 2 je Sattlerei-Stufe + Ruf) trägt Gegenstände und Eier; Gold, Material, Edelsteine, Bauteile und Mods kommen
   ohne Platzgrenze in den Sammelbeutel (6.2, LW.pouch). Magische Vögel (js/voegel.js) bringen Dinge sofort heim – nicht mitten im Kampf.
   Tod: Ausrüstung, Rucksack und Sammelbeutel sind verloren, nur die Begleiter-Tasche (petBagSize, p.bag) kommt heim; was seit dem letzten Leuchtfeuer erkundet wurde, ist vergessen.
   Abbrechen (nur außerhalb des Kampfes) oder neu laden: Rucksack und Sammelbeutel verloren, Ausrüstung vom Aufbruch zurück. Neu laden mitten im Kampf zählt als Tod (M.cur.fight).
   Barrieren an Ringgrenzen (Schlucht, Fluss, Giftnebel, Eisklippen …) lassen sich nur an Übergängen und nur mit dem passenden Werkzeug queren.
   20 Ringgrenzen bis kurz vor den Rand (LRING): die ersten 11 mit den elf Grundwerkzeugen, danach je eine neue Barriere mit einem Meisterwerkzeug
   (Stufe II eines Grundwerkzeugs, z. B. „Seil II“), das in Horten im Ring davor liegt und auch vor der Gefahr der Biome dahinter schützt.
   Im äußersten Ring liegt der Weltenrand, ganz außen die Stätten „Ende der Welt“ (Wächter, Hort, einmalige Belohnung beim ersten Besuch).
   Spielstand: SAVE.meta.lande (Statistik, Ruf, Schlüssel, Werkzeuge, Leuchtfeuer, erkundete Kartenfelder, entdeckte Regionen, Fundkiste, laufender Ausflug).
   Schnittstelle: landeActive(), landeToolGive(key), landeToolHas(key), landeDepth(), landeCtx(cx, cy, salt) (mit biome, region, rname, landmark, stage, depth, R),
     LANDE_BIOMES, LANDE_TOOLS, worldStage(depth), landeLocal(wx, wy) / landeWorld(x, y) (Welt-Pixel ↔ Spiel-Koordinaten), landePos() → { wx, wy, cx, cy },
     landeLootHTML(entry), landeLuck()/landeRar() (Seltenheit in randomItem), landePackAdd(entry) (Stapelbares in den Sammelbeutel), landeBeacons() → [{ name, x, y, i }] (Welt-Pixel),
     landePouchAdd(k, n, quiet) (k = 'gold' | Material | 'gem:<k>' | 'part:<k>' | 'mod:<k>'; false außerhalb der Lande), packCap(),
     worldQual(stage) (Qual-Stufen in einer Welt-Stufe: ab Stufe 57 je 7 Stufen eine)
   Ruft (wenn vorhanden): bossForLair, bossSpawn, bossLairReady, arteInChunk (take()), arteTreasureInChunk (open()), arteHints, arteRumor, artePickup, arteTreasureOpen,
     encounterRoll, encounterOpen (enc.teleport), eggForBiome, modRoll/modName/modIconURL/modValue/modGive/modLootHTML
   Kill-Hooks anderer Systeme, die direkt gutschreiben (P.parts, P.mods, Eier im Brutnest), landen in der Freiwelt im Rucksack (lKillPre/lKillPost).
   Der Ursprung wird nie verschoben: HOOK.shift (Teil B) wird deshalb nie gerufen.
   Beute-Einträge: { t: 'item', it } | { t: 'mat', k, n } | { t: 'gem', k, n } | { t: 'part', k, n } | { t: 'egg', d } | { t: 'gold', n } | { t: 'mod', k, n }
   ========================================================= */

/* ---------- Maße und Zufall der Welt ---------- */
const WORLD_SEED = 0x6b1a7e51;
const LCK = 768, LCT = 48, LTS = 16, LWR = 9000;          // Chunk (px, Kacheln), Kachel, Weltradius in Chunks
const LOC = 9200, LOFF = LOC * LCK, LWS = 2 * LOC * LCK;   // Ursprung: Spiel-Koordinate = Welt-Pixel + LOFF
const LRC = 6, LFLD = 384, LGC = 128, LGN = LCK / LGC;     // Regionszellen (Chunks), Kartenfeld (px), Objektraster
const LPD = LCT + 2;                                        // Kachelfelder je Chunk mit Rand (50 × 50)
function lMix(h) { h = Math.imul(h ^ h >>> 16, 0x7feb352d); h = Math.imul(h ^ h >>> 15, 0x846ca68b); return h ^ h >>> 16; }
function lH(a, b, c) { return lMix(lMix(lMix(WORLD_SEED ^ (a | 0)) + (b | 0)) + (c | 0)) >>> 0; }
function lF(a, b, c) { return lH(a, b, c) / 4294967296; }
function lSalt(s) { return typeof s === 'string' ? hashStr(s) : s | 0; }
// Wertrauschen ohne Nähte (Gitter aus Hashes), 0 … 1
function lVN(x, y, s) { const x0 = Math.floor(x), y0 = Math.floor(y), tx = x - x0, ty = y - y0, sx = tx * tx * (3 - 2 * tx), sy = ty * ty * (3 - 2 * ty), a = lF(x0, y0, s), b = lF(x0 + 1, y0, s), c = lF(x0, y0 + 1, s), d = lF(x0 + 1, y0 + 1, s); return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy; }
function lTemp(x, y) { return clamp((lVN(x / 31, y / 31, 11) * .72 + lVN(x / 9, y / 9, 12) * .28 - .5) * 2.3 + .5, 0, 1); }   // gestreckt: auch heiße und eisige Zonen
function lMoist(x, y) { return clamp((lVN(x / 27, y / 27, 13) * .72 + lVN(x / 8, y / 8, 14) * .28 - .5) * 2.3 + .5, 0, 1); }
// Verzerrung der Regionsgrenzen (Chunk-Einheiten): natürlich geschwungene Kanten
function lWarpX(x, y) { return (lVN(x / 3, y / 3, 21) - .5) * 1.8 + (lVN(x / .8, y / .8, 23) - .5) * .26; }
function lWarpY(x, y) { return (lVN(x / 3, y / 3, 22) - .5) * 1.8 + (lVN(x / .8, y / .8, 24) - .5) * .26; }

/* ---------- Schwierigkeit und Glück nach Tiefe ---------- */
// Gegnerstufe: am Tor wie das Grenzland (6), nach 1 h Fußmarsch ~28, nach 4 h ~67, am Weltrand 240 (≈ Qual 26 – fast unmöglich)
function worldStage(d) { return Math.round(6 + 234 * Math.pow(clamp(+d || 0, 0, 1), .75)); }
// Wie die Qual der Kampagne: ab Stufe 57 alle 7 Stufen ×1,3 Leben (×1,3^0,8 Schaden) – „Stufe“ heißt überall dasselbe
function lQualOf(st) { return Math.max(0, (st - 57) / 7); }
// Schnittstelle: wie viele Qual-Stufen in einer Welt-Stufe stecken (Leben ×1,3^q, Schaden ×1,3^(0,8·q)) – in den Landen wendet HOOK.spawn sie an
function worldQual(stage) { return lQualOf(+stage || 0); }
function lLuckD(d) { return 1 + 9 * Math.pow(clamp(d, 0, 1), .6); }
function lDepthC(cx, cy) { return Math.min(1, Math.hypot(cx, cy) / LWR); }

/* ---------- Werkzeuge und Barrieren ---------- */
// Ringe um das Tor (Chunks): wer über Ring k will, braucht Werkzeug k – zu finden in Horten diesseits des Rings.
// Bis 2800 wie in 6.1 (dicht am Anfang), danach alle 600–800 Chunks (≈ 1,6–2,1 h Fußmarsch) eine neue Grenze bis kurz vor den Rand (9000).
const LRING = [22, 56, 110, 190, 300, 450, 650, 920, 1300, 1900, 2800, 3600, 4350, 5050, 5700, 6300, 6900, 7500, 8100, 8700];
const LRMAX = LRING.length;   // äußerster Ring (Weltenrand)
const LANDE_TOOLS = [
  { key: 'seil', n: _t('Seil'), bar: 'schlucht', c: '#c8a070', d: _t('Ein Kletterseil mit Wurfhaken – damit kommst du an den Übergängen über Schluchten.') },
  { key: 'brueckenstein', n: _t('Brückenstein'), bar: 'fluss', c: '#9ad0ff', d: _t('Ein Stein der Alten: Er lässt eingestürzte Brücken über reißende Flüsse wieder erstehen.') },
  { key: 'kraeutermaske', n: _t('Kräutermaske'), bar: 'gift', c: '#a0d050', d: _t('Filtert Giftnebel und Giftluft. Ohne sie brennt jeder Atemzug.') },
  { key: 'eishaken', n: _t('Eishaken'), bar: 'eis', c: '#d8f0ff', d: _t('Steigeisen und Haken: Damit erklimmst du Eisklippen an den markierten Stellen.') },
  { key: 'feuermantel', n: _t('Feuermantel'), bar: 'lava', c: '#ff8a3a', d: _t('Schützt vor Lava, Hitze und eisiger Kälte. Über Lavaströme führen Trittsteine.') },
  { key: 'schattenlaterne', n: _t('Schattenlaterne'), bar: 'finster', c: '#ffe08a', d: _t('Ihr Licht durchdringt die lebendige Finsternis und vertreibt die Dunkelheit.') },
  { key: 'gezeitenperle', n: _t('Gezeitenperle'), bar: 'gezeiten', c: '#57c7e6', d: _t('Teilt die Fluten: An den Pfeilern der Alten trägt dich das Wasser.') },
  { key: 'dornenklinge', n: _t('Dornenklinge'), bar: 'dornen', c: '#79c24e', d: _t('Schneidet Wege durch Dornenwälle, die nichts anderes durchdringt.') },
  { key: 'sturmfeder', n: _t('Sturmfeder'), bar: 'sturm', c: '#c8d0e0', d: _t('Hält dich im Auge des Sturms – Sturmwände und Böen werfen dich nicht mehr zurück.') },
  { key: 'sternenschluessel', n: _t('Sternenschlüssel'), bar: 'siegel', c: '#b0b8ff', d: _t('Öffnet die uralten Siegel der Sternentore.') },
  { key: 'leereanker', n: _t('Leere-Anker'), bar: 'leere', c: '#c060ff', d: _t('Verankert dich in der Wirklichkeit – über Leere-Risse und durch das Nichts.') },
  // Meisterwerkzeuge (Stufe II): je eine neue Grenze ab 3600 Chunks, Horte im Ring davor; b = Grundwerkzeug (Bild)
  { key: 'seil2', b: 0, n: _t('Seil II'), bar: 'kluft', c: '#9ab8ff', d: _t('Ein Seil aus Sternenfaden mit Kristallhaken – es hält auch über der Kristallkluft, wo jedes andere Seil zerschneidet.') },
  { key: 'kraeutermaske2', b: 2, n: _t('Kräutermaske II'), bar: 'blutnebel', c: '#ff6a7a', d: _t('Gefüllt mit Kräutern vom Rand der Welt: Sie filtert die Wand aus Blutnebel, den Blutdunst der Sümpfe und die Sporenluft der Pilzriesen.') },
  { key: 'eishaken2', b: 3, n: _t('Eishaken II'), bar: 'abbruch', c: '#e8f4ff', d: _t('Haken aus Himmelsstahl: Damit kletterst du am Himmelsabbruch entlang, und kein Höhensturm reißt dich fort.') },
  { key: 'brueckenstein2', b: 1, n: _t('Brückenstein II'), bar: 'seelenstrom', c: '#9af0e0', d: _t('Ein Stein der Alten, der Brücken über den Seelenstrom baut. Sein Licht hält auch den Seelensog von dir fern.') },
  { key: 'feuermantel2', b: 4, n: _t('Feuermantel II'), bar: 'sternglut', c: '#ffd04a', d: _t('Gewebt aus Sternenfeuer: schützt vor Sternenglut und Grabeskälte. Über die Glutströme führen schwebende Steine.') },
  { key: 'schattenlaterne2', b: 5, n: _t('Schattenlaterne II'), bar: 'traum', c: '#e0b0ff', d: _t('Ihr Licht weckt dich aus jedem Traum: Sie zerreißt den Traumschleier und vertreibt den Traumnebel.') },
  { key: 'gezeitenperle2', b: 6, n: _t('Gezeitenperle II'), bar: 'zeitstrom', c: '#ffe08a', d: _t('Eine Perle aus erstarrter Zeit: An den Stundenpfeilern hält sie den Zeitstrom an und schützt vor dem Zeitsog.') },
  { key: 'dornenklinge2', b: 7, n: _t('Dornenklinge II'), bar: 'splitter', c: '#c8f0ff', d: _t('Geschmiedet aus Sternensplittern: Sie schneidet Wege durch Splitterwälle und zerschlägt den Splitterregen.') },
  { key: 'sternenschluessel2', b: 9, n: _t('Sternenschlüssel II'), bar: 'weltsiegel', c: '#ffe8a0', d: _t('Der Schlüssel zum Siegel der Welt. Dahinter liegt nur noch der Weltenrand – und das Ende der Welt.') }
];
const LTOOLK = {}; LANDE_TOOLS.forEach((t, i) => { t.i = i; LTOOLK[t.key] = i; });
// Barrieren: w = halbe Breite in Kacheln, c = Farben (Grund, Tiefe, Licht, Rand), x = Übergang (Aussehen), haz = Gefahr in Biomen
const LBAR = {
  schlucht: { n: _t('Schlucht'), w: 2.6, c: ['#120e18', '#060408', '#2a2430', '#625c68'], x: 'planken' },
  fluss: { n: _t('Reißender Fluss'), w: 2.3, c: ['#2e5a7a', '#14243a', '#6ab0d8', '#4a6a3a'], x: 'bruecke' },
  gift: { n: _t('Giftnebel'), w: 3, c: ['#3a5a1e', '#1e2a12', '#a0d050', '#2a3a1a'], x: 'pfad' },
  eis: { n: _t('Eisklippen'), w: 2.5, c: ['#a8d0e8', '#5a7898', '#e8f8ff', '#3e5064'], x: 'stufen' },
  lava: { n: _t('Lavastrom'), w: 2.5, c: ['#c8401e', '#7a1e10', '#ff8a3a', '#2a120c'], x: 'steine' },
  finster: { n: _t('Lebendige Finsternis'), w: 3, c: ['#0a0612', '#000000', '#2a1a3a', '#3a2a4a'], x: 'licht' },
  gezeiten: { n: _t('Tosende Fluten'), w: 3.3, c: ['#1e3a6a', '#0e1a3a', '#8ab8ff', '#2a4a6a'], x: 'pfeiler' },
  dornen: { n: _t('Dornenwall'), w: 2.3, c: ['#1e3a14', '#0e1e0a', '#c8b070', '#2e5a1e'], x: 'schneise' },
  sturm: { n: _t('Sturmwand'), w: 3, c: ['#5a6070', '#3a404c', '#c8d0e0', '#6a7080'], x: 'licht' },
  siegel: { n: _t('Uraltes Siegel'), w: 2.1, c: ['#4a4652', '#2e2a36', '#e8b04a', '#6a6672'], x: 'tor' },
  leere: { n: _t('Leere-Riss'), w: 3.4, c: ['#050208', '#000000', '#b892f4', '#2a1640'], x: 'anker' },
  rand: { n: _t('Rand der Welt'), w: 99, c: ['#000000', '#000000', '#ffffff', '#8a6ac0'], x: null },
  // Grenzen der Tiefe (Meisterwerkzeuge) – manche auch als örtliche Barriere mit Brücke in passenden Biomen
  kluft: { n: _t('Kristallkluft'), w: 2.8, c: ['#14122a', '#06040e', '#8ab0ff', '#4a4a7a'], x: 'kseil' },
  blutnebel: { n: _t('Blutnebel'), w: 3, c: ['#5a1420', '#2a0810', '#ff6a7a', '#3a1018'], x: 'kraut' },
  abbruch: { n: _t('Himmelsabbruch'), w: 3, c: ['#7aa8e0', '#4a78b8', '#ffffff', '#3a4a6a'], x: 'schwebe' },
  seelenstrom: { n: _t('Seelenstrom'), w: 3, c: ['#1e5a58', '#0e2a30', '#9af0e0', '#2a4a48'], x: 'gebein' },
  sternglut: { n: _t('Sternenglut'), w: 2.8, c: ['#e8a020', '#a85010', '#fff0a0', '#3a1a08'], x: 'glutstein' },
  traum: { n: _t('Traumschleier'), w: 3.2, c: ['#4a3a6a', '#2a1e40', '#ffc0f0', '#3a2a50'], x: 'wachlicht' },
  zeitstrom: { n: _t('Zeitstrom'), w: 3.2, c: ['#3a3858', '#1a1a30', '#ffe08a', '#2a2a40'], x: 'stunde' },
  splitter: { n: _t('Splitterwall'), w: 2.6, c: ['#3a4656', '#1e2632', '#e8f8ff', '#6a7a8a'], x: 'schnitt' },
  weltsiegel: { n: _t('Siegel der Welt'), w: 2.4, c: ['#2a2440', '#140e24', '#ffd24a', '#4a4060'], x: 'weltor' }
};
const LBARK = Object.keys(LBAR); LBARK.forEach((k, i) => { LBAR[k].i = i; LBAR[k].key = k; });
// Gefahren der Biome: welches Werkzeug schützt
const LHAZ = {
  gift: { n: _t('Giftluft'), tool: 2, c: '#a0d050', s: _t('Giftluft! Ohne Kräutermaske brennt jeder Atemzug.') },
  kalt: { n: _t('Eisige Kälte'), tool: 4, c: '#bfefff', s: _t('Eisige Kälte! Ohne Feuermantel wirst du langsam und frierst.') },
  hitze: { n: _t('Glühende Hitze'), tool: 4, c: '#ff8a3a', s: _t('Glühende Hitze! Ohne Feuermantel versengt sie dich.') },
  dunkel: { n: _t('Finsternis'), tool: 5, c: '#8a7aa8', s: _t('Finsternis! Ohne Schattenlaterne siehst du kaum die Hand vor Augen.') },
  sturm: { n: _t('Sturm'), tool: 8, c: '#c8d0e0', s: _t('Sturm! Ohne Sturmfeder werfen dich die Böen umher.') },
  leere: { n: _t('Sog der Leere'), tool: 10, c: '#c060ff', s: _t('Die Leere saugt an deiner Kraft! Ohne Leere-Anker schwindet sie.') },
  // Gefahren der Tiefe: Schutz durch das Meisterwerkzeug aus demselben Ring
  blut: { n: _t('Blutdunst'), tool: 12, c: '#ff6a7a', s: _t('Blutdunst! Ohne Kräutermaske II saugt er dir das Leben aus.') },
  sporen: { n: _t('Sporenluft'), tool: 12, c: '#c8a0ff', s: _t('Sporenluft! Ohne Kräutermaske II vergiftet sie dich.') },
  hoehe: { n: _t('Höhensturm'), tool: 13, c: '#e8f4ff', s: _t('Höhensturm! Ohne Eishaken II reißt er dich von den Füßen.') },
  seelen: { n: _t('Seelensog'), tool: 14, c: '#9af0e0', s: _t('Seelensog! Ohne Brückenstein II zehren die Seelen an Kraft und Leben.') },
  glut: { n: _t('Sternenglut'), tool: 15, c: '#ffd04a', s: _t('Sternenglut! Ohne Feuermantel II verbrennst du.') },
  frost: { n: _t('Grabeskälte'), tool: 15, c: '#d8f0ff', s: _t('Grabeskälte! Ohne Feuermantel II erstarrst du.') },
  traum: { n: _t('Traumnebel'), tool: 16, c: '#e0b0ff', s: _t('Traumnebel! Ohne Schattenlaterne II wirst du müde und siehst kaum etwas.') },
  zeit: { n: _t('Zeitsog'), tool: 17, c: '#ffe08a', s: _t('Zeitsog! Ohne Gezeitenperle II zerrt die Zeit an dir.') },
  splitter: { n: _t('Splitterregen'), tool: 18, c: '#c8f0ff', s: _t('Splitterregen! Ohne Dornenklinge II schneiden dich die Splitter.') }
};
// Pfützen der Tiefe (js/world.js kennt Wasser, Gift, Eis, Lava): Farben wie POOLCOL, Wirkung hier (slow = Bremse, dmg = Schaden je ½ s, res = Kraft-Sog je s)
const LPOOLX = {
  blut: { c: ['#2a0608', '#7a1018', '#ff5a6a'], dmg: [4, 1] },
  stern: { c: ['#0a0e2a', '#1e2a6a', '#c0d0ff'], slow: .15 },
  mond: { c: ['#3a4a6a', '#9ab0d8', '#ffffff'], slow: .15 },
  seelen: { c: ['#0a2a2a', '#2a8a80', '#bfffee'], slow: .2, res: .06 },
  glas: { c: ['#3a5a6a', '#9ad8e8', '#ffffff'], dmg: [5, 1.2] },
  bernstein: { c: ['#5a2a08', '#c87a1a', '#ffd070'], slow: .5 },
  zeit: { c: ['#2a2a40', '#8a7a3a', '#ffe08a'], slow: .3, res: .04 },
  leere: { c: ['#050208', '#1a0a2e', '#c060ff'], dmg: [4, .8], res: .05 }
};
function lPC(k) { return LPOOLX[k] ? LPOOLX[k].c : POOLCOL[k] || POOLCOL.wasser; }
// Die neuen Pfützen bei js/world.js anmelden (Zeichnen und Teilchen dort lesen POOLCOL) – world.js lädt erst nach dieser Datei
function lPoolReg() { if (typeof POOLCOL === 'undefined') return; for (const k in LPOOLX) if (!POOLCOL[k]) POOLCOL[k] = LPOOLX[k].c; }

/* ---------- Biome (über 70): Boden, Pflanzen, Pfützen, Teilchen, Musik, Bewohner, Gefahren ---------- */
// g = Bodenfarben (Grund, Abwandlungen, die dritte ist die Kartenfarbe), tx = Bodenart, tr = Bäume/Pflanzen ('art.variante'), td/rk = Dichte, rv = Fels-Farbe,
// pool/lk = Pfützenart und Seen je Chunk, deco = Kleinkram, amb = Schwebeteilchen, mus = Grundton, en = Bewohner, et/ea = Abwandlung der Gegner (Tönung, Affix),
// haz = Gefahr, dark = Dunkel, vein = Erz, r = Ringe (von, bis), t/m = Wärme und Feuchte (zur Wahl je Region), pl = Ortsnamen, lb = lokale Barriere
const LANDE_BIOMES = {
  wiese: { n: _t('Blumenwiese'), g: ['#4c7a32', '#44702c', '#58883a', '#3c6628'], tx: 'gras', tr: ['eiche.0', 'eiche.2', 'herbst.0', 'busch.0'], td: .03, rk: .01, pool: 'wasser', lk: .3, deco: 'blume', amb: 'pollen', mus: 45, en: ['goblin', 'gobarcher', 'lizard', 'bomber', 'kuerbis', 'slime', 'orc'], r: [0, 1], t: .55, m: .5, lb: 'fluss', pl: [_t('Blütenau'), _t('Sonnenwiese'), _t('Hirtenflur')] },
  wald: { n: _t('Eichenwald'), g: ['#2e5426', '#284a20', '#36602e', '#223e1a'], tx: 'gras', tr: ['eiche.0', 'eiche.1', 'tanne.0', 'eiche.1'], td: .28, rk: .01, pool: 'wasser', lk: .15, deco: 'pilz', amb: 'moss', mus: 43, en: ['lizard', 'lizshaman', 'slime', 'orc', 'wurm', 'elfe', 'gobarcher', 'hexe'], r: [0, 2], t: .5, m: .68, lb: 'fluss', pl: [_t('Flüsterwald'), _t('Dämmerforst'), _t('Eichenhang')] },
  hain: { n: _t('Birkenhain'), g: ['#5a8a3a', '#507e34', '#6a9a44', '#46722e'], tx: 'gras', tr: ['birke.0', 'birke.0', 'busch.0'], td: .16, rk: .006, pool: 'wasser', lk: .2, deco: 'blume', amb: 'pollen', mus: 47, en: ['goblin', 'elfe', 'lizard', 'slime', 'gobarcher', 'kuerbis'], r: [0, 1], t: .38, m: .5, lb: 'fluss', pl: [_t('Birkenhain'), _t('Lichtwald'), _t('Silberhain')] },
  heide: { n: _t('Heideland'), g: ['#6a5a4a', '#5e5040', '#7a6a58', '#4e4236'], tx: 'erde', tr: ['busch.2', 'tot.0', 'busch.2'], td: .05, rk: .02, deco: 'heide', amb: '', mus: 44, en: ['goblin', 'bomber', 'orc', 'berserker', 'ogre', 'gobarcher'], r: [0, 1], t: .45, m: .28, lb: 'schlucht', pl: [_t('Heide'), _t('Krähenmoor'), _t('Windheide')] },
  ruine: { n: _t('Ruinenfeld'), g: ['#55524e', '#4b4844', '#625e58', '#423f3b'], tx: 'floor', tr: ['tot.0', 'saeule.0'], td: .02, rk: .02, deco: 'knochen', amb: 'gruft', mus: 41, en: ['skeleton', 'skelarcher', 'mage', 'geist', 'skelmage', 'zombie'], r: [0, 3], t: .5, m: .4, lb: 'schlucht', pl: [_t('Trümmerfeld'), _t('Alte Feste'), _t('Gefallene Stadt')] },
  fels: { n: _t('Felsland'), g: ['#6a6152', '#5f5648', '#776d5d', '#534a3e'], tx: 'stein', tr: ['tot.0'], td: .02, rk: .07, deco: 'kies', amb: '', mus: 42, en: ['skeleton', 'skelarcher', 'zwerg', 'golem', 'ogre', 'bomber'], r: [0, 2], t: .4, m: .18, lb: 'schlucht', pl: [_t('Steinhöhen'), _t('Geröllfeld'), _t('Felsenpass')] },
  seen: { n: _t('Seenplatte'), g: ['#46783a', '#3e6e34', '#548a44', '#36602e'], tx: 'gras', tr: ['weide.0', 'schilf.0', 'busch.0'], td: .07, rk: .006, pool: 'wasser', lk: 2.4, deco: 'schilf', amb: 'pollen', mus: 47, en: ['slime', 'lizard', 'lizshaman', 'toxslime', 'wurm', 'icez'], r: [0, 2], t: .5, m: .92, lb: 'fluss', pl: [_t('Spiegelseen'), _t('Schilfland'), _t('Tausend Teiche')] },
  tannen: { n: _t('Tannenforst'), g: ['#2a4a34', '#24422e', '#34583e', '#1e3a28'], tx: 'gras', tr: ['tanne.0', 'tanne.0', 'tot.0'], td: .26, rk: .02, pool: 'wasser', lk: .1, deco: 'pilz', amb: '', mus: 42, en: ['orc', 'berserker', 'wurm', 'elfe', 'ogre', 'skelarcher'], r: [1, 2], t: .3, m: .6, lb: 'schlucht', pl: [_t('Tannendunkel'), _t('Nadelforst'), _t('Harzwald')] },
  moor: { n: _t('Moor'), g: ['#3c4a2c', '#344222', '#475a32', '#2c3a1e'], tx: 'erde', tr: ['tot.0', 'eiche.1', 'schilf.0'], td: .07, rk: .01, pool: 'gift', lk: 1, deco: 'schilf', amb: 'moss', mus: 42, en: ['toxslime', 'seuche', 'hexe', 'wurm', 'lizshaman', 'slime'], r: [1, 2], t: .5, m: .85, lb: 'fluss', pl: [_t('Nebelmoor'), _t('Irrlichtsumpf'), _t('Krötengrund')] },
  schnee: { n: _t('Schneefeld'), g: ['#d6e2ec', '#c8d6e2', '#e6eef6', '#b4c4d2'], tx: 'schnee', tr: ['schnee.0', 'schnee.0', 'tot.0'], td: .1, rk: .03, rv: 1, pool: 'eis', lk: .4, deco: 'eis', amb: 'schnee', mus: 47, en: ['icez', 'eisgeist', 'frostoger', 'skelarcher', 'golem', 'elfe'], r: [1, 3], t: .08, m: .5, lb: 'schlucht', pl: [_t('Schneefelder'), _t('Weißer Hang'), _t('Frostebene')] },
  herbst: { n: _t('Herbstwald'), g: ['#5a4a2a', '#504222', '#6a5832', '#463a1e'], tx: 'gras', tr: ['herbst.0', 'herbst.0', 'busch.1', 'eiche.2'], td: .2, rk: .01, pool: 'wasser', lk: .2, deco: 'laub', amb: 'blatt', mus: 44, en: ['kuerbis', 'goblin', 'orc', 'lizard', 'hexe', 'berserker'], r: [1, 2], t: .45, m: .55, lb: 'fluss', pl: [_t('Goldlaubwald'), _t('Kupferhain'), _t('Rotblattforst')] },
  steppe: { n: _t('Grassteppe'), g: ['#8a8a3a', '#7e7e34', '#9a9a48', '#6e6e2e'], tx: 'gras', tr: ['busch.1', 'tot.0'], td: .02, rk: .012, rv: 3, deco: 'kies', amb: 'pollen', mus: 46, en: ['orc', 'berserker', 'ogre', 'bomber', 'gobarcher', 'zwerg'], r: [1, 3], t: .68, m: .25, lb: 'schlucht', pl: [_t('Weite Steppe'), _t('Pferdeland'), _t('Goldgras')] },
  pilz: { n: _t('Pilzwald'), g: ['#3a2e3a', '#322832', '#463846', '#2a222a'], tx: 'erde', tr: ['pilz.0', 'pilz.1', 'pilz.2', 'pilz.0'], td: .14, rk: .01, pool: 'gift', lk: .3, deco: 'pilz', amb: 'sporen', mus: 41, en: ['slime', 'toxslime', 'wurm', 'hexe', 'mage', 'kuerbis'], r: [1, 3], t: .5, m: .8, et: 'rgba(170,90,200,.22)', lb: 'fluss', pl: [_t('Sporenwald'), _t('Hutpilzhain'), _t('Glimmgrund')] },
  huegel: { n: _t('Hügelgräber'), g: ['#4a5a44', '#42523c', '#566650', '#3a4834'], tx: 'gras', tr: ['grab.0', 'tot.0', 'grab.1'], td: .04, rk: .02, deco: 'knochen', amb: 'gruft', dark: .08, mus: 40, en: ['skeleton', 'zombie', 'geist', 'mage', 'skelarcher', 'todesritter'], r: [1, 3], t: .4, m: .45, lb: 'schlucht', pl: [_t('Hügelgräber'), _t('Ahnenfeld'), _t('Totenhügel')] },
  giftmoor: { n: _t('Giftmoor'), g: ['#3a4a1e', '#324018', '#4a5a26', '#2a3614'], tx: 'erde', tr: ['tot.0', 'tot.0', 'schilf.1'], td: .06, rk: .01, pool: 'gift', lk: 1.6, deco: 'schilf', amb: 'giftsporen', mus: 40, haz: 'gift', en: ['toxslime', 'seuche', 'hexe', 'wurm', 'slime', 'lizshaman'], r: [2, 4], t: .55, m: .95, et: 'rgba(120,220,60,.25)', lb: 'fluss', pl: [_t('Giftmoor'), _t('Faulsumpf'), _t('Pestgrund')] },
  canyon: { n: _t('Rote Schlucht'), g: ['#8a4a2e', '#7e4228', '#9a5a3a', '#6e3a22'], tx: 'stein', tr: ['kaktus.0', 'tot.0'], td: .03, rk: .06, rv: 4, deco: 'kies', amb: 'sand', mus: 44, en: ['zwerg', 'bomber', 'golem', 'ogre', 'imp', 'berserker'], r: [2, 3], t: .78, m: .1, lb: 'schlucht', pl: [_t('Rote Schlucht'), _t('Sonnenklamm'), _t('Rostfelsen')] },
  dornen: { n: _t('Dornendickicht'), g: ['#2a3a1e', '#24341a', '#344826', '#1e2c16'], tx: 'gras', tr: ['dorn.0', 'dorn.0', 'busch.0', 'eiche.1'], td: .22, rk: .01, deco: 'laub', amb: '', mus: 41, en: ['elfe', 'hexe', 'lizard', 'wurm', 'kuerbis', 'orc'], r: [2, 4], t: .55, m: .62, lb: 'fluss', pl: [_t('Dornengrund'), _t('Stachelwald'), _t('Rosendickicht')] },
  tundra: { n: _t('Tundra'), g: ['#8a9488', '#7e887c', '#9aa498', '#6e786c'], tx: 'erde', tr: ['tot.0', 'busch.3'], td: .03, rk: .03, rv: 1, pool: 'eis', lk: .3, deco: 'kies', amb: 'schnee', mus: 46, en: ['frostoger', 'icez', 'eisgeist', 'skelarcher', 'ogre', 'zwerg'], r: [2, 4], t: .15, m: .3, lb: 'schlucht', pl: [_t('Kalte Weite'), _t('Flechtenland'), _t('Graue Tundra')] },
  kueste: { n: _t('Sturmküste'), g: ['#c8b88a', '#bcac7e', '#d8c89a', '#a89870'], tx: 'sand', tr: ['palme.0', 'busch.0', 'tot.0'], td: .04, rk: .02, rv: 3, pool: 'wasser', lk: 1.4, deco: 'sand', amb: '', mus: 45, en: ['lizard', 'lizshaman', 'slime', 'toxslime', 'orc', 'gobarcher'], r: [2, 4], t: .55, m: .78, lb: 'fluss', pl: [_t('Muschelstrand'), _t('Sturmbucht'), _t('Salzküste')] },
  friedhof: { n: _t('Grabfeld'), g: ['#3e463e', '#363e36', '#4a524a', '#2e362e'], tx: 'erde', tr: ['grab.0', 'grab.1', 'tot.0'], td: .08, rk: .01, deco: 'knochen', amb: 'gruft', dark: .14, mus: 39, en: ['skeleton', 'skelmage', 'geist', 'zombie', 'mage', 'todesritter'], r: [2, 5], t: .4, m: .5, lb: 'schlucht', pl: [_t('Stille Gräber'), _t('Knochenacker'), _t('Rabenfriedhof')] },
  gletscher: { n: _t('Gletscher'), g: ['#b8d8ec', '#a8cce4', '#d0e8f8', '#90b4d0'], tx: 'eis', tr: ['eisz.0', 'eisz.1', 'schnee.0'], td: .05, rk: .04, rv: 1, pool: 'eis', lk: .8, deco: 'eis', amb: 'schnee', mus: 48, haz: 'kalt', en: ['icez', 'eisgeist', 'frostoger', 'golem', 'elfe'], r: [3, 5], t: .02, m: .55, ea: 'frostig', lb: 'schlucht', pl: [_t('Blaugletscher'), _t('Eiszunge'), _t('Gletscherbruch')] },
  wueste: { n: _t('Sandwüste'), g: ['#d8b06a', '#cca460', '#e8c080', '#b89050'], tx: 'sand', tr: ['kaktus.0', 'palme.0', 'kaktus.0'], td: .02, rk: .015, rv: 3, deco: 'sand', amb: 'sand', mus: 46, haz: 'hitze', en: ['imp', 'chort', 'pyro', 'glutschleim', 'skeleton', 'golem'], r: [3, 5], t: .92, m: .05, lb: 'schlucht', pl: [_t('Glutsande'), _t('Dünenmeer'), _t('Durstwüste')] },
  dschungel: { n: _t('Dschungel'), g: ['#1e4a1e', '#1a421a', '#285a26', '#143a14'], tx: 'gras', tr: ['eiche.11', 'palme.0', 'eiche.11', 'busch.0'], td: .3, rk: .006, pool: 'wasser', lk: .5, deco: 'blume', amb: 'moss', mus: 44, en: ['lizard', 'lizshaman', 'wurm', 'hexe', 'toxslime', 'elfe'], r: [3, 5], t: .88, m: 1, lb: 'fluss', pl: [_t('Grüne Hölle'), _t('Lianenwald'), _t('Dampfdschungel')] },
  salz: { n: _t('Salzebene'), g: ['#d8d4cc', '#ccc8c0', '#e8e4dc', '#b8b4ac'], tx: 'salz', tr: ['salzk.0', 'salzk.0', 'tot.0'], td: .03, rk: .015, rv: 6, deco: 'salz', amb: '', mus: 47, en: ['golem', 'skeleton', 'skelarcher', 'zwerg', 'imp'], r: [3, 5], t: .7, m: .12, lb: 'schlucht', pl: [_t('Weiße Öde'), _t('Salzspiegel'), _t('Kristallpfanne')] },
  kristall: { n: _t('Kristallfelder'), g: ['#3a3a6a', '#343462', '#46467a', '#2a2a52'], tx: 'kristall', tr: ['kristall.0', 'kristall.1', 'kristall.0'], td: .06, rk: .03, rv: 7, deco: 'kristall', amb: 'stern', mus: 48, en: ['golem', 'icez', 'mage', 'skelmage', 'eisgeist', 'engel'], r: [3, 6], t: .3, m: .4, et: 'rgba(120,180,255,.3)', lb: 'schlucht', pl: [_t('Kristallgrund'), _t('Singende Felder'), _t('Prismenhang')] },
  asche: { n: _t('Aschefeld'), g: ['#3e3537', '#352d2f', '#483e40', '#2c2527'], tx: 'asche', tr: ['tot.1', 'kohle.0'], td: .05, rk: .04, rv: 2, deco: 'glut', amb: 'asche', mus: 40, haz: 'hitze', en: ['imp', 'chort', 'pyro', 'glutschleim', 'lavadaemon', 'schattenimp'], r: [4, 6], t: .8, m: .2, lb: 'schlucht', pl: [_t('Aschefelder'), _t('Brandland'), _t('Rußebene')] },
  vulkan: { n: _t('Vulkanhang'), g: ['#2e2422', '#261e1c', '#3a2e2a', '#1e1614'], tx: 'lava', tr: ['obs.0', 'kohle.0', 'obs.0'], td: .04, rk: .05, rv: 2, pool: 'lava', lk: 1, deco: 'glut', amb: 'glut', mus: 38, haz: 'hitze', en: ['lavadaemon', 'imp', 'chort', 'glutschleim', 'jungdrache', 'golem'], r: [4, 6], t: .97, m: .08, ea: 'brennend', lb: 'schlucht', pl: [_t('Feuerberg'), _t('Schlackenhang'), _t('Glutkessel')] },
  blutmoor: { n: _t('Blutmoor'), g: ['#4a2a26', '#422420', '#5a322e', '#3a1e1a'], tx: 'blut', tr: ['eiche.7', 'tot.1', 'schilf.1'], td: .08, rk: .01, pool: 'gift', lk: 1.2, deco: 'blut', amb: 'sporen', mus: 39, en: ['zombie', 'seuche', 'hexe', 'toxslime', 'todesritter', 'wurm'], r: [4, 6], t: .6, m: .88, ea: 'vampir', lb: 'fluss', pl: [_t('Blutmoor'), _t('Roter Sumpf'), _t('Wundengrund')] },
  eiswueste: { n: _t('Ewiges Eis'), g: ['#e8f0f8', '#dce8f2', '#f4f8fc', '#c8d8e8'], tx: 'schnee', tr: ['eisz.1', 'eisz.0'], td: .03, rk: .03, rv: 1, pool: 'eis', lk: .6, deco: 'eis', amb: 'schnee', mus: 48, haz: 'kalt', en: ['frostoger', 'eisgeist', 'icez', 'golem', 'todesritter'], r: [4, 7], t: 0, m: .25, ea: 'frostig', lb: 'schlucht', pl: [_t('Ewiges Eis'), _t('Weiße Stille'), _t('Frostthron')] },
  lava: { n: _t('Glutland'), g: ['#2e201c', '#261a16', '#3a2822', '#1e1410'], tx: 'lava', tr: ['kohle.0', 'obs.0'], td: .02, rk: .06, rv: 2, pool: 'lava', lk: 1.4, deco: 'glut', amb: 'glut', mus: 38, haz: 'hitze', en: ['imp', 'chort', 'lavadaemon', 'jungdrache', 'golem', 'glutschleim', 'pyro'], r: [5, 7], t: 1, m: 0, ea: 'brennend', lb: 'schlucht', pl: [_t('Glutland'), _t('Feuermeer'), _t('Schmelzgrund')] },
  obsidian: { n: _t('Obsidianfeld'), g: ['#1a1622', '#14101c', '#241e2e', '#0e0a14'], tx: 'stein', tr: ['obs.0', 'obs.1', 'kohle.0'], td: .05, rk: .05, rv: 5, pool: 'lava', lk: .4, deco: 'glut', amb: 'glut', mus: 38, en: ['lavadaemon', 'golem', 'schattenimp', 'pyro', 'todesritter'], r: [5, 7], t: .85, m: .2, lb: 'schlucht', pl: [_t('Glasfelder'), _t('Schwarzer Spiegel'), _t('Obsidiankamm')] },
  nebelwald: { n: _t('Nebelwald'), g: ['#3a4448', '#343e42', '#465054', '#2a3438'], tx: 'gras', tr: ['eiche.10', 'eiche.6', 'tot.0'], td: .22, rk: .01, pool: 'wasser', lk: .3, deco: 'pilz', amb: 'nebel', dark: .22, mus: 41, haz: 'dunkel', en: ['geist', 'eisgeist', 'hexe', 'elfe', 'schattenimp', 'mage'], r: [5, 7], t: .4, m: .78, lb: 'fluss', pl: [_t('Nebelwald'), _t('Grauforst'), _t('Schleierhain')] },
  schattenwald: { n: _t('Schattenwald'), g: ['#221c30', '#1c1828', '#2c2440', '#16121e'], tx: 'gras', tr: ['eiche.4', 'eiche.4', 'tot.1'], td: .24, rk: .01, deco: 'stern', amb: 'schatten', dark: .32, mus: 38, haz: 'dunkel', en: ['todesritter', 'engel', 'schattenimp', 'elfe', 'skelmage', 'geist'], r: [6, 8], t: .4, m: .6, et: 'rgba(60,30,120,.35)', lb: 'schlucht', pl: [_t('Schattenwald'), _t('Nachtforst'), _t('Mondloser Hain')] },
  knochenoede: { n: _t('Knochenöde'), g: ['#b0a488', '#a49880', '#c0b498', '#908470'], tx: 'sand', tr: ['knochen.0', 'knochen.1', 'tot.0'], td: .04, rk: .02, rv: 6, deco: 'knochen', amb: 'gruft', mus: 39, en: ['skeleton', 'skelarcher', 'skelmage', 'zombie', 'todesritter', 'mage'], r: [6, 8], t: .72, m: .1, lb: 'schlucht', pl: [_t('Knochenöde'), _t('Gebeinwüste'), _t('Ödes Gerippe')] },
  geisterebene: { n: _t('Geisterebene'), g: ['#6a7888', '#627080', '#7a8898', '#526070'], tx: 'erde', tr: ['grab.1', 'eiche.6', 'tot.0'], td: .05, rk: .02, deco: 'stern', amb: 'geist', dark: .18, mus: 40, en: ['geist', 'eisgeist', 'mage', 'skelmage', 'engel'], r: [6, 9], t: .3, m: .5, et: 'rgba(200,230,255,.4)', lb: 'schlucht', pl: [_t('Geisterebene'), _t('Seufzerfeld'), _t('Fahle Weite')] },
  riff: { n: _t('Versteinertes Riff'), g: ['#5a8a9a', '#528090', '#6a9aaa', '#467480'], tx: 'sand', tr: ['koralle.0', 'koralle.1', 'koralle.2'], td: .07, rk: .02, rv: 8, pool: 'wasser', lk: .9, deco: 'sand', amb: 'blasen', mus: 46, en: ['lizshaman', 'lizard', 'slime', 'toxslime', 'wurm', 'icez'], r: [7, 9], t: .6, m: .92, lb: 'fluss', pl: [_t('Steinriff'), _t('Korallengrund'), _t('Muschelthron')] },
  spiegelsee: { n: _t('Spiegelsee'), g: ['#8a9ab0', '#8090a6', '#9aaac0', '#70809a'], tx: 'kristall', tr: ['kristall.3', 'weide.1', 'kristall.3'], td: .05, rk: .01, rv: 7, pool: 'wasser', lk: 2, deco: 'stern', amb: 'stern', mus: 48, en: ['engel', 'eisgeist', 'icez', 'elfe', 'mage'], r: [7, 9], t: .4, m: .96, lb: 'fluss', pl: [_t('Silberspiegel'), _t('Stille Wasser'), _t('Gläserner See')] },
  uralt: { n: _t('Uralter Wald'), g: ['#1a3a2e', '#163428', '#224838', '#102a20'], tx: 'gras', tr: ['eiche.9', 'riese.0', 'eiche.9', 'eiche.9'], td: .26, rk: .01, pool: 'wasser', lk: .2, deco: 'pilz', amb: 'moss', dark: .12, mus: 43, en: ['elfe', 'hexe', 'wurm', 'golem', 'ogre', 'lizshaman'], r: [7, 10], t: .5, m: .72, lb: 'fluss', pl: [_t('Urwald'), _t('Wurzelreich'), _t('Ahnenforst')] },
  sturmklippen: { n: _t('Sturmklippen'), g: ['#5a6068', '#525860', '#6a7078', '#464c54'], tx: 'stein', tr: ['tot.0', 'busch.3'], td: .02, rk: .07, rv: 0, deco: 'kies', amb: 'regen', dark: .1, mus: 44, haz: 'sturm', en: ['engel', 'imp', 'golem', 'frostoger', 'zwerg', 'schattenimp'], r: [8, 10], t: .3, m: .55, ea: 'schnell', lb: 'schlucht', pl: [_t('Sturmklippen'), _t('Donnerkamm'), _t('Heulende Felsen')] },
  drachenland: { n: _t('Drachenland'), g: ['#6a3a1e', '#5e321a', '#7a4826', '#4e2a14'], tx: 'asche', tr: ['knochen.2', 'kohle.0', 'obs.0'], td: .03, rk: .05, rv: 2, pool: 'lava', lk: .6, deco: 'glut', amb: 'asche', mus: 40, en: ['jungdrache', 'lavadaemon', 'chort', 'imp', 'golem', 'pyro'], r: [8, 10], t: .85, m: .3, lb: 'schlucht', pl: [_t('Drachenmark'), _t('Schuppenland'), _t('Hort der Schwingen')] },
  traumwiese: { n: _t('Traumwiese'), g: ['#7a6a9a', '#706090', '#8a7aaa', '#605084'], tx: 'gras', tr: ['eiche.5', 'eiche.3', 'busch.4'], td: .08, rk: .005, pool: 'wasser', lk: .4, deco: 'blume', amb: 'stern', mus: 49, en: ['engel', 'elfe', 'kuerbis', 'hexe', 'geist'], r: [8, 10], t: .5, m: .6, lb: 'fluss', pl: [_t('Traumwiese'), _t('Schlummerau'), _t('Wolkenflur')] },
  sternenfeld: { n: _t('Sternenfeld'), g: ['#1a1e3a', '#161a32', '#22284a', '#10142a'], tx: 'leere', tr: ['sternbaum.0', 'kristall.0', 'sternbaum.0'], td: .05, rk: .02, rv: 7, deco: 'stern', amb: 'stern', dark: .2, mus: 48, en: ['engel', 'schattenimp', 'skelmage', 'todesritter', 'elfe'], r: [9, 10], t: .3, m: .4, lb: 'schlucht', pl: [_t('Sternenfeld'), _t('Himmelsgrund'), _t('Funkelöde')] },
  goetterhain: { n: _t('Götterhain'), g: ['#9a8a3a', '#8e7e34', '#aa9a48', '#7e6e2e'], tx: 'gras', tr: ['eiche.8', 'saeule.0', 'eiche.8', 'statue.0'], td: .1, rk: .01, rv: 6, pool: 'wasser', lk: .3, deco: 'blume', amb: 'pollen', mus: 50, en: ['engel', 'todesritter', 'golem', 'elfe', 'jungdrache'], r: [9, 10], t: .62, m: .5, lb: 'fluss', pl: [_t('Götterhain'), _t('Goldener Garten'), _t('Hain der Ersten')] },
  zeitruinen: { n: _t('Zeitruinen'), g: ['#4a3e5a', '#423652', '#564a66', '#3a2e4a'], tx: 'floor', tr: ['saeule.0', 'kristall.2', 'tot.1'], td: .05, rk: .03, rv: 5, deco: 'stern', amb: 'stern', dark: .15, mus: 41, en: ['skelmage', 'todesritter', 'geist', 'mage', 'golem', 'engel'], r: [9, 10], t: .5, m: .3, lb: 'schlucht', pl: [_t('Zeitruinen'), _t('Vergessene Stadt'), _t('Halle der Uhren')] },
  leere: { n: _t('Leereland'), g: ['#160e22', '#120a1c', '#20162e', '#0c0614'], tx: 'leere', tr: ['kristall.2', 'obs.1', 'sternbaum.1'], td: .04, rk: .03, rv: 5, deco: 'stern', amb: 'leere', dark: .3, mus: 37, haz: 'leere', en: ['schattenimp', 'engel', 'todesritter', 'skelmage', 'geist'], r: [10, 12], t: .5, m: .5, et: 'rgba(40,0,70,.45)', lb: 'schlucht', pl: [_t('Leereland'), _t('Das Nichts'), _t('Hungriges Dunkel')] },
  aether: { n: _t('Ätherfeld'), g: ['#d8d0a8', '#ccc49c', '#e8e0b8', '#b8b090'], tx: 'kristall', tr: ['kristall.4', 'sternbaum.0', 'eiche.8'], td: .05, rk: .02, rv: 6, deco: 'stern', amb: 'stern', mus: 50, en: ['engel', 'jungdrache', 'eisgeist', 'elfe', 'todesritter'], r: [10, 11], t: .6, m: .6, et: 'rgba(255,240,180,.3)', lb: 'schlucht', pl: [_t('Ätherfeld'), _t('Lichtsteppe'), _t('Strahlende Weite')] },
  chaos: { n: _t('Chaosöde'), g: ['#5a1e3a', '#521a34', '#6a2a4a', '#46142c'], tx: 'blut', tr: ['obs.1', 'kristall.2', 'knochen.2'], td: .05, rk: .05, rv: 5, pool: 'lava', lk: .6, deco: 'blut', amb: 'schatten', dark: .2, mus: 37, en: ['jungdrache', 'lavadaemon', 'todesritter', 'schattenimp', 'golem', 'frostoger'], r: [11, 12], t: .7, m: .4, ea: 'riese', lb: 'schlucht', pl: [_t('Chaosöde'), _t('Zerrissenes Land'), _t('Wirbelgrund')] },
  weltenrand: { n: _t('Weltenrand'), g: ['#3a3a4a', '#323242', '#46465a', '#262636'], tx: 'leere', tr: ['sternbaum.1', 'obs.1'], td: .02, rk: .03, rv: 5, deco: 'stern', amb: 'leere', dark: .25, mus: 36, haz: 'leere', en: ['schattenimp', 'engel', 'todesritter', 'jungdrache', 'geist'], r: [20, 20], t: .5, m: .45, et: 'rgba(20,10,40,.5)', lb: 'schlucht', pl: [_t('Weltenrand'), _t('Letztes Ufer'), _t('Saum des Seins')] },
  // ---- Die Tiefe (ab 2800 Chunks ≈ 7,5 h Fußmarsch): je Ring zwei bis drei eigene Biome, stärkere Gegner (mehr Affixe), eigene Gefahren ----
  kristallwueste: { n: _t('Kristallwüste'), g: ['#a8b0d4', '#9ca4ca', '#bcc6e6', '#8a92b8'], tx: 'kristall', tr: ['kristall.0', 'kristall.3', 'salzk.0', 'kristall.0'], td: .04, rk: .02, rv: 7, pool: 'eis', lk: .25, deco: 'kristall', amb: 'kristall', mus: 49, haz: 'kalt', en: ['golem', 'icez', 'eisgeist', 'engel', 'frostoger', 'skelmage'], r: [11, 12], t: .3, m: .1, et: 'rgba(150,190,255,.32)', ea: 'gepanzert', lb: 'kluft', pl: [_t('Kristallwüste'), _t('Prismensand'), _t('Gläserne Weite')] },
  glasduenen: { n: _t('Glasdünen'), g: ['#d8c49a', '#ccb88e', '#e8d8b0', '#b8a47a'], tx: 'glas', tr: ['scherbe.0', 'kaktus.0', 'glasbaum.0'], td: .03, rk: .01, rv: 10, pool: 'glas', lk: .3, deco: 'scherbe', amb: 'glas', mus: 47, haz: 'hitze', en: ['golem', 'pyro', 'glutschleim', 'imp', 'lavadaemon', 'skeleton'], r: [11, 13], t: .9, m: .1, et: 'rgba(255,240,200,.3)', ea: 'brennend', lb: 'schlucht', pl: [_t('Glasdünen'), _t('Scherbenmeer'), _t('Schmelzsand')] },
  sternmeer: { n: _t('Sternenmeer-Küste'), g: ['#2a3062', '#242a58', '#38407a', '#1c224a'], tx: 'sternstaub', tr: ['koralle.3', 'sternbaum.0', 'palme.0', 'koralle.3'], td: .04, rk: .01, rv: 7, pool: 'stern', lk: 1.6, deco: 'muschel', amb: 'sternmeer', mus: 50, en: ['engel', 'lizshaman', 'eisgeist', 'elfe', 'icez', 'schattenimp'], r: [11, 13], t: .5, m: .95, et: 'rgba(120,140,255,.32)', ea: 'schnell', lb: 'fluss', pl: [_t('Sternenmeer'), _t('Funkelbucht'), _t('Ufer der Lichter')] },
  aschesturm: { n: _t('Aschesturm'), g: ['#4a4446', '#403a3c', '#5a5254', '#363032'], tx: 'asche', tr: ['tot.1', 'kohle.0', 'obs.0'], td: .03, rk: .05, rv: 2, deco: 'glut', amb: 'aschesturm', dark: .18, mus: 39, haz: 'sturm', en: ['lavadaemon', 'imp', 'chort', 'jungdrache', 'schattenimp', 'golem'], r: [11, 12], t: .85, m: .55, et: 'rgba(80,60,60,.4)', ea: 'schnell', lb: 'schlucht', pl: [_t('Aschesturm'), _t('Rußwirbel'), _t('Glimmende Öde')] },
  knochenwald: { n: _t('Knochenwald'), g: ['#3e3a32', '#36322a', '#4c463c', '#2c2822'], tx: 'knochen', tr: ['knochenbaum.0', 'knochenbaum.1', 'knochen.2', 'knochenbaum.0'], td: .2, rk: .01, rv: 9, deco: 'knochen', amb: 'gruft', dark: .2, mus: 38, haz: 'dunkel', en: ['skeleton', 'skelarcher', 'skelmage', 'todesritter', 'zombie', 'geist'], r: [12, 13], t: .3, m: .5, et: 'rgba(230,220,190,.3)', ea: 'gepanzert', lb: 'schlucht', pl: [_t('Knochenwald'), _t('Gebeinforst'), _t('Rippenhain')] },
  scharlachsumpf: { n: _t('Scharlachsumpf'), g: ['#5a1e22', '#501a1e', '#6e2a2e', '#421418'], tx: 'blut', tr: ['eiche.7', 'schilf.1', 'riesenpilz.2'], td: .08, rk: .01, pool: 'blut', lk: 1.4, deco: 'blut', amb: 'blutnebel', dark: .1, mus: 37, haz: 'blut', en: ['zombie', 'seuche', 'hexe', 'toxslime', 'todesritter', 'wurm'], r: [12, 13], t: .7, m: .88, et: 'rgba(200,30,40,.35)', ea: 'vampir', lb: 'blutnebel', pl: [_t('Scharlachsumpf'), _t('Blutsee'), _t('Roter Morast')] },
  pilzriesen: { n: _t('Pilzriesen'), g: ['#3a2a44', '#34263e', '#4a3654', '#2a1e34'], tx: 'erde', tr: ['riesenpilz.0', 'riesenpilz.1', 'pilz.2', 'riesenpilz.0'], td: .15, rk: .006, pool: 'gift', lk: .5, deco: 'pilz', amb: 'riesensporen', mus: 41, haz: 'sporen', en: ['toxslime', 'slime', 'hexe', 'wurm', 'zombie', 'seuche'], r: [12, 13], t: .5, m: .7, et: 'rgba(170,90,230,.3)', ea: 'heiler', lb: 'fluss', pl: [_t('Pilzriesen'), _t('Hutwald der Riesen'), _t('Sporendom')] },
  uhrwerk: { n: _t('Uhrwerk-Ruinen'), g: ['#5a4a2e', '#524428', '#6e5c3a', '#463a22'], tx: 'metall', tr: ['zahnrad.0', 'zahnrad.1', 'saeule.0', 'zahnrad.0'], td: .04, rk: .02, rv: 11, deco: 'zahnrad', amb: 'dampf', mus: 42, en: ['golem', 'zwerg', 'bomber', 'skelmage', 'todesritter', 'engel'], r: [13, 14], t: .55, m: .3, et: 'rgba(220,170,80,.3)', ea: 'gepanzert', lb: 'schlucht', pl: [_t('Uhrwerk-Ruinen'), _t('Zahnradhalle'), _t('Stadt der Federn')] },
  himmelsklippen: { n: _t('Himmelsklippen'), g: ['#7088b0', '#667ea6', '#8ea4cc', '#556c94'], tx: 'wolke', tr: ['tanne.0', 'busch.3', 'tot.0'], td: .03, rk: .07, rv: 0, deco: 'feder', amb: 'wolke', mus: 51, haz: 'hoehe', en: ['engel', 'imp', 'schattenimp', 'elfe', 'frostoger', 'jungdrache'], r: [13, 15], t: .2, m: .55, et: 'rgba(230,240,255,.35)', ea: 'schnell', lb: 'abbruch', pl: [_t('Himmelsklippen'), _t('Wolkengrat'), _t('Adlerhorst')] },
  titanengraeber: { n: _t('Titanengräber'), g: ['#6a6252', '#605848', '#7c7464', '#524a3e'], tx: 'stein', tr: ['schaedel.0', 'knochen.2', 'grab.1', 'tot.0'], td: .03, rk: .04, rv: 9, deco: 'knochen', amb: 'gruft', dark: .08, mus: 37, en: ['zombie', 'golem', 'todesritter', 'ogre', 'skelmage', 'frostoger'], r: [13, 14], t: .75, m: .2, et: 'rgba(200,190,160,.3)', ea: 'riese', lb: 'schlucht', pl: [_t('Titanengräber'), _t('Feld der Riesen'), _t('Gebeinhalde')] },
  mondsee: { n: _t('Mondsee'), g: ['#4a5a7a', '#425272', '#5c6c8e', '#3a4a68'], tx: 'mond', tr: ['weide.3', 'eiche.12', 'kristall.3', 'weide.3'], td: .07, rk: .01, rv: 12, pool: 'mond', lk: 2.2, deco: 'stern', amb: 'mond', dark: .12, mus: 52, en: ['eisgeist', 'engel', 'icez', 'elfe', 'geist', 'lizshaman'], r: [14, 15], t: .25, m: .92, et: 'rgba(200,220,255,.4)', ea: 'teleport', lb: 'fluss', pl: [_t('Mondsee'), _t('Silberbucht'), _t('Spiegel des Mondes')] },
  seelenfluss: { n: _t('Seelenfluss'), g: ['#2a4a4a', '#244242', '#385c5c', '#1e3838'], tx: 'seele', tr: ['weide.2', 'eiche.15', 'grab.1', 'weide.2'], td: .08, rk: .01, pool: 'seelen', lk: 1.2, deco: 'seele', amb: 'seele', dark: .16, mus: 39, haz: 'seelen', en: ['geist', 'eisgeist', 'skelmage', 'engel', 'zombie', 'todesritter'], r: [14, 15], t: .55, m: .78, et: 'rgba(120,255,220,.38)', ea: 'teleport', lb: 'seelenstrom', pl: [_t('Seelenfluss'), _t('Ufer der Verlorenen'), _t('Flüsternde Strömung')] },
  bernstein: { n: _t('Bernsteinwald'), g: ['#6a4a1e', '#60421a', '#7e5e2a', '#523a14'], tx: 'bernstein', tr: ['eiche.13', 'eiche.13', 'kristall.7', 'busch.1'], td: .22, rk: .01, rv: 14, pool: 'bernstein', lk: .4, deco: 'bernstein', amb: 'bernstein', mus: 45, en: ['elfe', 'hexe', 'golem', 'wurm', 'jungdrache', 'lizshaman'], r: [14, 15], t: .8, m: .55, et: 'rgba(255,170,60,.32)', ea: 'gepanzert', lb: 'fluss', pl: [_t('Bernsteinwald'), _t('Honigforst'), _t('Harz der Ewigkeit')] },
  splittergebirge: { n: _t('Splittergebirge'), g: ['#5a6070', '#525868', '#6c7284', '#464c5a'], tx: 'riss', tr: ['scherbe.0', 'scherbe.2', 'fels.0', 'scherbe.0'], td: .05, rk: .08, rv: 10, deco: 'scherbe', amb: 'splitter', mus: 43, haz: 'sturm', en: ['golem', 'frostoger', 'engel', 'zwerg', 'schattenimp', 'ogre'], r: [15, 16], t: .4, m: .15, et: 'rgba(200,230,255,.3)', ea: 'explosiv', lb: 'kluft', pl: [_t('Splittergebirge'), _t('Scherbenkamm'), _t('Zerbrochene Gipfel')] },
  sonnenschmiede: { n: _t('Sonnenschmiede'), g: ['#7a4a14', '#6e4210', '#8e5e20', '#5e360c'], tx: 'lava', tr: ['obs.0', 'kohle.0', 'scherbe.1'], td: .03, rk: .06, rv: 2, pool: 'lava', lk: 1, deco: 'glut', amb: 'sonne', mus: 40, haz: 'glut', en: ['lavadaemon', 'jungdrache', 'pyro', 'glutschleim', 'golem', 'chort'], r: [15, 17], t: .95, m: .25, et: 'rgba(255,200,60,.38)', ea: 'brennend', lb: 'sternglut', pl: [_t('Sonnenschmiede'), _t('Amboss der Sterne'), _t('Goldene Glut')] },
  frostkrone: { n: _t('Frostkrone'), g: ['#c8dcf0', '#bcd2ea', '#dce8f8', '#a8c0dc'], tx: 'eis', tr: ['eisz.0', 'eisz.1', 'kristall.3'], td: .05, rk: .04, rv: 1, pool: 'eis', lk: .8, deco: 'eis', amb: 'frost', mus: 49, haz: 'frost', en: ['frostoger', 'eisgeist', 'icez', 'golem', 'todesritter', 'engel'], r: [15, 16], t: .02, m: .45, et: 'rgba(180,220,255,.45)', ea: 'frostig', lb: 'abbruch', pl: [_t('Frostkrone'), _t('Thron des Winters'), _t('Eisige Zinnen')] },
  traumwald: { n: _t('Traumwald'), g: ['#6a5a8a', '#605080', '#7c6c9e', '#504070'], tx: 'traum', tr: ['eiche.14', 'eiche.5', 'busch.4', 'glasbaum.1'], td: .2, rk: .005, pool: 'wasser', lk: .3, deco: 'traum', amb: 'traum', dark: .1, mus: 50, haz: 'traum', en: ['engel', 'elfe', 'geist', 'hexe', 'kuerbis', 'schattenimp'], r: [16, 17], t: .5, m: .75, et: 'rgba(255,180,240,.35)', ea: 'teleport', lb: 'traum', pl: [_t('Traumwald'), _t('Schlummerforst'), _t('Wald der Wachträume')] },
  spiegelwelt: { n: _t('Spiegellande'), g: ['#8a8aa0', '#808096', '#a0a0b8', '#6e6e86'], tx: 'glas', tr: ['kristall.3', 'glasbaum.0', 'saeule.0'], td: .05, rk: .02, rv: 10, pool: 'mond', lk: .5, deco: 'scherbe', amb: 'glas', dark: .05, mus: 48, en: ['engel', 'elfe', 'mage', 'skelmage', 'eisgeist', 'todesritter'], r: [16, 17], t: .3, m: .35, et: 'rgba(230,230,255,.4)', ea: 'teleport', lb: 'kluft', pl: [_t('Spiegellande'), _t('Halle der Spiegel'), _t('Gläserne Ebene')] },
  zeitbruch: { n: _t('Zeitbruch'), g: ['#3e3a52', '#38344a', '#4c4866', '#2e2a40'], tx: 'zeit', tr: ['sanduhr.0', 'saeule.0', 'kristall.2'], td: .04, rk: .03, rv: 5, pool: 'zeit', lk: .4, deco: 'riss', amb: 'zeit', dark: .14, mus: 41, haz: 'zeit', en: ['skelmage', 'todesritter', 'engel', 'geist', 'golem', 'mage'], r: [17, 18], t: .6, m: .4, et: 'rgba(255,220,120,.32)', ea: 'schnell', lb: 'zeitstrom', pl: [_t('Zeitbruch'), _t('Riss der Stunden'), _t('Gestern und Morgen')] },
  leerenstrand: { n: _t('Leerenstrand'), g: ['#3e2e56', '#36284c', '#4c3a68', '#2c2042'], tx: 'sand', tr: ['koralle.3', 'obs.1', 'sternbaum.1'], td: .04, rk: .02, rv: 15, pool: 'leere', lk: 1.4, deco: 'muschel', amb: 'leere', dark: .22, mus: 36, haz: 'leere', en: ['schattenimp', 'engel', 'todesritter', 'eisgeist', 'jungdrache', 'geist'], r: [17, 19], t: .4, m: .9, et: 'rgba(80,30,140,.45)', ea: 'teleport', lb: 'fluss', pl: [_t('Leerenstrand'), _t('Küste des Nichts'), _t('Schwarzer Sand')] },
  rost: { n: _t('Rostfelder'), g: ['#6a3a1e', '#60341a', '#7e4a28', '#522c14'], tx: 'rost', tr: ['ruest.0', 'zahnrad.1', 'tot.0'], td: .03, rk: .04, rv: 13, deco: 'rost', amb: 'rost', mus: 40, en: ['golem', 'zwerg', 'bomber', 'berserker', 'todesritter', 'ogre'], r: [17, 18], t: .8, m: .15, et: 'rgba(200,100,40,.32)', ea: 'gepanzert', lb: 'schlucht', pl: [_t('Rostfelder'), _t('Rüstungsgrab der Riesen'), _t('Rote Halde')] },
  sternenwrack: { n: _t('Sternenfall'), g: ['#2a1e2e', '#241a28', '#3a2a3e', '#1e1422'], tx: 'sternstaub', tr: ['scherbe.1', 'obs.1', 'kristall.5'], td: .04, rk: .05, rv: 15, pool: 'stern', lk: .5, deco: 'krater', amb: 'sternfall', dark: .2, mus: 43, haz: 'splitter', en: ['jungdrache', 'engel', 'golem', 'lavadaemon', 'schattenimp', 'todesritter'], r: [18, 19], t: .85, m: .35, et: 'rgba(255,220,140,.35)', ea: 'explosiv', lb: 'kluft', pl: [_t('Sternenfall'), _t('Krater der Sterne'), _t('Gefallenes Licht')] },
  goetterdaemmerung: { n: _t('Götterdämmerung'), g: ['#5a4a3a', '#524234', '#6e5c4a', '#463a2e'], tx: 'floor', tr: ['statue.0', 'saeule.0', 'eiche.16', 'eiche.8'], td: .07, rk: .02, rv: 6, pool: 'wasser', lk: .3, deco: 'blume', amb: 'daemmer', dark: .12, mus: 44, en: ['engel', 'todesritter', 'jungdrache', 'golem', 'skelmage', 'frostoger'], r: [18, 19], t: .55, m: .6, et: 'rgba(255,200,120,.32)', ea: 'riese', lb: 'fluss', pl: [_t('Götterdämmerung'), _t('Letzte Halle'), _t('Zwielicht der Götter')] },
  urnebel: { n: _t('Urnebel'), g: ['#3a3448', '#342e42', '#48405a', '#2a2438'], tx: 'traum', tr: ['eiche.10', 'sternbaum.1', 'riesenpilz.1'], td: .1, rk: .01, pool: 'leere', lk: .6, deco: 'stern', amb: 'urnebel', dark: .26, mus: 37, haz: 'traum', en: ['geist', 'schattenimp', 'engel', 'todesritter', 'eisgeist', 'hexe'], r: [19, 19], t: .2, m: .55, et: 'rgba(160,120,220,.45)', ea: 'teleport', lb: 'traum', pl: [_t('Urnebel'), _t('Nebel vor der Zeit'), _t('Wiege des Seins')] },
  schwarzsonne: { n: _t('Schwarzsonnen-Öde'), g: ['#2a1210', '#220e0c', '#3c1a16', '#180806'], tx: 'lava', tr: ['kohle.0', 'obs.0', 'scherbe.2'], td: .03, rk: .05, rv: 2, pool: 'lava', lk: .5, deco: 'glut', amb: 'schwarz', dark: .3, mus: 36, haz: 'glut', en: ['lavadaemon', 'jungdrache', 'schattenimp', 'todesritter', 'chort', 'golem'], r: [19, 19], t: .6, m: .1, et: 'rgba(40,10,10,.5)', ea: 'brennend', lb: 'sternglut', pl: [_t('Schwarzsonnen-Öde'), _t('Erloschene Sonne'), _t('Glut ohne Licht')] },
  nichtsufer: { n: _t('Ufer des Nichts'), g: ['#16203a', '#121a32', '#20304e', '#0c1426'], tx: 'nichts', tr: ['obs.1', 'sternbaum.1', 'kristall.5'], td: .02, rk: .03, rv: 15, pool: 'leere', lk: .6, deco: 'stern', amb: 'nichts', dark: .3, mus: 35, haz: 'leere', en: ['schattenimp', 'engel', 'todesritter', 'jungdrache', 'geist', 'eisgeist'], r: [20, 20], t: .4, m: .9, et: 'rgba(10,0,30,.5)', ea: 'teleport', lb: 'schlucht', pl: [_t('Ufer des Nichts'), _t('Letzte Brandung'), _t('Saum der Leere')] }
};
// Lebensräume der Biome (Marken aus PET_HABS in js/pets.js): welche Begleiter-Arten dort schlüpfen (eggForBiome)
const LBHAB = { wiese: ['wiese'], wald: ['wald'], hain: ['wald', 'wiese'], heide: ['wiese', 'berg'], ruine: ['ruine', 'gruft'], fels: ['berg', 'hoehle'], seen: ['wasser', 'wiese'], tannen: ['wald', 'berg'],
  moor: ['sumpf', 'wasser'], schnee: ['eis'], herbst: ['wald', 'pilz'], steppe: ['wiese', 'wueste'], pilz: ['pilz', 'wald'], huegel: ['gruft', 'hoehle'], giftmoor: ['sumpf', 'pilz'], canyon: ['berg', 'wueste'],
  dornen: ['wald', 'schatten'], tundra: ['eis', 'wiese'], kueste: ['kueste', 'wasser', 'himmel'], friedhof: ['gruft'], gletscher: ['eis', 'berg'], wueste: ['wueste'], dschungel: ['wald', 'sumpf'], salz: ['wueste', 'kristall'],
  kristall: ['kristall', 'hoehle'], asche: ['asche', 'feuer'], vulkan: ['feuer', 'berg'], blutmoor: ['sumpf', 'schatten'], eiswueste: ['eis'], lava: ['feuer'], obsidian: ['feuer', 'kristall'], nebelwald: ['wald', 'schatten'],
  schattenwald: ['schatten', 'wald'], knochenoede: ['gruft', 'wueste'], geisterebene: ['gruft', 'schatten'], riff: ['kueste', 'kristall'], spiegelsee: ['wasser', 'kristall'], uralt: ['wald', 'pilz'], sturmklippen: ['himmel', 'berg'], drachenland: ['feuer', 'berg'],
  traumwiese: ['wiese', 'himmel'], sternenfeld: ['leere', 'himmel'], goetterhain: ['himmel', 'wald'], zeitruinen: ['ruine', 'leere'], leere: ['leere'], aether: ['leere', 'himmel'], chaos: ['leere', 'feuer'], weltenrand: ['leere', 'schatten'],
  kristallwueste: ['kristall', 'wueste'], glasduenen: ['wueste', 'kristall', 'feuer'], sternmeer: ['kueste', 'wasser', 'leere'], aschesturm: ['asche', 'himmel'], knochenwald: ['gruft', 'wald'], scharlachsumpf: ['sumpf', 'schatten'],
  pilzriesen: ['pilz', 'wald'], uhrwerk: ['ruine', 'kerker'], himmelsklippen: ['himmel', 'berg'], titanengraeber: ['gruft', 'berg'], mondsee: ['wasser', 'himmel'], seelenfluss: ['wasser', 'gruft', 'schatten'],
  bernstein: ['wald', 'kristall'], splittergebirge: ['berg', 'kristall'], sonnenschmiede: ['feuer', 'himmel'], frostkrone: ['eis', 'berg'], traumwald: ['wald', 'himmel', 'schatten'], spiegelwelt: ['kristall', 'leere'],
  zeitbruch: ['ruine', 'leere'], leerenstrand: ['kueste', 'leere'], rost: ['ruine', 'wueste', 'kerker'], sternenwrack: ['feuer', 'leere', 'kristall'], goetterdaemmerung: ['ruine', 'himmel'], urnebel: ['leere', 'schatten', 'sumpf'],
  schwarzsonne: ['asche', 'schatten', 'feuer'], nichtsufer: ['leere', 'kueste'] };
const LBIOK = Object.keys(LANDE_BIOMES); LBIOK.forEach((k, i) => { const B = LANDE_BIOMES[k]; B.key = k; B.i = i; B.map = B.g[2]; B.hab = LBHAB[k] || ['wiese']; B.trs = B.tr.map(s => { const [t, v] = s.split('.'); return [t, +v || 0]; }); });
// Silben für Eigennamen (bleiben unübersetzt)
const LSY = [['Ar', 'Bel', 'Cor', 'Dal', 'El', 'Fen', 'Gal', 'Har', 'Il', 'Jor', 'Kal', 'Lor', 'Mir', 'Nor', 'Or', 'Pel', 'Quel', 'Ral', 'Sar', 'Tal', 'Ul', 'Var', 'Wen', 'Yr', 'Zar', 'Ash', 'Bra', 'Dun', 'Eld', 'Gor', 'Isk', 'Mor', 'Ny', 'Rho', 'Syl', 'Thra', 'Val', 'Xan'], ['a', 'e', 'i', 'o', 'u', 'ae', 'ia', 'or', 'en', 'an', 'el', 'ir', 'um', 'ar'], ['n', 'ra', 'th', 'dor', 'wyn', 'mir', 'gard', 'las', 'rim', 'ven', 'sk', 'nor', 'dal', 'ia', 'eth', 'ok', 'un', 'is', 'ion', 'heim']];
function lSyl(r) { const a = LSY[0][Math.floor(r() * LSY[0].length)], b = r() < .55 ? LSY[1][Math.floor(r() * LSY[1].length)] : '', c = LSY[2][Math.floor(r() * LSY[2].length)]; return a + b + c; }

/* ---------- Regionen: verzerrte Voronoi-Zellen (≈ 6 Chunks), Biom nach Ring + Wärme/Feuchte ---------- */
const LREG = new Map();
function lCell(rx, ry) {
  const key = (rx + 4096) * 8192 + (ry + 4096); let R = LREG.get(key); if (R) return R;
  if (LREG.size > 6000) LREG.clear();
  const sx = (rx + .18 + .64 * lF(rx, ry, 31)) * LRC, sy = (ry + .18 + .64 * lF(rx, ry, 32)) * LRC, dist = Math.hypot(sx, sy);
  let ring = 0; while (ring < LRING.length && LRING[ring] <= dist) ring++;
  R = { key, rx, ry, sx, sy, dist, ring, id: rx.toString(36) + '.' + ry.toString(36), depth: Math.min(1, dist / LWR), biome: null, nm: null };
  R.stage = worldStage(R.depth);
  // Biom: passend zum Ring, dann nach Wärme und Feuchte am Saatpunkt (ganze Klimazonen statt Flickenteppich)
  if (dist < LRC * 1.15) R.biome = 'wiese';   // rund ums Tor: freundliche Wiesen
  else if (dist > LWR - 30) R.biome = 'weltenrand';
  else {
    const T = lTemp(sx, sy), Mo = lMoist(sx, sy), rg = Math.min(ring, LRMAX); let best = null, bs = 1e9;
    for (const k of LBIOK) { const B = LANDE_BIOMES[k]; if (rg < B.r[0] || rg > B.r[1]) continue; const s = Math.abs(T - B.t) * 1.2 + Math.abs(Mo - B.m) + lF(rx * 7 + B.i, ry, 41) * .34; if (s < bs) { bs = s; best = k; } }
    R.biome = best || 'wiese';
  }
  LREG.set(key, R); return R;
}
function lRegName(R) { if (R.nm) return R.nm; const r = mulberry(lH(R.rx, R.ry, 77)), B = LANDE_BIOMES[R.biome], ort = B.pl[Math.floor(r() * B.pl.length)], name = lSyl(r); return R.nm = r() < .7 ? _t('{ort} von {name}', { ort, name }) : _t('{ort} bei {name}', { ort, name }); }
// Die zwei nächsten Saatpunkte zu einem Punkt (q: schon verzerrt, Chunk-Einheiten)
function lNear2(qx, qy) {
  const cx = Math.floor(qx / LRC), cy = Math.floor(qy / LRC); let a = null, b = null, da = 1e18, db = 1e18;
  for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) { const R = lCell(cx + i, cy + j), d = (R.sx - qx) * (R.sx - qx) + (R.sy - qy) * (R.sy - qy); if (d < da) { b = a; db = da; a = R; da = d; } else if (d < db) { b = R; db = d; } }
  return { a, b, da, db };
}
function lRegAtC(px_, py_) { return lNear2(px_ + lWarpX(px_, py_), py_ + lWarpY(px_, py_)).a; }
// Grenze zwischen zwei Regionen: Ringgrenze (Barriere mit Werkzeug, manchmal ein Übergang) oder seltene lokale Barriere (Fluss/Schlucht mit Brücke)
const LPAIR = new Map();
function lPair(A, B) {
  const key = A.key < B.key ? A.key * 67108864 + B.key : B.key * 67108864 + A.key; let p = LPAIR.get(key); if (p) return p;
  if (LPAIR.size > 8000) LPAIR.clear();
  const h = lF(Math.min(A.key, B.key), Math.max(A.key, B.key), 91), mx = (A.sx + B.sx) / 2, my = (A.sy + B.sy) / 2, ab = Math.hypot(B.sx - A.sx, B.sy - A.sy);
  p = { kind: -1, need: -1, cross: false, mx, my, ab };
  if (A.ring !== B.ring) { const t = Math.max(A.ring, B.ring) - 1; p.need = t; p.kind = LBAR[LANDE_TOOLS[t].bar].i; p.cross = h < .34; }
  else if (h < .085 && A.dist > 5 && B.dist > 5) { const lb = LANDE_BIOMES[A.biome].lb || 'fluss'; p.kind = LBAR[lb].i; p.cross = true; }
  if (p.cross) { const n = lNear2(mx, my); p.cross = !!n.a && !!n.b && ((n.a === A && n.b === B) || (n.a === B && n.b === A)); }
  if (p.cross) {
    // Lage des Übergangs in der Welt (Verzerrung zurückrechnen) – für Schild, Karte und Kompass
    let x = mx, y = my; for (let k = 0; k < 4; k++) { x = mx - lWarpX(x, y); y = my - lWarpY(x, y); } p.px = x; p.py = y;
  }
  LPAIR.set(key, p); return p;
}
/* ---------- Die sechs Alten Wege: vom Tor bis zum Weltrand, über jede Barriere mit einem Übergang ---------- */
const LROADS = 6;
function lRoadAng(k, rho) { const p = lF(k, 0, 101) * 6.283, q = lF(k, 1, 101) * 6.283, off = 7 * Math.sin(rho / 43 + p) + 2.2 * Math.sin(rho / 10.3 + q); return k * Math.PI / 3 + .35 + off / Math.max(rho, 9); }
// Abstand eines Punktes (Chunk-Einheiten) zum Weg k (seitlich, Chunk-Einheiten)
function lRoadLat(k, x, y) { const rho = Math.hypot(x, y); if (rho < 2.2) return 99; let d = Math.atan2(y, x) - lRoadAng(k, rho); d -= Math.round(d / 6.283185) * 6.283185; return Math.abs(d) * rho; }
function lRoadPt(k, rho) { const a = lRoadAng(k, rho); return [Math.cos(a) * rho, Math.sin(a) * rho]; }
// Klasse eines Punktes (für Karte und Abfragen außerhalb geladener Chunks): Region, Barriere, Weg
function lClassC(x, y) {
  const qx = x + lWarpX(x, y), qy = y + lWarpY(x, y), n = lNear2(qx, qy), A = n.a, B = n.b, out = { R: A, bar: -1, need: -1, cross: false, road: false };
  if (Math.hypot(x, y) > LWR + (lVN(x / 5, y / 5, 5) - .5) * 4) { out.bar = LBAR.rand.i; return out; }
  const p = lPair(A, B);
  if (p.kind >= 0) {
    const bd = (n.db - n.da) / (2 * p.ab), hw = LBAR[LBARK[p.kind]].w / LCT;
    if (bd < hw) { out.bar = p.kind; out.need = p.need; if (p.cross && (qx - p.mx) * (qx - p.mx) + (qy - p.my) * (qy - p.my) < (3.6 / LCT) * (3.6 / LCT)) out.cross = true; }
  }
  for (let k = 0; k < LROADS; k++) { const lat = lRoadLat(k, x, y); if (lat < (out.bar >= 0 ? 2.1 : 1.25) / LCT) { out.road = true; if (out.bar >= 0) out.cross = true; break; } }
  return out;
}
// Übergänge in der Nähe (Paar-Übergänge der umliegenden Regionen, dazu die Alten Wege an den Ringen)
const LRCX = new Map();
function lRoadCross(k, ring) {
  const key = k * 64 + ring; if (LRCX.has(key)) return LRCX.get(key);
  // den Weg entlang zur Ringgrenze tasten
  let res = null; const R0 = LRING[ring];
  for (let rho = Math.max(3, R0 - 12); rho < R0 + 12; rho += .03) { const [x, y] = lRoadPt(k, rho), c = lClassC(x, y); if (c.bar >= 0 && c.need === ring) { const [x2, y2] = lRoadPt(k, rho + 3 / LCT); res = { px: x2, py: y2, need: ring, kind: c.bar, road: k }; break; } }
  LRCX.set(key, res); return res;
}
function lCrossNear(x, y, rad, need) {
  const out = [], cx = Math.floor(x / LRC), cy = Math.floor(y / LRC), n = Math.ceil(rad / LRC) + 1, cells = [];
  for (let j = -n; j <= n; j++) for (let i = -n; i <= n; i++) cells.push(lCell(cx + i, cy + j));
  for (const A of cells) for (const B of cells) {
    if (A.key >= B.key || Math.abs(A.rx - B.rx) > 1 || Math.abs(A.ry - B.ry) > 1) continue;
    const p = lPair(A, B); if (!p.cross || p.kind < 0 || (need != null && p.need !== need)) continue;
    if (Math.hypot(p.px - x, p.py - y) < rad) out.push({ px: p.px, py: p.py, need: p.need, kind: p.kind });
  }
  const rho = Math.hypot(x, y);
  for (let r = 0; r < LRING.length; r++) { if (Math.abs(LRING[r] - rho) > rad + 8 || (need != null && need !== r)) continue; for (let k = 0; k < LROADS; k++) { const c = lRoadCross(k, r); if (c && Math.hypot(c.px - x, c.py - y) < rad) out.push(c); } }
  return out;
}

/* ---------- Feste Orte: Tore der Alten, Außenposten, Werkzeug-Horte, Meilensteine ---------- */
const LXG = 18, LOG = 26;
// Tor der Alten je Zelle von 18 × 18 Chunks (nicht am Weltentor)
function lExitCell(gx, gy) { const x = gx * LXG + 2 + lF(gx, gy, 51) * (LXG - 4), y = gy * LXG + 2 + lF(gx, gy, 52) * (LXG - 4); if (Math.hypot(x, y) < 6 || Math.hypot(x, y) > LWR - 3) return null; const r = lF(gx, gy, 53); return { x, y, t: r < .62 ? 'portal' : r < .86 ? 'mond' : 'schluessel', ph: lF(gx, gy, 54) * 80, id: 'x' + gx + '_' + gy }; }
function lOutCell(gx, gy) { const x = gx * LOG + 4 + lF(gx, gy, 61) * (LOG - 8), y = gy * LOG + 4 + lF(gx, gy, 62) * (LOG - 8); if (Math.hypot(x, y) < 9 || Math.hypot(x, y) > LWR - 5) return null; return { x, y, id: 'o' + gx + '_' + gy, gx, gy }; }
// Werkzeug-Horte: je Werkzeug mehrere Horte rund um die Welt, mitten im Gürtel vor seinem Ring
function lToolBand(k) { const r0 = k ? LRING[k - 1] : 0, r1 = LRING[k]; return [r0 + (r1 - r0) * .42, r0 + (r1 - r0) * .72]; }
function lToolN(k) { const b = lToolBand(k); return Math.max(4, Math.round(2 * Math.PI * (b[0] + b[1]) / 2 / 90)); }
function lToolSite(k, j) { const N = lToolN(k), b = lToolBand(k), a = 2 * Math.PI * (j + .5 + .6 * (lF(k, j, 71) - .5)) / N, r = b[0] + (b[1] - b[0]) * lF(k, j, 72); return { k, j, x: Math.cos(a) * r, y: Math.sin(a) * r, guard: lF(k, j, 73) < .5 ? 'boss' : 'puzzle', key: 'T' + k + '_' + j }; }
function lToolSitesNear(x, y, rad) {
  const out = [], rho = Math.hypot(x, y), ang = Math.atan2(y, x);
  for (let k = 0; k < LANDE_TOOLS.length; k++) {
    const b = lToolBand(k); if (rho + rad < b[0] - 1 || rho - rad > b[1] + 1) continue;
    const N = lToolN(k), rm = Math.max(1, (b[0] + b[1]) / 2), span = Math.min(N, Math.ceil(rad / (2 * Math.PI * rm / N)) + 2), j0 = Math.round(((ang / (2 * Math.PI)) * N + N) % N);
    for (let d = -span; d <= span; d++) { const j = ((j0 + d) % N + N) % N, s = lToolSite(k, j); if (Math.hypot(s.x - x, s.y - y) < rad && !out.some(o => o.key === s.key)) out.push(s); }
  }
  return out;
}
// Ende der Welt: Stätten kurz vor dem Rand – am Ende jedes Alten Weges (neben dem Weg) und dazwischen etwa alle 157 Chunks (≈ 25 min am Rand entlang)
const LEDGE = LWR - 4, LEDGEN = 360;
// Rand der Welt in Richtung a (Chunks; wie in lGenIt verrauscht) – das Denkmal steht 0,6 Chunks davor: vom Denkmal aus sieht man das Nichts
function lEdgeR(a) { let r = LWR; for (let k = 0; k < 5; k++) r = LWR + (lVN(Math.cos(a) * r / 5, Math.sin(a) * r / 5, 5) - .5) * 4; return r; }
function lEdgeAt(a, j, key, road) { const r = lEdgeR(a) - .6; return { j, x: Math.cos(a) * r, y: Math.sin(a) * r, key, road }; }
function lEdgeSite(j) { return lEdgeAt(2 * Math.PI * (j + .5 + .5 * (lF(j, 0, 111) - .5)) / LEDGEN, j, 'E' + j); }
function lEdgeRoad(k) { return lEdgeAt(lRoadAng(k, LWR - 1) + .3 / LWR, -1 - k, 'Ew' + k, k); }
function lEdgeNearRoad(s) { for (let k = 0; k < LROADS; k++) { const r = lEdgeRoad(k); if (Math.hypot(r.x - s.x, r.y - s.y) < 60) return true; } return false; }
function lEdgeSitesNear(x, y, rad) {
  const out = [], rho = Math.hypot(x, y); if (rho + rad < LEDGE - 1) return out;
  for (let k = 0; k < LROADS; k++) { const s = lEdgeRoad(k); if (Math.hypot(s.x - x, s.y - y) < rad) out.push(s); }
  const j0 = Math.round(Math.atan2(y, x) / (2 * Math.PI) * LEDGEN - .5), span = Math.min(LEDGEN >> 1, Math.ceil(rad / (2 * Math.PI * LEDGE / LEDGEN)) + 1);
  for (let d = -span; d <= span; d++) { const j = ((j0 + d) % LEDGEN + LEDGEN) % LEDGEN, s = lEdgeSite(j); if (Math.hypot(s.x - x, s.y - y) < rad && !lEdgeNearRoad(s)) out.push(s); }
  return out;
}

/* ---------- Ein Chunk: feste Daten aus der Welt-Saat (für alle gleich) ---------- */
function lCK(cx, cy) { return (cx + 16384) * 32768 + (cy + 16384); }
const LFIX = new Map();
let LGEN = null;   // Chunk, der gerade in Häppchen erzeugt wird
function lFixPut(key, d) { LFIX.set(key, d); if (LFIX.size > 64) LFIX.delete(LFIX.keys().next().value); }
function lFixed(cx, cy) {
  const key = lCK(cx, cy); let d = LFIX.get(key); if (d) { LFIX.delete(key); LFIX.set(key, d); return d; }
  if (LGEN && LGEN.key === key) { let r; do r = LGEN.it.next(); while (!r.done); d = r.value; LGEN = null; } else d = lGenFixed(cx, cy);
  lFixPut(key, d); return d;
}
const LMARK = { turm: _t('Alter Wachturm'), kreis: _t('Steinkreis'), riese: _t('Weltenbaum'), statue: _t('Statue des Ordens'), obelisk: _t('Obelisk der Alten'), schrein: _t('Vergessener Schrein') }, LMARKT = ['turm', 'kreis', 'riese', 'statue', 'obelisk', 'schrein'];
// Wahrzeichen in der Mitte einer Region (aus der Welt-Saat, ohne den Chunk zu erzeugen) – wie in lGenIt: Hort, Wahrzeichen oder Ruinenfeld
function lLandmark(R) {
  if (R.lm != null) return R.lm;
  const h = lF(R.rx, R.ry, 81);
  return R.lm = R.dist < 5 ? _t('Weltentor') : h < .3 ? _t('Hort') : h < .72 ? LMARK[LMARKT[Math.floor(lF(R.rx, R.ry, 82) * LMARKT.length)]] : _t('Ruinenfeld');
}
const LPROPR = { eiche: 5, herbst: 5, tanne: 5, schnee: 5, tot: 3, kohle: 3, stein: 5, fels: 9, saeule: 7, birke: 4, pilz: 5, kaktus: 4, palme: 4, dorn: 6, kristall: 5, knochen: 6, grab: 4, eisz: 5, obs: 4, busch: 5, weide: 5, sternbaum: 5, koralle: 5, salzk: 4, schilf: 0, statue: 7, riese: 12, riesenpilz: 10, knochenbaum: 5, glasbaum: 5, zahnrad: 9, scherbe: 5, schaedel: 12, sanduhr: 6, ruest: 9 };
function lGenFixed(cx, cy) { const it = lGenIt(cx, cy); let r; do r = it.next(); while (!r.done); return r.value; }
// Erzeugt einen Chunk in Häppchen (yield): das Vorladen verteilt die Arbeit auf mehrere Bilder, ohne Ruckeln
function* lGenIt(cx, cy) {
  const t0 = performance.now(), N = LPD, NN = N * N, rg = new Uint8Array(NN), bar = new Uint8Array(NN), wk = new Uint8Array(NN), nd = new Uint8Array(NN), road = new Uint8Array(NN), regs = [];
  let tw = 0, tt = performance.now(); const lap = () => { const n = performance.now(); tw += n - tt; tt = n; };
  // Saatpunkte der umliegenden Regionszellen – nur die, die hier Erst- oder Zweitnächste sein können
  const qx0 = cx - 1.45, qx1 = cx + 2.45, qy0 = cy - 1.45, qy1 = cy + 2.45, C = [];
  for (let j = Math.floor(qy0 / LRC) - 1; j <= Math.floor(qy1 / LRC) + 1; j++) for (let i = Math.floor(qx0 / LRC) - 1; i <= Math.floor(qx1 / LRC) + 1; i++) {
    const R = lCell(i, j), dx = Math.max(qx0 - R.sx, 0, R.sx - qx1), dy = Math.max(qy0 - R.sy, 0, R.sy - qy1), fx = Math.max(Math.abs(R.sx - qx0), Math.abs(R.sx - qx1)), fy = Math.max(Math.abs(R.sy - qy0), Math.abs(R.sy - qy1));
    C.push({ R, mn: Math.hypot(dx, dy), mx: Math.hypot(fx, fy) });
  }
  const m2 = C.map(c => c.mx).sort((a, b) => a - b)[1], S = C.filter(c => c.mn <= m2 + 1e-9).map(c => c.R);
  const SN = S.length, SX = new Float64Array(SN), SY = new Float64Array(SN); for (let i = 0; i < SN; i++) { SX[i] = S[i].sx; SY[i] = S[i].sy; }
  // Verzerrung auf einem groben Gitter (alle 8 Kacheln, an den Chunkgrenzen geteilt), je Kachel bilinear
  const WX = new Float32Array(81), WY = new Float32Array(81);
  for (let j = 0; j < 9; j++) for (let i = 0; i < 9; i++) { const x = cx + (i * 8 - 8) / LCT, y = cy + (j * 8 - 8) / LCT; WX[j * 9 + i] = lWarpX(x, y); WY[j * 9 + i] = lWarpY(x, y); }
  const roads = []; for (let k = 0; k < LROADS; k++) if (lRoadLat(k, cx + .5, cy + .5) < 1.3) roads.push(k);
  const edge = Math.hypot(cx + .5, cy + .5) > LWR - 4, CR2 = (3.6 / LCT) * (3.6 / LCT), PC = new Map(), HW = LBARK.map(k => LBAR[k].w / LCT);
  for (let ty = 0; ty < N; ty++) {
    for (let tx = 0; tx < N; tx++) {
      const lx = tx - .5, ly = ty - .5, x = cx + lx / LCT, y = cy + ly / LCT, u = (lx + 8) / 8, v = (ly + 8) / 8, i0 = u | 0, j0 = v | 0, fu = u - i0, fv = v - j0, o = j0 * 9 + i0;
      const qx = x + (WX[o] + (WX[o + 1] - WX[o]) * fu) * (1 - fv) + (WX[o + 9] + (WX[o + 10] - WX[o + 9]) * fu) * fv, qy = y + (WY[o] + (WY[o + 1] - WY[o]) * fu) * (1 - fv) + (WY[o + 9] + (WY[o + 10] - WY[o + 9]) * fu) * fv;
      let a = 0, b = 0, da = 1e18, db = 1e18;
      for (let s = 0; s < SN; s++) { const dx = SX[s] - qx, dy = SY[s] - qy, dd = dx * dx + dy * dy; if (dd < da) { b = a; db = da; a = s; da = dd; } else if (dd < db) { b = s; db = dd; } }
      const A = S[a], idx = ty * N + tx; let li = regs.indexOf(A); if (li < 0) { li = regs.length; regs.push(A); } rg[idx] = li;
      const pk = a * 64 + b; let p = PC.get(pk); if (!p) { p = lPair(A, S[b]); PC.set(pk, p); }
      if (p.kind >= 0 && (db - da) / (2 * p.ab) < HW[p.kind]) { bar[idx] = p.kind + 1; wk[idx] = 1; nd[idx] = p.need + 1; if (p.cross && (qx - p.mx) * (qx - p.mx) + (qy - p.my) * (qy - p.my) < CR2) wk[idx] = p.need >= 0 ? 2 : 3; }
      if (edge && Math.hypot(x, y) > LWR + (lVN(x / 5, y / 5, 5) - .5) * 4) { bar[idx] = LBAR.rand.i + 1; wk[idx] = 1; nd[idx] = 0; continue; }
      for (let r = 0; r < roads.length; r++) { const lat = lRoadLat(roads[r], x, y); if (lat < (bar[idx] ? 2.1 : 1.25) / LCT) { road[idx] = 1; if (bar[idx]) wk[idx] = nd[idx] ? 2 : 3; break; } }
    }
    if (ty % 12 === 11) { lap(); yield; tt = performance.now(); }
  }
  const d = { cx, cy, key: lCK(cx, cy), rg, bar, wk, nd, road, regs, lakes: [], lakeT: new Uint8Array(NN), objs: [], pois: [], clear: [], X0: (cx + LOC) * LCK, Y0: (cy + LOC) * LCK, mc: null };
  d.R = regs[rg[25 * N + 25]]; d.B = LANDE_BIOMES[d.R.biome];
  const X0 = d.X0, Y0 = d.Y0, I = (x, y) => (Math.floor(y / LTS) + 1) * N + Math.floor(x / LTS) + 1;
  const okAt = (x, y, r) => { if (x < r || y < r || x > LCK - r || y > LCK - r) return false; for (let yy = y - r; yy <= y + r; yy += 8) for (let xx = x - r; xx <= x + r; xx += 8) { const i = I(clamp(xx, 0, LCK - 1), clamp(yy, 0, LCK - 1)); if (bar[i] || d.lakeT[i]) return false; } return true; };
  const nudge = (x, y, r) => { if (okAt(x, y, r)) return [x, y]; for (let k = 1; k < 24; k++) { const a = k * 2.4, rr = k * 7; const nx = Math.round(x + Math.cos(a) * rr), ny = Math.round(y + Math.sin(a) * rr); if (okAt(nx, ny, r)) return [nx, ny]; } return null; };
  const add = o => { d.objs.push(o); return o; };
  const clear = (x, y, r) => d.clear.push({ x, y, r });
  const inC = (x, y) => Math.floor(x) === cx && Math.floor(y) === cy, loc = (x, y, m) => [clamp(Math.round((x - cx) * LCK), m, LCK - m), clamp(Math.round((y - cy) * LCK), m, LCK - m)];
  const outpost = (ox, oy, id, names) => {
    clear(ox, oy, 150); const r = mulberry(lH(cx, cy, 63));
    add({ k: 'fire', x: X0 + ox, y: Y0 + oy, r: 5, solid: true });
    const roles = [['mis', -38, -8], ['trade', 36, -12], ['heal', 4, 34]], sps = { mis: ['elff', 'elf', 'knightf'], trade: ['dwarf', 'dwarff', 'lizard'], heal: ['wizf', 'wizard', 'lizardf'] };
    for (const [role, dx, dy] of roles) { const nm = names ? names[role] : lSyl(r); add({ k: 'npc', role, x: X0 + ox + dx, y: Y0 + oy + dy, r: 6, solid: true, sp: names ? LNPC[role].sp : sps[role][Math.floor(r() * 3)], face: dx > 0 ? -1 : 1, name: nm, op: id }); }
    add({ k: 'prop', t: 'wagen', v: 0, x: X0 + ox + 66, y: Y0 + oy - 18, r: 11, solid: true });
    add({ k: 'prop', t: 'zelt', v: 2, x: X0 + ox - 22, y: Y0 + oy + 40, r: 10, solid: true });
    add({ k: 'prop', t: 'zelt', v: Math.floor(r() * 2), x: X0 + ox - 70, y: Y0 + oy - 26, r: 10, solid: true });
    add({ k: 'prop', t: 'fahne', v: 0, x: X0 + ox + 74, y: Y0 + oy + 28, r: 3, solid: true });
    d.pois.push({ k: 'out', x: X0 + ox, y: Y0 + oy, id, gate: !!names });
  };
  // Weltentor und das erste Lager der Kundschafter
  if (cx === 0 && cy === 0) {
    clear(384, 380, 250);
    add({ k: 'exit', t: 'tor', x: X0 + 384, y: Y0 + 300, r: 0, ph: 0, id: 'tor', solid: false });
    outpost(384, 450, 'o_tor', { mis: LNPC.mis.n, trade: LNPC.trade.n, heal: LNPC.heal.n });
    d.pois.push({ k: 'gate', x: X0 + 384, y: Y0 + 300 });
  }
  // Mittelpunkt einer Region: Wahrzeichen, Hort eines Bosses oder Ruinen
  for (const R of S) {
    if (!inC(R.sx, R.sy) || R.dist < 5) continue;
    const h = lF(R.rx, R.ry, 81), [lx, ly] = loc(R.sx, R.sy, 150), p = nudge(lx, ly, 26); if (!p) continue;
    if (h < .3) { clear(p[0], p[1], 90); add({ k: 'lair', x: X0 + p[0], y: Y0 + p[1], r: 0, solid: false, key: 'L' + R.id, rid: R.id }); d.pois.push({ k: 'lair', x: X0 + p[0], y: Y0 + p[1], key: 'L' + R.id }); }
    else if (h < .72) {
      const t = LMARKT[Math.floor(lF(R.rx, R.ry, 82) * LMARKT.length)];
      clear(p[0], p[1], t === 'kreis' ? 70 : 54);
      add({ k: 'mark', t, x: X0 + p[0], y: Y0 + p[1], r: t === 'turm' ? 15 : t === 'riese' ? 12 : t === 'statue' ? 7 : t === 'obelisk' ? 6 : t === 'schrein' ? 9 : 0, solid: t !== 'kreis', name: LMARK[t], rid: R.id });
      if (t === 'kreis') for (let i = 0; i < 7; i++) { const a = i / 7 * 6.283; add({ k: 'prop', t: 'menhir', v: i % 2, x: X0 + p[0] + Math.cos(a) * 36, y: Y0 + p[1] + Math.sin(a) * 22, r: 4, solid: true }); }
      d.pois.push({ k: 'mark', x: X0 + p[0], y: Y0 + p[1], t });
    } else { clear(p[0], p[1], 60); for (let i = 0; i < 5; i++) { const a = i * 1.3 + h * 9, rr = 26 + (i % 2) * 14; add({ k: 'prop', t: 'saeule', v: 0, x: X0 + p[0] + Math.cos(a) * rr, y: Y0 + p[1] + Math.sin(a) * rr * .7, r: 7, solid: true }); } d.pois.push({ k: 'ruin', x: X0 + p[0], y: Y0 + p[1] }); }
  }
  // Tore der Alten
  for (let gy = Math.floor(cy / LXG) - 1; gy <= Math.floor(cy / LXG) + 1; gy++) for (let gx = Math.floor(cx / LXG) - 1; gx <= Math.floor(cx / LXG) + 1; gx++) {
    const e = lExitCell(gx, gy); if (!e || !inC(e.x, e.y)) continue; const [lx, ly] = loc(e.x, e.y, 90), p = nudge(lx, ly, 30); if (!p) continue;
    clear(p[0], p[1], 64); add({ k: 'exit', t: e.t, x: X0 + p[0], y: Y0 + p[1], r: 0, ph: e.ph, id: e.id, solid: false });
  }
  // Außenposten
  for (let gy = Math.floor(cy / LOG) - 1; gy <= Math.floor(cy / LOG) + 1; gy++) for (let gx = Math.floor(cx / LOG) - 1; gx <= Math.floor(cx / LOG) + 1; gx++) {
    const o = lOutCell(gx, gy); if (!o || !inC(o.x, o.y)) continue; const [lx, ly] = loc(o.x, o.y, 160), p = nudge(lx, ly, 60); if (p) outpost(p[0], p[1], o.id, null);
  }
  // Werkzeug-Horte
  for (const s of lToolSitesNear(cx + .5, cy + .5, 1.2)) {
    if (!inC(s.x, s.y)) continue; const [lx, ly] = loc(s.x, s.y, 130), p = nudge(lx, ly, 50); if (!p) continue;
    clear(p[0], p[1], 100); add({ k: 'tool', tk: s.k, j: s.j, x: X0 + p[0], y: Y0 + p[1], r: 6, solid: false, guard: s.guard, key: s.key }); d.pois.push({ k: 'tool', x: X0 + p[0], y: Y0 + p[1], tk: s.k });
  }
  // Ende der Welt: Denkmal mit Wächter und letztem Hort
  for (const s of lEdgeSitesNear(cx + .5, cy + .5, 1.2)) {
    if (!inC(s.x, s.y)) continue; const [lx, ly] = loc(s.x, s.y, 140), p = nudge(lx, ly, 44); if (!p) continue;
    clear(p[0], p[1], 120); add({ k: 'end', x: X0 + p[0], y: Y0 + p[1], r: 9, solid: true, key: s.key, road: s.road }); d.pois.push({ k: 'end', x: X0 + p[0], y: Y0 + p[1] });
  }
  // Meilensteine an den Alten Wegen (alle 50 Chunks)
  for (const k of roads) { const rho = Math.hypot(cx + .5, cy + .5), j = Math.round(rho / 50); if (j < 1) continue; const [x, y] = lRoadPt(k, j * 50); if (inC(x, y)) { const [lx, ly] = loc(x, y, 30); clear(lx, ly, 18); add({ k: 'mile', x: X0 + lx + 22, y: Y0 + ly, r: 3, solid: true, km: Math.round(j * 50 * LCK / 8000) }); } }
  // Schilder an Übergängen
  for (let a = 0; a < SN; a++) for (let b = a + 1; b < SN; b++) {
    const A = S[a], B = S[b]; if (Math.abs(A.rx - B.rx) > 1 || Math.abs(A.ry - B.ry) > 1) continue; const p = lPair(A, B);
    if (!p.cross || p.kind < 0 || !inC(p.px, p.py)) continue; const lx = Math.round((p.px - cx) * LCK), ly = Math.round((p.py - cy) * LCK); clear(lx, ly, 70);
    add({ k: 'cross', x: X0 + lx, y: Y0 + ly, r: 0, solid: false, need: p.need, kind: p.kind });
  }
  { let sx = 0, sy = 0, n = 0, nk = 0, kk = 0; for (let ty = 1; ty <= LCT; ty++) for (let tx = 1; tx <= LCT; tx++) { const i = ty * N + tx; if (road[i] && bar[i] && bar[i] - 1 !== LBAR.rand.i) { sx += tx; sy += ty; n++; nk = nd[i]; kk = bar[i] - 1; } } if (n >= 3) { const lx = Math.round((sx / n - .5) * LTS), ly = Math.round((sy / n - .5) * LTS); add({ k: 'cross', x: X0 + lx, y: Y0 + ly, r: 0, solid: false, need: nk - 1, kind: kk, road: 1 }); } }
  lap(); yield; tt = performance.now();
  // Seen (nicht auf Wegen, Barrieren oder Plätzen)
  const R = mulberry(lH(cx, cy, 71)), lk = d.B.lk || 0, nl = Math.floor(lk) + (R() < lk % 1 ? 1 : 0);
  for (let i = 0; i < nl; i++) for (let k = 0; k < 14; k++) {
    const x = 70 + R() * (LCK - 140), y = 60 + R() * (LCK - 120), rx = 22 + R() * 36, ry = 10 + R() * 15, ti = I(x, y), B = LANDE_BIOMES[regs[rg[ti]].biome];
    if (!B.pool || d.clear.some(c => Math.hypot(c.x - x, c.y - y) < c.r + rx) || d.lakes.some(l => Math.hypot(l.x - X0 - x, l.y - Y0 - y) < l.rx + rx + 10)) continue;
    let bad = false; for (let yy = y - ry - 10; yy <= y + ry + 10 && !bad; yy += 8) for (let xx = x - rx - 10; xx <= x + rx + 10; xx += 8) { const j = I(clamp(xx, 0, LCK - 1), clamp(yy, 0, LCK - 1)); if (bar[j] || road[j]) { bad = true; break; } }
    if (bad) continue;
    d.lakes.push({ k: B.pool, x: X0 + x, y: Y0 + y, rx, ry });
    for (let ty = Math.floor((y - ry) / LTS); ty <= Math.floor((y + ry) / LTS); ty++) for (let tx = Math.floor((x - rx) / LTS); tx <= Math.floor((x + rx) / LTS); tx++) { const ddx = (tx * LTS + 8 - x) / (rx + 6), ddy = (ty * LTS + 8 - y) / (ry + 5); if (ddx * ddx + ddy * ddy < 1 && tx >= 0 && ty >= 0 && tx < LCT && ty < LCT) d.lakeT[(ty + 1) * N + tx + 1] = 1; }
    break;
  }
  // Plätze frei halten: Kreise einmal in Kacheln umrechnen
  const clr = new Uint8Array(LCT * LCT);
  for (const c of d.clear) for (let ty = Math.max(0, Math.floor((c.y - c.r) / LTS)); ty <= Math.min(LCT - 1, Math.floor((c.y + c.r) / LTS)); ty++) for (let tx = Math.max(0, Math.floor((c.x - c.r) / LTS)); tx <= Math.min(LCT - 1, Math.floor((c.x + c.r) / LTS)); tx++) { const dx = tx * LTS + 8 - c.x, dy = ty * LTS + 8 - c.y; if (dx * dx + dy * dy < c.r * c.r) clr[ty * LCT + tx] = 1; }
  // Bäume, Felsen, Pflanzen: Dichte aus Rauschen (grobes Gitter alle 4 Kacheln)
  const RP = mulberry(lH(cx, cy, 72)), gx0 = cx * LCT, gy0 = cy * LCT, DN = new Float32Array(169);
  for (let j = 0; j < 13; j++) for (let i = 0; i < 13; i++) DN[j * 13 + i] = lVN((gx0 + i * 4) / 7, (gy0 + j * 4) / 7, 61);
  for (let ty = 0; ty < LCT; ty++) {
    for (let tx = 0; tx < LCT; tx++) {
      const i = (ty + 1) * N + tx + 1, r0 = RP(), jx = RP(), jy = RP();
      if (bar[i] || road[i] || d.lakeT[i] || clr[ty * LCT + tx] || bar[i - 1] || bar[i + 1] || bar[i - N] || bar[i + N]) continue;
      const B = LANDE_BIOMES[regs[rg[i]].biome], u = tx / 4, v = ty / 4, a = u | 0, b = v | 0, fu = u - a, fv = v - b, o = b * 13 + a;
      const nz = (DN[o] + (DN[o + 1] - DN[o]) * fu) * (1 - fv) + (DN[o + 13] + (DN[o + 14] - DN[o + 13]) * fu) * fv, dens = B.td * (.3 + 1.4 * nz);
      if (r0 >= dens + B.rk) continue;
      const x = tx * LTS + 3 + jx * 10, y = ty * LTS + 3 + jy * 10;
      if (r0 < dens) { const tr = B.trs[Math.floor(RP() * B.trs.length)], rr = LPROPR[tr[0]] == null ? 5 : LPROPR[tr[0]]; add({ k: 'prop', t: tr[0], v: tr[1], x: X0 + x, y: Y0 + y, r: rr, solid: rr > 0 }); }
      else { const big = RP() < .3; add({ k: 'prop', t: big ? 'fels' : 'stein', v: B.rv || 0, x: X0 + x, y: Y0 + y, r: big ? 9 : 5, solid: true }); }
    }
    if (ty % 16 === 15) { lap(); yield; tt = performance.now(); }
  }
  // Raster für schnelle Suche (6 × 6 Felder je Chunk)
  d.grid = []; for (let i = 0; i < LGN * LGN; i++) d.grid.push([]);
  for (const o of d.objs) d.grid[clamp(Math.floor((o.y - Y0) / LGC), 0, LGN - 1) * LGN + clamp(Math.floor((o.x - X0) / LGC), 0, LGN - 1)].push(o);
  lap(); d.ms = tw; d.wall = performance.now() - t0;
  // Bodenbilder der Biome hier schon vorbereiten (nicht erst beim Malen)
  for (const R_ of regs) if (!LTILE['m:' + R_.biome]) { yield; lTiles(R_.biome); while (!lMacroStep(R_.biome)) yield; }
  return d;
}
function lMini(d) { return d.mc || (d.mc = lMiniChunk(d)); }
// Kleines Kartenbild eines Chunks: eine Kachel = ein Pixel
const LCROSSC = { planken: '#8a5a32', bruecke: '#9a8a74', pfad: '#6a8a3a', stufen: '#e8f8ff', steine: '#4a3a3a', licht: '#ffe08a', pfeiler: '#9aa2ae', schneise: '#7a6a4a', tor: '#e8b04a', anker: '#c060ff',
  kseil: '#8ab0ff', kraut: '#8ac86a', schwebe: '#9aa2ae', gebein: '#e8e2cf', glutstein: '#2a1e1e', wachlicht: '#ffd8f8', stunde: '#e8c860', schnitt: '#8a98a8', weltor: '#ffd24a' };
function lMiniChunk(d) {
  const c = mk(LCT, LCT), g = c.getContext('2d'), im = g.createImageData(LCT, LCT), p = im.data, N = LPD, road = hexRgb('#a8865a'), regC = d.regs.map(R => hexRgb(LANDE_BIOMES[R.biome].map));
  for (let ty = 0; ty < LCT; ty++) for (let tx = 0; tx < LCT; tx++) {
    const i = (ty + 1) * N + tx + 1, o = (ty * LCT + tx) * 4; let col;
    if (d.bar[i]) { const Bk = LBAR[LBARK[d.bar[i] - 1]]; col = d.wk[i] >= 2 ? hexRgb(LCROSSC[Bk.x] || '#c8c0aa') : hexRgb(Bk.c[(tx + ty) % 3 ? 0 : 2]); }
    else if (d.road[i]) col = road; else if (d.lakeT[i]) { const l = d.lakes[0]; col = hexRgb(lPC(l ? l.k : 'wasser')[1]); for (const L_ of d.lakes) { const dx = (d.X0 + tx * LTS + 8 - L_.x) / (L_.rx + 6), dy = (d.Y0 + ty * LTS + 8 - L_.y) / (L_.ry + 5); if (dx * dx + dy * dy < 1) { col = hexRgb(lPC(L_.k)[1]); break; } } }
    else { col = regC[d.rg[i]]; const v = ((lH(d.cx * LCT + tx, d.cy * LCT + ty, 2) & 7) - 3) * 3; col = [clamp(col[0] + v, 0, 255), clamp(col[1] + v, 0, 255), clamp(col[2] + v, 0, 255)]; }
    p[o] = col[0]; p[o + 1] = col[1]; p[o + 2] = col[2]; p[o + 3] = 255;
  }
  g.putImageData(im, 0, 0);
  g.fillStyle = 'rgba(10,30,10,.35)'; for (const o of d.objs) if (o.k === 'prop' && LPROPR[o.t] >= 4 && o.t !== 'stein' && o.t !== 'fels') g.fillRect(Math.floor((o.x - d.X0) / LTS), Math.floor((o.y - d.Y0) / LTS), 1, 1);
  return c;
}

/* ---------- Ein Chunk im laufenden Ausflug: dazu Truhen, Lager, Kräuter, Erz (Ausflugs-Saat) ---------- */
function lTS(k) { return LW.ts.get(k); }
function lTSet(k, v) { LW.ts.set(k, v); }
function lLoad(cx, cy) {
  const L = LW, key = lCK(cx, cy), d = lFixed(cx, cy);
  const rec = { cx, cy, key, d, X0: d.X0, Y0: d.Y0, grid: d.grid.map(c => c.slice()), wk: d.wk, cv: null, g: null, ps: 0, pd: false, used: T, live: true };
  L.cm.set(key, rec);
  try { lTripLayer(rec); } catch (e) { console.error('Lande (Chunk):', e); }
  return rec;
}
function lRecAdd(rec, o) { rec.grid[clamp(Math.floor((o.y - rec.Y0) / LGC), 0, LGN - 1) * LGN + clamp(Math.floor((o.x - rec.X0) / LGC), 0, LGN - 1)].push(o); return o; }
function lRecDel(rec, o) { for (const c of rec.grid) { const i = c.indexOf(o); if (i >= 0) { c.splice(i, 1); return; } } }
function lTripLayer(rec) {
  const L = LW, d = rec.d, cx = rec.cx, cy = rec.cy, X0 = rec.X0, Y0 = rec.Y0, R = mulberry(lH(cx * 3 + 1, cy * 5 + 2, L.seed)), Rg = d.R, st = Rg.stage, B = d.B, dep = Rg.depth, zf = clamp(dep * 12, 0, 1);
  const pre = cx + ',' + cy + ':'; let n = 0;
  const gate = Math.hypot(cx + .5, cy + .5) < 2.6, N = LPD;
  const solidNear = (x, y, r) => { let hit = false; lGridRec(rec, x, y, r + 12, o => { if (!hit && o.solid && Math.hypot(o.x - x, o.y - y) < o.r + r) hit = true; }); return hit; };
  const free = (x, y, r) => { const lx = x - X0, ly = y - Y0; if (lx < 20 || ly < 20 || lx > LCK - 20 || ly > LCK - 20) return false; const i = (Math.floor(ly / LTS) + 1) * N + Math.floor(lx / LTS) + 1; if (d.bar[i] || d.lakeT[i] || d.road[i]) return false; if (d.clear.some(c => Math.hypot(c.x - lx, c.y - ly) < c.r + r)) return false; return !solidNear(x, y, r); };
  const spot = r => { for (let k = 0; k < 18; k++) { const x = X0 + 24 + R() * (LCK - 48), y = Y0 + 24 + R() * (LCK - 48); if (free(x, y, r)) return { x, y }; } return null; };
  const add = o => { o.sk = pre + (n++); return lRecAdd(rec, o); };
  gatherReset(rec);   // Bäume/Felsen zum Abbauen erst im Grundzustand (die Plätze für Truhen hängen daran), der Ausflugs-Zustand kommt am Ende (js/bauen.js)
  // Zustand aus diesem Ausflug (geöffnet, gesäubert) wieder anwenden
  for (const c of rec.grid) for (const o of c) { if (o.k === 'exit' && o.t === 'schluessel') o.open = !!lTS('x' + o.id); if (o.k === 'lair' || o.k === 'tool') o.ts = lTS(o.key) || 0; if (o.k === 'end') { const s = lTS(o.key); o.state = s === 'done' ? 'done' : s === 'won' ? 'open' : 'idle'; o.act = false; o.alive = 0; } }
  // Truhen und Fundstellen
  const wts = { holz: 1.3 - zf, eisen: .6 + zf * .4, gold: .05 + zf * .5, fluch: .05 + zf * .3, schloss: .08 + zf * .25 };
  const nS = R() < .85 ? 1 + Math.floor(R() * 2.2) : 0;
  for (let i = 0; i < nS; i++) { const p = spot(10); n++; if (!p) continue; const t = wpick(wts, R); const o = add({ k: 'spot', t, x: p.x, y: p.y, r: 7, solid: true, z: zf, st, open: 0 }); if (lTS(o.sk)) o.open = 1; }
  const extra = [['kraut', .8, 16], ['rest', .25, 20], ['versteck', .2, 16]];
  for (const [t, ch, r] of extra) { if (R() >= ch) { n++; continue; } const p = spot(r); if (!p) { n++; continue; } const o = add({ k: 'spot', t, v: Math.floor(R() * 3), x: p.x, y: p.y, r: 0, solid: false, z: zf, st, open: 0 }); if (lTS(o.sk)) o.open = 1; }
  // Erzadern: tiefer = besseres Erz, je nach Biom
  const nV = R() < .6 ? 1 + Math.floor(R() * 1.6) : 0;
  for (let i = 0; i < nV; i++) { const p = spot(10); n++; if (!p) continue; const ms = lVeinMat(B.key, st, R); const o = { k: 'vein', mat: ms, x: p.x, y: p.y, r: 7, hp: 3, solid: true, flash: 0, sk: pre + (n - 1) }; if (lTS(o.sk)) continue; lRecAdd(rec, o); }
  // Lager der Monster (nicht am Tor)
  if (!gate && R() < .5) {
    const p = spot(40); n++;
    if (p) {
      const st2 = st, list = lWave(B.key, st2, 3 + Math.min(14, st2 * .3) + zf * 4, 7), sk = pre + (n - 1);
      const c = { k: 'camp', x: p.x, y: p.y, r: 5, solid: true, z: zf, st: st2, bk: B.key, left: list.map(t => ({ t, el: false })), alive: 0, state: 'dorm', fire: true, sk };
      for (let k = 0; k < (dep > .01 ? 1 : 0) + (dep > .05 ? 1 : 0) + (dep > .4 ? 1 : 0) + (dep > .75 ? 1 : 0); k++) c.left.push({ t: pick(lPool(B.key, st2)), el: true });   // tief draußen mehr Elite
      if (lTS(sk) === 'done') { c.state = 'done'; c.left = []; }
      lRecAdd(rec, c);
      for (let k = 0; k < 2; k++) { const a = R() * 6.283; lRecAdd(rec, { k: 'prop', t: 'zelt', v: k ? 1 : 0, x: p.x + Math.cos(a) * 34, y: p.y + Math.sin(a) * 20, r: 10, solid: true }); }
      if (c.state !== 'done') { const o = add({ k: 'spot', t: dep > .04 ? 'gold' : 'eisen', x: p.x + 12, y: p.y - 18, r: 7, solid: true, z: zf, st: st2, open: 0 }); if (lTS(o.sk)) o.open = 1; } else n++;
    }
  } else n++;
  // Streifen: wandernde Gruppen
  if (!gate && R() < .28 && !lTS(pre + 'p')) { const p = spot(12); if (p) { lTSet(pre + 'p', 1); L.pats.push({ x: p.x, y: p.y, tx: p.x, ty: p.y, list: lWave(B.key, st, 2.5 + Math.min(10, st * .25), 4).map(t => ({ t, el: false })), alive: 0, state: 'dorm', st, w: 0 }); } }
  // Leuchtfeuer des Spielers
  for (const cp of lMeta().cps) { const ccx = Math.floor(cp.x / LCK), ccy = Math.floor(cp.y / LCK); if (ccx === cx && ccy === cy) lRecAdd(rec, { k: 'beacon', cp, x: cp.x + LOFF, y: cp.y + LOFF, r: 4, solid: false }); }
  lBeaconGap(rec);
  // Orte der Aufträge
  for (const m of L.mis) if (m.site && m.site.cx === cx && m.site.cy === cy && !m.done) lMisSite(rec, m);
  // Werkzeug-Horte: Runensteine fürs Rätsel
  for (const c of rec.grid) for (const o of c.slice()) if (o.k === 'tool' && o.guard === 'puzzle' && !o.stones) { const r = mulberry(lH(o.tk, o.j, 74)), ord = [0, 1, 2, 3].sort(() => r() - .5); o.stones = []; o.lit = 0; for (let i = 0; i < 4; i++) { const a = i / 4 * 6.283 + .4, s = { k: 'rune', x: o.x + Math.cos(a) * 58, y: o.y + Math.sin(a) * 40, r: 0, solid: false, n: ord[i], site: o, on: false }; o.stones.push(s); lRecAdd(rec, s); } }
  // Andere Systeme: Artefakte und Schätze (Teil A), mystische Begegnungen (Teil A)
  const ctx_ = lCtxOf(cx, cy, 'arte');
  if (typeof arteInChunk === 'function') { try { for (const s of arteInChunk(ctx_) || []) if (s && !(s.got || s.found || s.done) && isFinite(s.x) && isFinite(s.y)) lRecAdd(rec, { k: 'arte', s, x: s.x + LOFF, y: s.y + LOFF, r: 0, solid: false }); } catch (e) { console.error('Lande (arteInChunk):', e); } }
  if (typeof arteTreasureInChunk === 'function') { try { for (const s of arteTreasureInChunk(ctx_) || []) if (s && !(s.got || s.found || s.done) && isFinite(s.x) && isFinite(s.y)) lRecAdd(rec, { k: 'arteT', s, x: s.x + LOFF, y: s.y + LOFF, r: 0, solid: false }); } catch (e) { console.error('Lande (arteTreasureInChunk):', e); } }
  if (typeof encounterRoll === 'function' && !gate) { try { const e = encounterRoll(lCtxOf(cx, cy, 'enc')); if (e && isFinite(e.x) && isFinite(e.y) && !lTS('e' + key36(cx, cy))) lRecAdd(rec, { k: 'enc', enc: e, x: e.x + LOFF, y: e.y + LOFF, r: 0, solid: false, ek: 'e' + key36(cx, cy) }); } catch (e) { console.error('Lande (encounterRoll):', e); } }
  gatherApply(rec);   // in diesem Ausflug schon gefällt/abgebaut, Vogelnester (js/bauen.js)
}
function key36(cx, cy) { return cx.toString(36) + '.' + cy.toString(36); }
// Leuchtfeuer aus Spielständen vor den neuen Ringgrenzen (ohne cp.w), die heute in einer Barriere stehen: ringsum ein Durchgang
// (nur für diesen Spieler, nur in seinem Ausflug) – so bleibt das Leuchtfeuer Startpunkt und Ausgang. Neue Leuchtfeuer stehen nie in einer Barriere.
const LGAP = 7 * LTS;
function lWalkV(v, nd) { return v === 0 || v === 3 || (v === 2 && lToolBit(nd - 1)); }
function lBeaconGap(rec) {
  const d = rec.d, N = LPD;
  for (const cp of lMeta().cps) {
    if (cp.w) continue; const lx = cp.x + LOFF - rec.X0, ly = cp.y + LOFF - rec.Y0; if (lx < -LGAP || ly < -LGAP || lx > LCK + LGAP || ly > LCK + LGAP) continue;
    const bcx = Math.floor(cp.x / LCK), bcy = Math.floor(cp.y / LCK), bd = bcx === rec.cx && bcy === rec.cy ? d : lFixed(bcx, bcy), bi = (Math.floor((cp.y - bcy * LCK) / LTS) + 1) * N + Math.floor((cp.x - bcx * LCK) / LTS) + 1;
    if (!bd.bar[bi] || lWalkV(bd.wk[bi], bd.nd[bi])) continue;
    if (rec.wk === d.wk) rec.wk = d.wk.slice();
    for (let ty = 0; ty < N; ty++) for (let tx = 0; tx < N; tx++) { const i = ty * N + tx, k = d.bar[i] - 1; if (k < 0 || LBARK[k] === 'rand' || !LBAR[LBARK[k]].x) continue; const dx = (tx - .5) * LTS - lx, dy = (ty - .5) * LTS - ly; if (dx * dx + dy * dy < LGAP * LGAP) rec.wk[i] = 3; }
  }
}
function lVeinMat(bk, st, R) { const by = { schnee: 'mithril', gletscher: 'mithril', eiswueste: 'mithril', tundra: 'mithril', lava: 'glut', vulkan: 'glut', asche: 'glut', obsidian: 'glut', moor: 'adamant', giftmoor: 'adamant', blutmoor: 'adamant', ruine: 'kristall', kristall: 'kristall', salz: 'kristall', sternenfeld: 'stern', leere: 'aether', aether: 'aether', drachenland: 'schuppe', kristallwueste: 'kristall', glasduenen: 'kristall', sternmeer: 'stern', aschesturm: 'glut', knochenwald: 'adamant', scharlachsumpf: 'adamant', pilzriesen: 'adamant', uhrwerk: 'mithril', himmelsklippen: 'stern', titanengraeber: 'adamant', mondsee: 'stern', seelenfluss: 'aether', bernstein: 'schuppe', splittergebirge: 'kristall', sonnenschmiede: 'glut', frostkrone: 'mithril', traumwald: 'aether', spiegelwelt: 'kristall', zeitbruch: 'aether', leerenstrand: 'aether', rost: 'mithril', sternenwrack: 'stern', goetterdaemmerung: 'aether', urnebel: 'aether', schwarzsonne: 'glut', nichtsufer: 'aether' }; if (by[bk] && R() < .6) return by[bk]; return st >= 60 && R() < .3 ? 'aether' : st >= 30 && R() < .3 ? 'stern' : st >= 22 && R() < .3 ? 'schuppe' : st >= 14 && R() < .4 ? 'mithril' : 'erz'; }
// Objekte in einem Kreis um (x, y) – über Chunkgrenzen hinweg
function lGridRec(rec, x, y, rad, fn) {
  const x0 = clamp(Math.floor((x - rad - rec.X0) / LGC), 0, LGN - 1), x1 = clamp(Math.floor((x + rad - rec.X0) / LGC), 0, LGN - 1), y0 = clamp(Math.floor((y - rad - rec.Y0) / LGC), 0, LGN - 1), y1 = clamp(Math.floor((y + rad - rec.Y0) / LGC), 0, LGN - 1);
  for (let gy = y0; gy <= y1; gy++) for (let gx = x0; gx <= x1; gx++) for (const o of rec.grid[gy * LGN + gx]) fn(o);
}
function lGridEach(x, y, rad, fn) {
  const L = LW; if (!L) return;
  const gx0 = Math.floor((x - rad) / LGC), gx1 = Math.floor((x + rad) / LGC), gy0 = Math.floor((y - rad) / LGC), gy1 = Math.floor((y + rad) / LGC);
  let last = null, lk = -1;
  for (let gy = gy0; gy <= gy1; gy++) for (let gx = gx0; gx <= gx1; gx++) {
    const cx = Math.floor(gx / LGN) - LOC, cy = Math.floor(gy / LGN) - LOC, k = lCK(cx, cy);
    if (k !== lk) { lk = k; last = L.cm.get(k) || null; } if (!last) continue;
    const c = last.grid[(gy - (cy + LOC) * LGN) * LGN + gx - (cx + LOC) * LGN]; if (c) for (const o of c) fn(o);
  }
}

/* ---------- Streaming: Daten 5 × 5, Boden 3 × 3, alles andere wird vergessen ---------- */
const LCVPOOL = [];
let LRL = null;
function lRecAt(x, y) { const L = LW; if (!L) return null; const cx = Math.floor(x / LCK) - LOC, cy = Math.floor(y / LCK) - LOC; if (LRL && LRL.cx === cx && LRL.cy === cy && LRL.live) return LRL; const r = L.cm.get(lCK(cx, cy)) || null; if (r) LRL = r; return r; }
function lTileI(r, x, y) { return (Math.floor((y - r.Y0) / LTS) + 1) * LPD + Math.floor((x - r.X0) / LTS) + 1; }
function lWalk(x, y) { const r = lRecAt(x, y); if (!r) return true; const i = lTileI(r, x, y), v = r.wk[i]; return v === 0 || v === 3 || (v === 2 && lToolBit(r.d.nd[i] - 1)); }
function lEnsure(cx, cy) { const k = lCK(cx, cy); let r = LW.cm.get(k); if (!r) r = lLoad(cx, cy); r.used = T; return r; }
function lUnpaint(r) { if (r.cv && LCVPOOL.length < 10) LCVPOOL.push(r.cv); r.cv = r.g = null; r.ps = 0; r.pd = false; }
function lFree(r) { lUnpaint(r); r.live = false; if (LRL === r) LRL = null; }
function lStream(force) {
  const L = LW, pcx = Math.floor(P.x / LCK) - LOC, pcy = Math.floor(P.y / LCK) - LOC;
  if (pcx !== L.pcx || pcy !== L.pcy || force) {
    L.pcx = pcx; L.pcy = pcy;
    for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) lEnsure(pcx + i, pcy + j);
    // weit weg: vergessen (Leinwand zurück in den Vorrat)
    for (const [k, r] of L.cm) { const dd = Math.max(Math.abs(r.cx - pcx), Math.abs(r.cy - pcy)); if (dd > 2) { lFree(r); L.cm.delete(k); } else if (dd > 1 && r.cv) lUnpaint(r); }
    L.q = []; for (let j = -2; j <= 2; j++) for (let i = -2; i <= 2; i++) if (!L.cm.has(lCK(pcx + i, pcy + j))) L.q.push([pcx + i, pcy + j, i * i + j * j]); L.q.sort((a, b) => a[2] - b[2]);
    // Seen der nahen Chunks sind echte Pfützen (Wasser bremst, Lava brennt)
    pools = []; for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) { const r = L.cm.get(lCK(pcx + i, pcy + j)); if (r) for (const l of r.d.lakes) pools.push(l); }
    L.patsDirty = true;
  }
  // Vorladen: höchstens ~3 ms je Bild, große Chunks in Häppchen über mehrere Bilder
  const t0 = performance.now();
  while (performance.now() - t0 < 3) {
    if (!LGEN) {
      let nx; while ((nx = L.q.shift()) && L.cm.has(lCK(nx[0], nx[1]))); if (!nx) break;
      const key = lCK(nx[0], nx[1]); if (LFIX.has(key)) { lLoad(nx[0], nx[1]); continue; }
      LGEN = { key, cx: nx[0], cy: nx[1], it: lGenIt(nx[0], nx[1]) };
    }
    const r = LGEN.it.next();
    if (r.done) { const g = LGEN; LGEN = null; lFixPut(g.key, r.value); if (!L.cm.has(g.key) && Math.max(Math.abs(g.cx - pcx), Math.abs(g.cy - pcy)) <= 2) lLoad(g.cx, g.cy); }
  }
  // Boden der nahen Chunks in Häppchen malen, bevor er ins Bild kommt
  for (let j = -1; j <= 1 && performance.now() - t0 < 4; j++) for (let i = -1; i <= 1; i++) { const r = L.cm.get(lCK(pcx + i, pcy + j)); if (r && !r.pd) { lPaintStep(r, t0 + 4); break; } }
}
// Hintergrund zeichnen (js/render.js ruft bg.draw statt des Ganzen-Karte-Bildes)
function lBgDraw() {
  const L = LW; if (!L) return;
  const cx0 = Math.floor(CX / LCK) - LOC, cx1 = Math.floor((CX + VW) / LCK) - LOC, cy0 = Math.floor(CY / LCK) - LOC, cy1 = Math.floor((CY + VH) / LCK) - LOC;
  for (let cy = cy0; cy <= cy1; cy++) for (let cx = cx0; cx <= cx1; cx++) {
    // nach dem Ausflug (Entkommen-/Tod-Bildschirm): nur noch zeigen, was schon gemalt ist
    const r = L.on ? lEnsure(cx, cy) : L.cm.get(lCK(cx, cy)); if (!r) continue; if (!r.pd) { if (!L.on && !r.cv) continue; lPaintStep(r, Infinity); }
    ctx.drawImage(r.cv, r.X0 - CX, r.Y0 - CY);
  }
}
// Nach dem Ausflug: Leinwände in den Vorrat, Chunks vergessen (die Welt-Daten bleiben im kleinen Zwischenspeicher)
function lRelease() { if (!LW || LW.on) return; for (const r of LW.cm.values()) lFree(r); LW.cm.clear(); LW = null; LRL = null; }
// Blut und Brandflecken (decal/scorch in js/combat.js) landen auf der Leinwand des passenden Chunks
const LDEC = {
  globalAlpha: 1, fillStyle: '#000', e: null,
  fillRect(x, y, w, h) { const r = lRecAt(x, y); if (!r || !r.pd) return; r.g.globalAlpha = this.globalAlpha; r.g.fillStyle = this.fillStyle; r.g.fillRect(Math.floor(x - r.X0), Math.floor(y - r.Y0), w, h); r.g.globalAlpha = 1; },
  beginPath() { this.e = null; }, ellipse(x, y, rx, ry) { this.e = [x, y, rx, ry]; },
  fill() { const e = this.e, r = e && lRecAt(e[0], e[1]); if (!r || !r.pd) return; const g = r.g; g.globalAlpha = this.globalAlpha; g.fillStyle = this.fillStyle; g.beginPath(); g.ellipse(e[0] - r.X0, e[1] - r.Y0, e[2], e[3], 0, 0, 7); g.fill(); g.globalAlpha = 1; },
  stroke() { }, moveTo() { }, lineTo() { }, arc() { }, closePath() { }
};

/* ---------- Pixel-Grafik: Boden je Biom, Barrieren, Übergänge ---------- */
const LTILE = {}, LSPR = {}, LCHI = {}, LPROP = {};
function lTiles(key) {
  if (LTILE[key]) return LTILE[key];
  const B = key === 'weg' ? { g: ['#7a5c3c', '#6c5034', '#876848', '#5e462e'], tx: 'weg' } : LANDE_BIOMES[key], R = mulberry(hashStr(key)), out = [], tx = B.tx;
  for (let v = 0; v < 6; v++) out.push(mk(16, 16, g => {
    if (tx === 'floor') { const f = FLOORS[v % FLOORS.length]; g.drawImage(SHEET, f[0], f[1], 16, 16, 0, 0, 16, 16); g.globalAlpha = .45; g.fillStyle = B.g[0]; g.fillRect(0, 0, 16, 16); g.globalAlpha = 1; for (let i = 0; i < 8; i++) px(g, Math.floor(R() * 16), Math.floor(R() * 16), 1, 1, R() < .5 ? B.g[2] : B.g[3]); return; }
    g.fillStyle = B.g[0]; g.fillRect(0, 0, 16, 16);
    for (let i = 0; i < 64; i++) px(g, Math.floor(R() * 16), Math.floor(R() * 16), 1, 1, B.g[1 + Math.floor(R() * 3)]);
    const P_ = (n, c, w, h) => { for (let i = 0; i < n; i++) px(g, Math.floor(R() * 16), Math.floor(R() * 16), w || 1, h || 1, c); };
    switch (tx) {
      case 'gras': for (let i = 0; i < 4; i++) { const x = Math.floor(R() * 15), y = 2 + Math.floor(R() * 13); px(g, x, y - 2, 1, 2, B.g[2]); px(g, x + 1, y - 1, 1, 1, B.g[2]); } break;
      case 'weg': P_(3, '#9a7a54', 2, 1); break;
      case 'schnee': if (R() < .6) P_(2, '#ffffff'); break;
      case 'sand': for (let i = 0; i < 2; i++) { const y = Math.floor(R() * 15), x = Math.floor(R() * 10); px(g, x, y, 4, 1, B.g[2]); px(g, x + 4, y + 1, 2, 1, B.g[2]); } if (R() < .3) P_(1, B.g[3], 2, 1); break;
      case 'eis': { let x = Math.floor(R() * 16), y = Math.floor(R() * 16); for (let k = 0; k < 7; k++) { px(g, x, y, 1, 1, '#7aa0c0'); x = (x + 1) % 16; y = (y + (R() < .5 ? 1 : 0)) % 16; } if (R() < .5) P_(2, '#ffffff'); break; }
      case 'stein': { let x = Math.floor(R() * 16), y = Math.floor(R() * 16); for (let k = 0; k < 5; k++) { px(g, x, y, 1, 1, B.g[3]); x = (x + (R() < .5 ? 1 : 0)) % 16; y = (y + 1) % 16; } break; }
      case 'lava': if (v < 3) { let x = Math.floor(R() * 16), y = Math.floor(R() * 16); for (let k = 0; k < 6; k++) { px(g, x, y, 1, 1, k % 2 ? '#c8401e' : '#7a2412'); x = (x + 1) % 16; y = (y + (R() < .5 ? 1 : 0)) % 16; } } break;
      case 'asche': if (R() < .5) P_(1, '#a84a2a'); P_(2, '#5a5052'); break;
      case 'leere': if (R() < .45) P_(1, R() < .5 ? '#b892f4' : '#ffffff'); break;
      case 'kristall': if (R() < .6) { const x = Math.floor(R() * 14), y = Math.floor(R() * 14); px(g, x, y, 1, 2, '#b0c8ff'); px(g, x, y, 1, 1, '#ffffff'); } break;
      case 'salz': { const y = Math.floor(R() * 16); px(g, 0, y, 16, 1, B.g[2]); const x = Math.floor(R() * 16); px(g, x, 0, 1, 16, B.g[2]); break; }
      case 'blut': P_(3, '#2a0e0c'); if (R() < .3) P_(1, '#a83a2a', 2, 1); break;
      case 'erde': if (R() < .4) P_(1, B.g[3], 2, 1); break;
      // Böden der Tiefe
      case 'glas': for (let i = 0; i < 2; i++) { let x = Math.floor(R() * 16), y = Math.floor(R() * 16); for (let k = 0; k < 4; k++) { px(g, x, y, 1, 1, k ? B.g[2] : '#ffffff'); x = (x + 1) % 16; y = (y + 15) % 16; } } if (R() < .3) P_(1, '#9ad8e8'); break;
      case 'knochen': if (R() < .55) { const x = 1 + Math.floor(R() * 11), y = 1 + Math.floor(R() * 14); px(g, x, y, 4, 1, '#d8d0bc'); px(g, x, y - 1, 1, 1, '#e8e2cf'); px(g, x + 3, y + 1, 1, 1, '#e8e2cf'); } P_(2, '#8a8270'); break;
      case 'metall': px(g, 0, 0, 16, 1, B.g[3]); px(g, 0, 0, 1, 16, B.g[3]); px(g, 1, 1, 15, 1, B.g[2]); for (const [x, y] of [[2, 2], [13, 2], [2, 13], [13, 13]]) px(g, x, y, 1, 1, '#c8a060'); if (R() < .3) P_(2, '#8a4a1a'); break;
      case 'wolke': if (R() < .45) { const x = Math.floor(R() * 11), y = 1 + Math.floor(R() * 12); px(g, x, y, 5, 2, '#e8f0f8'); px(g, x + 1, y - 1, 3, 1, '#ffffff'); px(g, x, y + 2, 5, 1, B.g[2]); } break;
      case 'mond': if (R() < .4) { const x = 2 + Math.floor(R() * 11), y = 2 + Math.floor(R() * 11); px(g, x, y, 3, 1, B.g[3]); px(g, x, y + 1, 1, 1, B.g[3]); px(g, x + 1, y + 1, 2, 1, B.g[2]); } if (R() < .4) P_(1, '#ffffff'); break;
      case 'seele': { let x = Math.floor(R() * 16), y = Math.floor(R() * 16); for (let k = 0; k < 7; k++) { px(g, x, y, 1, 1, k % 2 ? B.g[2] : '#9af0e0'); x = (x + 1) % 16; y = (y + (R() < .5 ? 1 : 15)) % 16; } break; }
      case 'bernstein': if (R() < .55) { const x = Math.floor(R() * 14), y = Math.floor(R() * 14); px(g, x, y, 2, 2, '#e89a2a'); px(g, x, y, 1, 1, '#ffd070'); } break;
      case 'riss': if (R() < .6) { let x = Math.floor(R() * 16), y = 0; for (let k = 0; k < 9; k++) { px(g, x, y, 1, 1, B.g[3]); x = (x + (R() < .5 ? 1 : 15)) % 16; y = (y + 1) % 16; } } if (R() < .3) P_(1, '#e8f8ff'); break;
      case 'traum': if (R() < .7) px(g, Math.floor(R() * 16), Math.floor(R() * 16), 1, 1, ['#ffc0e8', '#c0e0ff', '#fff0b0'][Math.floor(R() * 3)]); break;
      case 'zeit': { const y0 = Math.floor(R() * 16); for (let x = 0; x < 16; x++) if ((x + y0) % 3) px(g, x, (y0 + Math.round(Math.sin(x / 2.5) * 1.5)) & 15, 1, 1, B.g[2]); if (R() < .35) P_(1, '#ffe08a'); break; }
      case 'rost': if (R() < .55) P_(2, '#a8501a', 2, 1); P_(2, '#4a2410'); break;
      case 'sternstaub': P_(3, R() < .5 ? '#ffffff' : '#c0c8ff'); if (R() < .4) P_(1, '#ffd24a'); break;
      case 'nichts': if (R() < .35) P_(1, '#ffffff'); if (R() < .4) P_(1, '#4a3a6a', 2, 1); break;
    }
  }));
  return LTILE[key] = out;
}
function lBarTiles(k) {
  const key = 'b:' + k; if (LTILE[key]) return LTILE[key];
  const B = LBAR[k], C = B.c, R = mulberry(hashStr(key)), out = [];
  for (let v = 0; v < 4; v++) out.push(mk(16, 16, g => {
    g.fillStyle = C[0]; g.fillRect(0, 0, 16, 16);
    const P_ = (n, c, w, h) => { for (let i = 0; i < n; i++) px(g, Math.floor(R() * 16), Math.floor(R() * 16), w || 1, h || 1, c); };
    switch (k) {
      case 'schlucht': P_(40, C[1]); P_(4, C[2]); break;
      case 'fluss': case 'gezeiten': P_(30, C[1]); for (let i = 0; i < 3; i++) { const x = Math.floor(R() * 12), y = Math.floor(R() * 16); px(g, x, y, 4, 1, C[2]); } break;
      case 'gift': P_(30, C[1]); P_(4, '#5a7a2a', 2, 1); if (R() < .6) { const x = Math.floor(R() * 14), y = Math.floor(R() * 14); px(g, x, y, 2, 2, C[2]); px(g, x, y, 1, 1, '#e8ffa0'); } break;
      case 'eis': P_(20, '#c8e4f4'); for (let i = 0; i < 2; i++) { const y = Math.floor(R() * 16); px(g, 0, y, 16, 1, C[1]); px(g, 0, y + 1, 16, 1, C[2]); } break;
      case 'lava': P_(26, '#ff6a2a'); P_(10, C[1], 2, 1); P_(3, '#ffe08a'); break;
      case 'finster': P_(30, C[1]); if (R() < .5) P_(2, C[2], 2, 1); break;
      case 'dornen': for (let i = 0; i < 5; i++) { let x = Math.floor(R() * 16), y = Math.floor(R() * 16); for (let s = 0; s < 6; s++) { px(g, x, y, 1, 1, s % 3 ? C[3] : C[1]); x = (x + 1) % 16; y = (y + (R() < .5 ? 1 : 15)) % 16; } } P_(5, C[2]); if (R() < .3) P_(1, '#c8342c'); break;
      case 'sturm': for (let i = 0; i < 4; i++) { const y = Math.floor(R() * 16), x = Math.floor(R() * 10); px(g, x, y, 6, 1, C[2]); px(g, x + 2, y + 1, 4, 1, C[3]); } P_(10, C[1]); break;
      case 'siegel': P_(14, C[1]); px(g, 0, 7, 16, 1, C[1]); px(g, 7, 0, 1, 7, C[1]); px(g, 3, 8, 1, 8, C[1]); if (v % 2) { px(g, 6, 3, 4, 1, C[2]); px(g, 7, 2, 2, 3, C[2]); px(g, 5, 11, 6, 1, C[2]); } break;
      case 'leere': P_(8, '#120a1e'); if (R() < .5) P_(1, R() < .5 ? C[2] : '#ffffff'); break;
      case 'rand': if (R() < .3) P_(1, '#ffffff'); if (R() < .4) P_(1, '#2a1e44'); if (R() < .1) P_(1, '#b892f4'); break;   // das Nichts: fast schwarz, ferne Sterne
      // Grenzen der Tiefe
      case 'kluft': P_(36, C[1]); for (let i = 0; i < 2; i++) { const x = 1 + Math.floor(R() * 13), y = 2 + Math.floor(R() * 12); px(g, x, y, 1, 3, C[3]); px(g, x + 1, y + 1, 1, 2, C[2]); px(g, x + 1, y, 1, 1, '#ffffff'); } break;
      case 'blutnebel': P_(26, C[1]); for (let i = 0; i < 3; i++) { const x = Math.floor(R() * 13), y = Math.floor(R() * 14); px(g, x, y, 3, 2, '#7a1e2a'); px(g, x + 1, y, 1, 1, C[2]); } break;
      case 'abbruch': P_(20, C[1]); for (let i = 0; i < 2; i++) { const x = Math.floor(R() * 11), y = Math.floor(R() * 14); px(g, x, y, 6, 2, '#e8f4ff'); px(g, x + 1, y - 1, 4, 1, '#ffffff'); } break;
      case 'seelenstrom': P_(24, C[1]); for (let i = 0; i < 3; i++) { const x = Math.floor(R() * 12), y = Math.floor(R() * 16); px(g, x, y, 4, 1, '#3a8a80'); } if (R() < .6) { const x = 2 + Math.floor(R() * 12), y = 2 + Math.floor(R() * 12); px(g, x, y, 1, 2, C[2]); px(g, x, y - 1, 1, 1, '#ffffff'); } break;
      case 'sternglut': P_(24, '#ffc040'); P_(10, C[1], 2, 1); P_(4, '#ffffff'); break;
      case 'traum': P_(24, C[1]); for (let i = 0; i < 3; i++) px(g, Math.floor(R() * 16), Math.floor(R() * 16), 1, 1, ['#ffc0f0', '#c0e0ff', '#fff0b0'][i]); if (R() < .4) P_(1, '#ffffff'); break;
      case 'zeitstrom': P_(22, C[1]); { const y0 = Math.floor(R() * 16); for (let x = 0; x < 16; x++) px(g, x, (y0 + Math.round(Math.sin(x / 2) * 2)) & 15, 1, 1, '#8a7a3a'); } if (R() < .5) { const x = 3 + Math.floor(R() * 9), y = 3 + Math.floor(R() * 9); px(g, x, y, 3, 1, C[2]); px(g, x + 1, y + 1, 1, 1, C[2]); px(g, x, y + 2, 3, 1, C[2]); } break;
      case 'splitter': P_(18, C[1]); for (let i = 0; i < 3; i++) { const x = Math.floor(R() * 14), y = 3 + Math.floor(R() * 12); for (let k = 0; k < 4; k++) px(g, x + (k >> 1), y - k, 1, 1, k === 3 ? '#ffffff' : C[3]); } P_(2, C[2]); break;
      case 'weltsiegel': P_(16, C[1]); px(g, 0, 7, 16, 1, C[3]); px(g, 7, 0, 1, 16, C[3]); if (v % 2) { px(g, 6, 6, 4, 4, C[2]); px(g, 7, 5, 2, 6, C[2]); px(g, 5, 7, 6, 2, C[2]); px(g, 7, 7, 2, 2, '#ffffff'); } else P_(3, '#b892f4'); break;
    }
  }));
  return LTILE[key] = out;
}
// Übergänge: Planken, Brücke, Pfad, Stufen … (über dem Barrieren-Grund)
function lCrossTiles(k) {
  const key = 'x:' + k; if (LTILE[key]) return LTILE[key];
  const B = LBAR[k], st = B.x, R = mulberry(hashStr(key)), base = lBarTiles(k), out = [];
  for (let v = 0; v < 2; v++) out.push(mk(16, 16, g => {
    const opaque = ['planken', 'bruecke', 'pfad', 'stufen', 'schneise', 'kseil', 'kraut', 'gebein', 'schnitt', 'weltor'].includes(st);
    if (!opaque) g.drawImage(base[v], 0, 0);
    switch (st) {
      case 'planken': g.fillStyle = '#5e3a1e'; g.fillRect(0, 0, 16, 16); for (let x = 0; x < 16; x += 4) { px(g, x, 0, 3, 16, x % 8 ? '#8a5a32' : '#9a6a3a'); px(g, x + 1, 2 + Math.floor(R() * 12), 1, 1, '#5e3a1e'); } break;
      case 'bruecke': g.fillStyle = '#6a6672'; g.fillRect(0, 0, 16, 16); for (let y = 0; y < 16; y += 4) for (let x = (y / 4) % 2 * 3; x < 16; x += 6) { px(g, x, y, 5, 3, R() < .5 ? '#8a8692' : '#7a7682'); } break;
      case 'pfad': case 'schneise': g.fillStyle = st === 'pfad' ? '#5a5a2a' : '#6a5a3a'; g.fillRect(0, 0, 16, 16); for (let i = 0; i < 30; i++) px(g, Math.floor(R() * 16), Math.floor(R() * 16), 1, 1, R() < .5 ? '#7a6a4a' : '#4a4222'); break;
      case 'stufen': g.fillStyle = '#c8e4f4'; g.fillRect(0, 0, 16, 16); for (let y = 0; y < 16; y += 4) { px(g, 0, y, 16, 1, '#ffffff'); px(g, 0, y + 3, 16, 1, '#7aa0c0'); } break;
      case 'steine': case 'pfeiler': for (let i = 0; i < 2; i++) { const x = 2 + Math.floor(R() * 8), y = 2 + Math.floor(R() * 8); px(g, x, y, 5, 4, st === 'steine' ? '#2a1e1e' : '#6a7080'); px(g, x + 1, y, 3, 1, st === 'steine' ? '#5a4a4a' : '#9aa2ae'); } break;
      case 'licht': for (let i = 0; i < 4; i++) px(g, Math.floor(R() * 16), Math.floor(R() * 16), 2, 2, 'rgba(255,224,138,.55)'); px(g, 4, 4, 8, 8, 'rgba(255,240,190,.22)'); break;
      case 'tor': px(g, 2, 0, 12, 16, '#2e2a36'); px(g, 4, 2, 8, 12, '#4a3a20'); px(g, 7, 6, 2, 3, '#e8b04a'); break;
      case 'anker': px(g, 3, 3, 10, 10, 'rgba(192,96,255,.35)'); px(g, 6, 6, 4, 4, '#c060ff'); px(g, 7, 7, 2, 2, '#ffffff'); break;
      // Übergänge der Tiefe
      case 'kseil': g.fillStyle = '#0a0818'; g.fillRect(0, 0, 16, 16); for (let x = 0; x < 16; x += 4) px(g, x, 2, 3, 12, x % 8 ? '#5a6a9a' : '#6a7aaa'); px(g, 0, 1, 16, 1, '#c8d8ff'); px(g, 0, 14, 16, 1, '#c8d8ff'); px(g, Math.floor(R() * 14), 1, 2, 1, '#ffffff'); break;
      case 'kraut': g.fillStyle = '#3a2a22'; g.fillRect(0, 0, 16, 16); for (let i = 0; i < 26; i++) px(g, Math.floor(R() * 16), Math.floor(R() * 16), 1, 1, R() < .5 ? '#5a4a3a' : '#2a1e18'); for (let i = 0; i < 3; i++) { const x = Math.floor(R() * 14), y = Math.floor(R() * 14); px(g, x, y, 2, 1, '#6aa84a'); px(g, x + 1, y - 1, 1, 1, '#a0e070'); } break;
      case 'schwebe': for (let i = 0; i < 2; i++) { const x = 1 + Math.floor(R() * 9), y = 1 + Math.floor(R() * 9); px(g, x, y + 4, 6, 2, 'rgba(0,0,40,.25)'); px(g, x, y, 6, 4, '#7a8290'); px(g, x, y, 6, 1, '#b8c0cc'); px(g, x + 1, y + 4, 4, 1, '#4a5260'); } break;
      case 'gebein': g.fillStyle = '#b8b0a0'; g.fillRect(0, 0, 16, 16); for (let y = 0; y < 16; y += 4) for (let x = (y / 4) % 2 * 3; x < 16; x += 6) px(g, x, y, 5, 3, R() < .5 ? '#e8e2cf' : '#d8d0bc'); px(g, 0, 0, 16, 1, '#8a8270'); px(g, 0, 15, 16, 1, '#8a8270'); break;
      case 'glutstein': for (let i = 0; i < 2; i++) { const x = 2 + Math.floor(R() * 8), y = 2 + Math.floor(R() * 8); px(g, x - 1, y - 1, 7, 6, '#ffe08a'); px(g, x, y, 5, 4, '#1e1414'); px(g, x + 1, y, 3, 1, '#4a3a3a'); } break;
      case 'wachlicht': for (let i = 0; i < 4; i++) px(g, Math.floor(R() * 15), Math.floor(R() * 15), 2, 2, 'rgba(255,220,250,.6)'); px(g, 4, 4, 8, 8, 'rgba(255,240,255,.25)'); break;
      case 'stunde': px(g, 3, 2, 10, 12, '#4a4460'); px(g, 4, 3, 8, 2, '#e8c860'); px(g, 4, 11, 8, 2, '#e8c860'); px(g, 6, 5, 4, 2, '#ffe08a'); px(g, 7, 7, 2, 2, '#ffe08a'); px(g, 6, 9, 4, 2, '#c8a040'); break;
      case 'schnitt': g.fillStyle = '#4a5260'; g.fillRect(0, 0, 16, 16); for (let i = 0; i < 26; i++) px(g, Math.floor(R() * 16), Math.floor(R() * 16), 1, 1, R() < .5 ? '#6a7484' : '#3a4250'); px(g, Math.floor(R() * 16), Math.floor(R() * 16), 1, 1, '#e8f8ff'); break;
      case 'weltor': g.fillStyle = '#2a2440'; g.fillRect(0, 0, 16, 16); px(g, 1, 0, 3, 16, '#4a4060'); px(g, 12, 0, 3, 16, '#4a4060'); px(g, 4, 0, 8, 16, '#3a3050'); px(g, 7, 2, 2, 12, '#ffd24a'); px(g, 5, 7, 6, 2, '#ffd24a'); px(g, 7, 7, 2, 2, '#ffffff'); break;
    }
  }));
  return LTILE[key] = out;
}
// Ein Häppchen Boden malen – eine Reihe Kacheln, eine Reihe Kanten, Seen und Plätze, eine Reihe Kleinkram – bis zur Frist
function lPaintStep(rec, until) {
  if (!rec.cv) { rec.cv = LCVPOOL.pop() || mk(LCK, LCK); rec.g = rec.cv.getContext('2d'); rec.g.imageSmoothingEnabled = false; rec.ps = 0; }
  const d = rec.d, g = rec.g, N = LPD, gx0 = rec.cx * LCT, gy0 = rec.cy * LCT, NB = LCT / 4, wk = rec.wk || d.wk;
  while (!rec.pd) {
    const ps = rec.ps++;
    if (ps < NB) {
      // Kacheln in Blöcken zu 4 × 4: einheitliche Blöcke als ein Bild, gemischte (Grenzen, Wege, Barrieren) Kachel für Kachel
      const by = ps;
      for (let bx = 0; bx < NB; bx++) {
        const i0 = (by * 4 + 1) * N + bx * 4 + 1, r0 = d.rg[i0]; let uni = true;
        for (let j = 0; j < 4 && uni; j++) for (let i = 0; i < 4; i++) { const k = i0 + j * N + i; if (d.bar[k] || d.road[k] || d.rg[k] !== r0) { uni = false; break; } }
        if (uni) { g.drawImage(lMacro(d.regs[r0].biome)[lH(rec.cx * NB + bx, rec.cy * NB + by, 4) % 6], bx * 64, by * 64); continue; }
        for (let j = 0; j < 4; j++) for (let i = 0; i < 4; i++) {
          const tx = bx * 4 + i, ty = by * 4 + j, k = i0 + j * N + i, h = lH(gx0 + tx, gy0 + ty, 3);
          if (d.bar[k]) { const bk = LBARK[d.bar[k] - 1]; g.drawImage(wk[k] >= 2 ? lCrossTiles(bk)[h & 1] : lBarTiles(bk)[h & 3], tx * LTS, ty * LTS); }
          else g.drawImage(lTiles(d.road[k] ? 'weg' : d.regs[d.rg[k]].biome)[h % 6], tx * LTS, ty * LTS);
        }
      }
    } else if (ps < NB + LCT) lPaintEdges(rec, ps - NB);
    else if (ps === NB + LCT) lPaintLakes(rec);
    else if (ps < NB + 2 * LCT + 1) lPaintDeco(rec, ps - NB - LCT - 1);
    else rec.pd = true;
    if (performance.now() > until) break;
  }
}
// Großkacheln (4 × 4 Kacheln) je Biom: weniger Zeichenaufrufe beim Malen eines Chunks
function lMacro(key) { const k = 'm:' + key; if (LTILE[k]) return LTILE[k]; while (!lMacroStep(key)); return LTILE[k]; }
// eine Großkachel mehr bauen (true, wenn alle sechs fertig sind) – so verteilt sich die Arbeit beim Vorladen
function lMacroStep(key) {
  const k = 'm:' + key; if (LTILE[k]) return true;
  const p = LTILE['mp:' + key] || (LTILE['mp:' + key] = { R: mulberry(hashStr(k)), out: [] }), T_ = lTiles(key);
  p.out.push(mk(64, 64, g => { for (let j = 0; j < 4; j++) for (let i = 0; i < 4; i++) g.drawImage(T_[Math.floor(p.R() * 6)], i * 16, j * 16); }));
  if (p.out.length < 6) return false; LTILE[k] = p.out; delete LTILE['mp:' + key]; return true;
}
// Kanten einer Kachelreihe: zwischen Biomen eine unregelmäßige Pixelkante (von beiden Seiten gleich berechnet), Barrieren mit Rand, Wege mit Saum
function lPaintEdges(rec, ty) {
  const d = rec.d, g = rec.g, N = LPD, gx0 = rec.cx * LCT, gy0 = rec.cy * LCT;
  for (let tx = 0; tx < LCT; tx++) {
    const i = (ty + 1) * N + tx + 1, X = tx * LTS, Y = ty * LTS;
    if (d.bar[i]) {
      if ((rec.wk || d.wk)[i] >= 2) continue; const C = LBAR[LBARK[d.bar[i] - 1]].c;
      if (!d.bar[i - N]) { px(g, X, Y, 16, 2, C[3]); px(g, X, Y + 2, 16, 1, C[1]); }
      if (!d.bar[i + N]) { px(g, X, Y + 14, 16, 2, C[3]); px(g, X, Y + 13, 16, 1, C[2]); }
      if (!d.bar[i - 1]) px(g, X, Y, 2, 16, C[3]); if (!d.bar[i + 1]) px(g, X + 14, Y, 2, 16, C[3]);
      continue;
    }
    if (d.road[i]) {
      for (let side = 0; side < 4; side++) {
        const j = side === 0 ? i - N : side === 1 ? i + N : side === 2 ? i - 1 : i + 1; if (d.road[j] || d.bar[j]) continue;
        let s = lH(gx0 + tx, gy0 + ty, 17 + side);
        for (let k = 0; k < 16; k++) { s = Math.imul(s, 1664525) + 1013904223 | 0; const r = (s >>> 0) / 4294967296, w = 1 + (r < .5 ? 0 : 1), c = (r * 7) % 1 < .6 ? '#4e3a26' : '#5e462e'; if (side === 0) px(g, X + k, Y, 1, w, c); else if (side === 1) px(g, X + k, Y + 16 - w, 1, w, c); else if (side === 2) px(g, X, Y + k, w, 1, c); else px(g, X + 16 - w, Y + k, w, 1, c); }
      }
      continue;
    }
    const Bi = LANDE_BIOMES[d.regs[d.rg[i]].biome];
    for (let side = 0; side < 4; side++) {
      const vert = side < 2, j = side === 0 ? i - 1 : side === 1 ? i + 1 : side === 2 ? i - N : i + N;
      if (d.bar[j] || d.road[j] || d.rg[j] === d.rg[i]) continue; const Bj = LANDE_BIOMES[d.regs[d.rg[j]].biome]; if (Bj === Bi) continue;
      const mine = j > i, far = vert ? (mine ? tx + 1 : tx) : (mine ? ty + 1 : ty), cn = Bj.g;   // die Kante gehört der Weltlage, nicht dem Chunk
      let s = lH(vert ? gx0 + far : gx0 + tx, vert ? gy0 + ty : gy0 + far, vert ? 31 : 37), dd = 0;
      for (let k = 0; k < 16; k++) {
        s = Math.imul(s, 1664525) + 1013904223 | 0; const r = (s >>> 0) / 4294967296;
        dd = clamp(dd + (r < .3 ? -1 : r < .6 ? 1 : 0), -3, 3); const c = cn[(r * 13) % 1 < .8 ? 0 : 1];
        // dd < 0: die zweite (rechte/untere) Kachel reicht herüber, dd > 0: die erste – jede Seite malt nur ihre eigenen Pixel
        if (vert) { if (mine && dd < 0) px(g, X + 16 + dd, Y + k, -dd, 1, c); else if (!mine && dd > 0) px(g, X, Y + k, dd, 1, c); }
        else { if (mine && dd < 0) px(g, X + k, Y + 16 + dd, 1, -dd, c); else if (!mine && dd > 0) px(g, X + k, Y, 1, dd, c); }
      }
    }
  }
}
function lPaintLakes(rec) {
  const g = rec.g;
  for (const l of rec.d.lakes) { const x = l.x - rec.X0, y = l.y - rec.Y0, C = lPC(l.k); g.fillStyle = C[0]; g.beginPath(); g.ellipse(x, y, l.rx + 2, l.ry + 1.5, 0, 0, 7); g.fill(); g.fillStyle = C[1]; g.beginPath(); g.ellipse(x, y, l.rx, l.ry, 0, 0, 7); g.fill(); g.fillStyle = C[2]; g.globalAlpha = .6; g.beginPath(); g.ellipse(x - l.rx * .3, y - l.ry * .3, l.rx * .35, l.ry * .3, 0, 0, 7); g.fill(); g.globalAlpha = 1; }
  // Plätze: Tor, Lager, Horte
  const disc = (x, y, r, c1, c2, n) => { const R = mulberry(lH(Math.round(x), Math.round(y), 5)); for (let dy = -r; dy <= r; dy++) { const hw = Math.floor(Math.sqrt(r * r - dy * dy) * 1.25); px(g, x - hw, y + dy, hw * 2 + 1, 1, c1); } for (let k = 0; k < n; k++) { const a = R() * 6.283, rr = Math.sqrt(R()) * r; px(g, x + Math.cos(a) * rr * 1.25, y + Math.sin(a) * rr, 2, 1, c2); } };
  for (const p of rec.d.pois) {
    const x = Math.round(p.x - rec.X0), y = Math.round(p.y - rec.Y0);
    if (p.k === 'gate') { disc(x, y + 30, 54, '#5a5662', '#7a7682', 160); for (let a = 0; a < 6.28; a += .5) px(g, x + Math.cos(a) * 64, y + 30 + Math.sin(a) * 50, 3, 2, '#6ae08a'); }
    else if (p.k === 'out') disc(x, y, 62, p.gate ? '#6e5a40' : '#6a5a42', '#8a7656', 120);
    else if (p.k === 'lair') disc(x, y, 34, '#3e3438', '#d8d0bc', 30);
    else if (p.k === 'tool') { disc(x, y, 46, '#4a4652', '#6a6672', 90); for (let a = 0; a < 6.28; a += .26) px(g, x + Math.cos(a) * 56, y + Math.sin(a) * 44, 2, 2, LANDE_TOOLS[p.tk].c); }
    else if (p.k === 'end') { disc(x, y + 6, 60, '#241e34', '#4a4060', 140); for (let a = 0; a < 6.28; a += .16) px(g, x + Math.cos(a) * 72, y + 6 + Math.sin(a) * 56, 2, 2, Math.floor(a * 6) % 3 ? '#b892f4' : '#ffd24a'); for (let a = 0; a < 6.28; a += .9) px(g, x + Math.cos(a) * 40, y + 6 + Math.sin(a) * 30, 3, 2, '#ffd24a'); }
  }
}
function lPaintDeco(rec, ty) {
  const d = rec.d, g = rec.g, N = LPD, R = mulberry(lH(rec.cx * LCT, rec.cy * LCT + ty, 9));
  for (let tx = 0; tx < LCT; tx++) {
    const i = (ty + 1) * N + tx + 1, r = R(), x = tx * LTS + Math.floor(R() * 12) + 2, y = ty * LTS + Math.floor(R() * 12) + 3; if (d.bar[i] || d.road[i] || d.lakeT[i]) continue;
    const B = LANDE_BIOMES[d.regs[d.rg[i]].biome];
    switch (B.deco) {
      case 'blume': if (r < .07) { const fc = ['#f786a0', '#ffd24a', '#ffffff', '#b892f4', '#e8402a'][Math.floor(R() * 5)]; px(g, x, y, 1, 2, '#2e5a22'); px(g, x - 1, y - 1, 3, 1, fc); px(g, x, y - 2, 1, 1, fc); px(g, x, y - 1, 1, 1, '#ffe08a'); } else if (r < .13) { px(g, x, y - 3, 1, 3, B.g[2]); px(g, x + 2, y - 2, 1, 2, B.g[2]); } break;
      case 'heide': if (r < .12) { px(g, x, y, 3, 1, '#8a4a8a'); px(g, x + 1, y - 1, 1, 1, '#b86ab8'); } break;
      case 'pilz': if (r < .02) { px(g, x, y - 1, 1, 2, '#e8e2cf'); px(g, x - 1, y - 2, 3, 1, R() < .5 ? '#c8342c' : '#b07a48'); } else if (r < .07) px(g, x, y, 2, 1, '#5a4224'); break;
      case 'kies': if (r < .08) { px(g, x, y, 2, 1, '#8a8274'); px(g, x, y + 1, 2, 1, '#4a4238'); } break;
      case 'knochen': if (r < .012) g.drawImage(SHEET, 288, 432, 16, 16, x - 6, y - 8, 16, 16); else if (r < .04) { px(g, x - 2, y, 5, 1, '#d8d0bc'); px(g, x, y - 1, 1, 3, '#c8c0aa'); } break;
      case 'schilf': if (r < .05) for (let k = -2; k <= 2; k += 2) px(g, x + k, y - 5 + Math.abs(k), 1, 6 - Math.abs(k), '#5a6a2a'); break;
      case 'eis': if (r < .04) { px(g, x, y - 4, 2, 4, '#bfefff'); px(g, x, y - 4, 1, 2, '#ffffff'); } break;
      case 'glut': if (r < .05) { let cx = x, cy = y; for (let k = 0; k < 6; k++) { px(g, cx, cy, 1, 1, k % 2 ? '#ff6a2a' : '#1a0e0c'); cx += Math.floor(R() * 3 - 1); cy += 1; } } break;
      case 'laub': if (r < .1) px(g, x, y, 2, 1, ['#c86a1e', '#e8a03a', '#a8401a'][Math.floor(R() * 3)]); break;
      case 'sand': if (r < .05) { px(g, x, y, 3, 1, B.g[3]); px(g, x + 1, y - 1, 1, 1, '#f0e0b0'); } break;
      case 'stern': if (r < .04) { const c = R() < .5 ? '#b0b8ff' : '#ffffff'; px(g, x, y, 1, 1, c); px(g, x - 1, y, 3, 1, 'rgba(176,184,255,.4)'); } break;
      case 'kristall': if (r < .04) { px(g, x, y - 3, 2, 3, '#8ab0ff'); px(g, x, y - 3, 1, 1, '#ffffff'); } break;
      case 'salz': if (r < .06) { px(g, x, y, 2, 2, '#ffffff'); px(g, x + 2, y + 1, 1, 1, '#c8c4bc'); } break;
      case 'blut': if (r < .05) { px(g, x, y, 3, 1, '#6a1a1a'); px(g, x + 1, y + 1, 2, 1, '#4a0e0e'); } break;
      // Kleinkram der Tiefe
      case 'scherbe': if (r < .05) { px(g, x, y - 3, 1, 3, '#e8f8ff'); px(g, x + 1, y - 2, 1, 2, B.g[3]); px(g, x - 1, y - 1, 1, 1, '#9ad8e8'); } break;
      case 'zahnrad': if (r < .025) { px(g, x - 1, y - 1, 3, 3, '#a8803a'); px(g, x, y, 1, 1, B.g[0]); px(g, x, y - 2, 1, 1, '#c8a060'); px(g, x, y + 2, 1, 1, '#c8a060'); px(g, x - 2, y, 1, 1, '#c8a060'); px(g, x + 2, y, 1, 1, '#c8a060'); } else if (r < .05) px(g, x, y, 2, 1, '#6a4a22'); break;
      case 'feder': if (r < .04) { px(g, x, y, 4, 1, '#ffffff'); px(g, x + 1, y - 1, 2, 1, '#e8f0f8'); px(g, x + 3, y + 1, 1, 1, '#c8d0e0'); } break;
      case 'seele': if (r < .03) { px(g, x, y, 2, 2, '#9af0e0'); px(g, x, y, 1, 1, '#ffffff'); } else if (r < .06) px(g, x, y, 1, 1, '#3a8a80'); break;
      case 'bernstein': if (r < .05) { px(g, x, y - 1, 2, 2, '#e89a2a'); px(g, x, y - 1, 1, 1, '#ffd070'); } else if (r < .09) px(g, x, y, 2, 1, '#8a5a1a'); break;
      case 'muschel': if (r < .04) { const c = R() < .5 ? '#c0c8ff' : '#ffe0f0'; px(g, x - 1, y, 3, 1, c); px(g, x, y - 1, 1, 3, c); px(g, x, y, 1, 1, '#ffffff'); } break;
      case 'riss': if (r < .03) { let cx = x, cy = y; for (let k = 0; k < 5; k++) { px(g, cx, cy, 1, 1, k % 2 ? '#ffe08a' : '#b892f4'); cx += Math.floor(R() * 3 - 1); cy += 1; } } break;
      case 'rost': if (r < .05) { px(g, x, y, 2, 2, '#8a3a14'); px(g, x, y, 1, 1, '#c8642a'); } else if (r < .08) px(g, x, y, 3, 1, '#5a2a10'); break;
      case 'krater': if (r < .015) { px(g, x - 2, y - 1, 5, 1, B.g[3]); px(g, x - 3, y, 1, 1, B.g[3]); px(g, x + 3, y, 1, 1, B.g[3]); px(g, x - 2, y + 1, 5, 1, B.g[2]); px(g, x, y, 1, 1, '#ffd24a'); } else if (r < .04) px(g, x, y, 1, 1, '#ffffff'); break;
      case 'traum': if (r < .06) { const fc = ['#ffc0e8', '#c0e0ff', '#fff0b0', '#e0c0ff'][Math.floor(R() * 4)]; px(g, x, y, 1, 2, '#5a6a8a'); px(g, x - 1, y - 1, 3, 1, fc); px(g, x, y - 2, 1, 1, fc); } break;
    }
  }
}

/* ---------- Pflanzen, Felsen, Zelte, Wahrzeichen ---------- */
// Kronenfarben: 0–2 Grün, 3 Traum, 4 Schatten, 5 Blüte, 6 Geist, 7 Blut, 8 Gold, 9 Uralt, 10 Nebel, 11 Dschungel, 12 Mond, 13 Bernstein, 14 Wachtraum, 15 Seele, 16 Dämmerung
const LTPAL = [['#1e4a1e', '#2e6a2a', '#4a9a3a', '#7ac25a'], ['#163a1a', '#24582a', '#3a7a34', '#62a64a'], ['#24481c', '#3a6a24', '#5a9a32', '#8ac84a'], ['#1a3a4a', '#2a6a7a', '#5ab0b0', '#a0f0e0'], ['#1a1028', '#2e1e48', '#4a3470', '#7a5aa8'], ['#5a1e3a', '#a03a6a', '#e070a0', '#ffc0d8'], ['#3a4250', '#6a7686', '#a8b4c4', '#e8f0ff'], ['#200808', '#4a1010', '#7a1a1a', '#c03030'], ['#5a3a10', '#9a6a1a', '#d8a83a', '#ffe08a'], ['#0e2a24', '#1a4a3e', '#2a6a5a', '#4a9a7a'], ['#2a3440', '#3e4a58', '#5a6878', '#8a98a8'], ['#0e3a14', '#1a5a1e', '#2a8a2a', '#5ac04a'],
  ['#2a3450', '#4a5a80', '#8aa0c8', '#e0ecff'], ['#6a3a0a', '#b06a14', '#e8a030', '#ffd88a'], ['#5a3a6a', '#a070b0', '#f0b0e0', '#fff0ff'], ['#0e3a3a', '#1e6a64', '#4ab0a0', '#a8fff0'], ['#3a1e4a', '#6a3a7a', '#c8783a', '#ffd070']];
const LSTONE = [['#4a4450', '#625c68', '#7e7884', '#a8a2ae'], ['#6a7888', '#8a98a8', '#aab8c6', '#ffffff'], ['#1e1618', '#34282a', '#4a3a3a', '#ff6a2a'], ['#8a6a3a', '#b08a50', '#d0aa70', '#f0d8a0'], ['#5a2418', '#8a3a24', '#b05a3a', '#d8885a'], ['#0e0a14', '#221a2e', '#3a2e4a', '#8a6ac0'], ['#8a8270', '#b0a890', '#d0c8b0', '#f0ead8'], ['#2a3a6a', '#4a6aa8', '#7aa0e0', '#d0e8ff'], ['#3a4a3a', '#4a5e46', '#62785a', '#8aa07a'],
  ['#8a8270', '#c8c0aa', '#e8e2cf', '#fffaf0'], ['#4a7a8a', '#8ac8d8', '#c8f0f8', '#ffffff'], ['#5a4418', '#8a6a2a', '#c8a050', '#ffe08a'], ['#4a5a7a', '#7a8aaa', '#aab8d8', '#ffffff'], ['#4a2410', '#7a3a18', '#a8582a', '#d88a4a'], ['#6a3a08', '#a8641a', '#e8a030', '#ffe0a0'], ['#08060e', '#1a1428', '#2e2444', '#ffffff']];   // 9 Gebein, 10 Glas, 11 Messing, 12 Mondstein, 13 Rost, 14 Bernstein, 15 Nichts
function lPropImg(t, v) {
  const key = t + ':' + v; if (LPROP[key]) return LPROP[key];
  const tree = !['stein', 'fels', 'zelt', 'wagen', 'schild', 'menhir', 'grab', 'salzk', 'knochen', 'fahne', 'zahnrad', 'scherbe', 'schaedel', 'sanduhr', 'ruest'].includes(t), sp = t === 'saeule' ? crop(80, 80, 16, 48) : lSpr(t, v), sw = t === 'wagen' ? 15 : t === 'zelt' ? 13 : t === 'tanne' || t === 'schnee' ? 7 : t === 'saeule' ? 9 : t === 'schilf' || t === 'fahne' ? 3 : Math.max(5, Math.round(sp.width * .36));
  const W = Math.max(sp.width, sw * 2 + 2), H = sp.height + 4, c = mk(W, H, g => { g.fillStyle = 'rgba(0,0,0,.3)'; g.beginPath(); g.ellipse(W / 2, sp.height - 2 + (t === 'saeule' ? 3 : 0), sw, sw * .38, 0, 0, 6.283); g.fill(); g.drawImage(sp, Math.floor((W - sp.width) / 2), 0); });
  return LPROP[key] = { c, ox: Math.floor(W / 2), oy: sp.height - (t === 'saeule' ? 4 : 2), h: sp.height, tree };
}
function lSpr(k, v) { const key = k + ':' + (v || 0); return LSPR[key] || (LSPR[key] = lPaint(k, v || 0)); }
function lPaint(k, v) {
  const R = mulberry(hashStr(k) + v * 977);
  let b;
  switch (k) {
    case 'eiche': case 'herbst': case 'riese': {
      const big = k === 'riese', w = big ? 48 : 26, h = big ? 62 : 32, cx = w / 2; b = PB(w, h);
      const C = k === 'herbst' ? ['#6a2a10', '#a84a1a', '#e07a2a', '#ffb84a'] : big ? ['#163e22', '#22603a', '#3a8a4a', '#7ad07a'] : LTPAL[v] || LTPAL[0];
      const tw = big ? 8 : 4, th = big ? 22 : 11, wood = v === 6 ? ['#8a8a8a', '#c8c8c8'] : v === 4 || v === 7 ? ['#1a1018', '#3a2a30'] : WOOD; b.rect(cx - tw / 2, h - th - 1, tw, th, wood[0]); b.rect(cx - tw / 2 + 1, h - th - 1, Math.max(1, tw / 2 - 1), th, wood[1]);
      b.set(cx - tw / 2 - 1, h - 2, wood[0]); b.set(cx + tw / 2, h - 2, wood[0]); if (big) { b.rect(cx - tw / 2 - 3, h - 3, 3, 2, wood[0]); b.rect(cx + tw / 2, h - 3, 3, 2, wood[0]); }
      const cr = big ? 21 : 11, cy = big ? 22 : 12;
      b.disc(cx, cy + 1, cr, C[0]); b.disc(cx - cr * .2, cy - cr * .1, cr * .85, C[1]); b.disc(cx + cr * .35, cy - cr * .3, cr * .5, C[1]);
      for (let i = 0; i < (big ? 12 : 5); i++) b.disc(cx - cr * .55 + R() * cr * .95, cy - cr * .65 + R() * cr * .75, 1.4 + R() * (big ? 3 : 1.6), C[2]);
      for (let i = 0; i < (big ? 22 : 7); i++) b.set(cx - cr * .6 + R() * cr * 1.1, cy - cr * .85 + R() * cr, C[3]);
      if (big) for (let i = 0; i < 8; i++) b.set(cx - cr + R() * cr * 2, cy - cr * .5 + R() * cr, '#ffd24a');
      if (v === 8) for (let i = 0; i < 4; i++) b.set(cx - cr * .5 + R() * cr, cy - cr * .5 + R() * cr, '#ffffff');
      break;
    }
    case 'birke': { const w = 18, h = 34; b = PB(w, h); b.rect(8, 12, 3, 21, '#e8e2d8'); for (let y = 14; y < 32; y += 3) b.set(8 + (y % 2), y, '#3a3434'); b.disc(9, 9, 8, '#3a7a2a'); b.disc(8, 8, 6.5, '#5aa83a'); for (let i = 0; i < 8; i++) b.set(3 + R() * 12, 2 + R() * 12, '#9ad86a'); break; }
    case 'tanne': case 'schnee': {
      const w = 20, h = 36; b = PB(w, h); b.rect(9, 30, 2, 5, WOOD[0]);
      const C = ['#143428', '#1e4e36', '#2e6a46', '#4a8a5a'];
      for (let l = 0; l < 5; l++) { const y0 = 2 + l * 5; for (let j = 0; j < 7; j++) { const hw = Math.max(1, Math.round((1 + l * 1.5) * (j + 1) / 7 + .5)); for (let x = 10 - hw; x < 10 + hw; x++) b.set(x, y0 + j, x < 10 - hw + 2 ? C[2] : x > 10 + hw - 3 ? C[0] : C[1]); if (k === 'schnee' && j < 2) for (let x = 10 - hw; x < 10 + hw; x++) if (R() < .7) b.set(x, y0 + j, j ? '#d8e8f4' : '#ffffff'); } }
      b.set(10, 1, k === 'schnee' ? '#ffffff' : C[3]);
      break;
    }
    case 'tot': case 'kohle': {
      const w = 22, h = 28, C = k === 'kohle' ? ['#141012', '#2a2224', '#3e3436'] : v ? ['#1a1418', '#2e262c', '#463a40'] : ['#3a2c22', '#5a4634', '#7a6650']; b = PB(w, h);
      b.rect(10, 9, 2, 18, C[0]); b.rect(10, 9, 1, 18, C[1]); b.set(9, 26, C[0]); b.set(12, 26, C[0]);
      for (const [x0, y0, x1, y1] of [[10, 14, 3, 7], [11, 11, 18, 4], [10, 19, 4, 15], [11, 17, 19, 12], [10, 10, 8, 2], [4, 7, 2, 5], [17, 5, 20, 3]]) b.line(x0, y0, x1, y1, C[1]);
      if (k === 'kohle') for (let i = 0; i < 4; i++) b.set(9 + Math.floor(R() * 4), 10 + Math.floor(R() * 16), '#ff6a2a');
      break;
    }
    case 'stein': case 'fels': {
      const big = k === 'fels', w = big ? 26 : 16, h = big ? 18 : 12; b = PB(w, h);
      const C = LSTONE[v] || LSTONE[0];
      b.disc(w / 2, h - h / 2.2, w / 2.3, C[0]); b.disc(w / 2 - 1, h - h / 2 - 1, w / 2.6, C[1]); b.disc(w / 2 - 2, h - h / 2 - 2, w / 4.5, C[2]);
      for (let i = 0; i < (big ? 6 : 3); i++) b.set(w / 2 - w / 4 + R() * w / 2, h / 3 + R() * h / 3, C[3]);
      if (v === 1) for (let x = 2; x < w - 2; x++) if (b.get(x, Math.round(h / 3))) b.set(x, Math.round(h / 3) - 1, '#ffffff');
      if (v === 2) b.line(w / 2 - 3, h - 3, w / 2 + 2, h / 2, '#ff6a2a');
      if (big) b.line(w / 2, h / 3, w / 2 + 3, h - 4, C[0]);
      break;
    }
    case 'busch': { const C = [['#1e4a1e', '#2e6a2a', '#5a9a3a'], ['#6a2a10', '#a8501a', '#e8903a'], ['#3a2a3a', '#6a3a6a', '#a860a8'], ['#4a5a4a', '#6a7a68', '#8a9a88'], ['#6a3a5a', '#b06a9a', '#f0a8d0']][v] || ['#1e4a1e', '#2e6a2a', '#5a9a3a']; b = PB(16, 12); b.disc(8, 8, 6, C[0]); b.disc(6, 7, 4, C[1]); b.disc(10, 6, 3.5, C[1]); for (let i = 0; i < 5; i++) b.set(3 + R() * 10, 3 + R() * 6, C[2]); break; }
    case 'pilz': { const C = [['#8a1e1a', '#c8342c', '#ffffff'], ['#1e3a7a', '#3a6ad8', '#9ae8ff'], ['#4a1e6a', '#8a3ac8', '#e0a8ff']][v % 3]; b = PB(20, 26); b.rect(8, 12, 4, 13, '#e8e2cf'); b.rect(8, 12, 1, 13, '#c8c0aa'); for (let y = 0; y < 9; y++) { const hw = Math.round(Math.sqrt(Math.max(0, 81 - (9 - y) * (9 - y))) * 1.05); for (let x = 10 - hw; x < 10 + hw; x++) b.set(x, y + 4, y < 2 ? C[1] : x < 10 ? C[1] : C[0]); } for (let i = 0; i < 5; i++) b.disc(4 + R() * 12, 6 + R() * 5, .8, C[2]); break; }
    case 'kaktus': { b = PB(16, 26); const C = ['#1e5a2a', '#2e8a3a', '#5ac05a']; b.rect(6, 4, 4, 21, C[1]); b.rect(6, 4, 1, 21, C[2]); b.rect(9, 4, 1, 21, C[0]); b.rect(2, 10, 3, 2, C[1]); b.rect(2, 6, 2, 5, C[1]); b.rect(11, 13, 3, 2, C[1]); b.rect(12, 8, 2, 6, C[1]); for (let i = 0; i < 6; i++) b.set(6 + Math.floor(R() * 4), 6 + Math.floor(R() * 18), '#e8e2cf'); if (R() < .5) b.set(8, 3, '#f786a0'); break; }
    case 'palme': { b = PB(26, 34); for (let y = 12; y < 33; y++) { const x = 12 + Math.round(Math.sin(y / 7) * 2); b.rect(x, y, 3, 1, y % 3 ? '#8a6a3a' : '#6a4a22'); } const C = ['#1e5a1e', '#2e8a2a', '#5ac04a']; for (const [dx, dy] of [[-11, 4], [11, 4], [-8, -2], [8, -2], [0, -5], [-12, 9], [12, 9]]) b.line(13, 11, 13 + dx, 11 + dy, C[1]); b.disc(13, 11, 2.5, '#6a4a22'); for (let i = 0; i < 6; i++) b.set(3 + R() * 20, 4 + R() * 10, C[2]); break; }
    case 'dorn': { b = PB(22, 18); const C = ['#0e1e0a', '#1e3a14', '#2e5a1e']; b.disc(11, 11, 8, C[1]); b.disc(8, 9, 5, C[2]); b.disc(15, 10, 4.5, C[2]); for (let i = 0; i < 14; i++) { const a = R() * 6.283, r = 6 + R() * 4; b.set(11 + Math.cos(a) * r, 10 + Math.sin(a) * r * .7, '#c8b070'); } for (let i = 0; i < 3; i++) b.set(5 + R() * 12, 6 + R() * 8, '#c8342c'); break; }
    case 'kristall': { const C = [['#1e3a8a', '#4a7ae8', '#b0d0ff'], ['#7a1e5a', '#d84aa0', '#ffc0e8'], ['#2a1048', '#6a3ac0', '#c8a0ff'], ['#6a7a8a', '#b8c8d8', '#ffffff'], ['#7a5a10', '#e8b04a', '#fff3c0'], ['#14081e', '#4a2a7a', '#e0c8ff'], ['#5a0a14', '#c8283a', '#ffb0b8'], ['#6a3a08', '#e8962a', '#ffe0a0']][v] || ['#1e3a8a', '#4a7ae8', '#b0d0ff']; b = PB(18, 26); for (const [x, h, w] of [[8, 22, 3], [4, 13, 2], [12, 16, 2], [14, 9, 2]]) { for (let y = 0; y < h; y++) { const ww = Math.max(1, Math.round(w * Math.min(1, (y + 1) / 4))); b.rect(x - ww + 1, 25 - h + y, ww * 2 - 1, 1, y < 2 ? C[2] : C[1]); } b.line(x, 25 - h + 2, x, 24, C[2]); b.line(x + 1, 25 - h + 3, x + 1, 24, C[0]); } break; }
    case 'knochen': { b = PB(26, 18); if (v === 2) { b = PB(36, 34); for (let i = 0; i < 4; i++) { const x = 6 + i * 8; for (let y = 4; y < 32; y++) b.set(x + Math.round(Math.sin(y / 9) * 3), y, y < 6 ? '#fffaf0' : '#d8d0bc'); } b.rect(2, 31, 32, 2, '#a8a08a'); break; } if (v === 0) { b.rect(3, 14, 20, 2, '#d8d0bc'); for (let i = 0; i < 5; i++) { const x = 5 + i * 4; b.line(x, 14, x - 2, 5 + i % 2, '#e8e2cf'); b.set(x - 2, 5 + i % 2, '#fffaf0'); } } else { b.disc(8, 10, 4.5, '#e8e2cf'); b.set(6, 10, '#1a1420'); b.set(9, 10, '#1a1420'); b.rect(6, 13, 5, 2, '#d8d0bc'); b.line(13, 15, 23, 11, '#d8d0bc'); b.line(14, 11, 22, 16, '#c8c0aa'); } break; }
    case 'grab': { b = PB(12, 18); const C = ['#5a5868', '#7a7888', '#9a98a8']; if (v === 0) { b.rect(5, 2, 2, 14, C[1]); b.rect(2, 5, 8, 2, C[1]); b.rect(5, 2, 1, 14, C[2]); } else { b.rect(2, 5, 8, 11, C[1]); b.disc(6, 5, 4, C[1]); b.rect(2, 5, 2, 11, C[2]); b.rect(4, 8, 4, 1, C[0]); b.rect(5, 6, 2, 5, C[0]); } b.rect(1, 16, 10, 2, '#3a3440'); break; }
    case 'eisz': { b = PB(18, 30); const C = ['#5a7898', '#a8d0e8', '#e8f8ff']; if (v === 0) { for (let y = 0; y < 28; y++) { const hw = Math.max(1, Math.round(y / 4)); b.rect(9 - hw, y + 1, hw * 2, 1, y % 5 ? C[1] : C[2]); } b.line(9, 4, 9, 28, C[2]); } else { b.rect(2, 12, 14, 16, C[1]); b.rect(2, 12, 14, 2, C[2]); b.rect(2, 12, 2, 16, C[2]); b.rect(14, 14, 2, 14, C[0]); b.line(6, 16, 11, 24, C[0]); } break; }
    case 'obs': { const C = v ? ['#1a0a2a', '#3a1a5a', '#c060ff'] : ['#0e0a14', '#2a2238', '#ff8a3a']; b = PB(14, 26); for (let y = 0; y < 24; y++) { const hw = Math.max(1, Math.round(y / 5)); b.rect(7 - hw, y + 1, hw * 2, 1, C[1]); } b.line(7, 3, 6, 24, C[0]); b.line(8, 6, 9, 22, C[2]); break; }
    case 'weide': { const C = [['#1e4a1e', '#3a7a2a', '#6aa84a'], ['#4a5a6a', '#8a9aaa', '#d0e0f0'], ['#0e3a3a', '#2a8a80', '#9af0e0'], ['#3a4a6a', '#8aa0c8', '#ffffff']][v] || ['#4a5a6a', '#8a9aaa', '#d0e0f0']; b = PB(26, 32); b.rect(12, 14, 3, 17, WOOD[0]); b.disc(13, 11, 10, C[0]); b.disc(12, 9, 8, C[1]); for (let i = 0; i < 9; i++) { const x = 4 + i * 2.2; b.line(x, 10, x + (R() - .5) * 2, 22 + R() * 6, C[i % 2 ? 1 : 2]); } break; }
    case 'sternbaum': { const C = v ? ['#0a0612', '#1a0e2a', '#c060ff'] : ['#1a2a5a', '#2a4aa8', '#ffe08a']; b = PB(24, 32); b.rect(11, 14, 3, 17, v ? '#1a1018' : '#3a2a4a'); b.disc(12, 11, 10, C[0]); b.disc(11, 10, 8, C[1]); for (let i = 0; i < 7; i++) { const x = 4 + R() * 16, y = 3 + R() * 14; b.set(x, y, C[2]); b.set(x + 1, y, '#ffffff'); } break; }
    case 'koralle': { const C = [['#8a3a1e', '#e8703a', '#ffb070'], ['#7a1e4a', '#e05a9a', '#ffb0d8'], ['#8a8a8a', '#d8d8d0', '#ffffff'], ['#1a2a6a', '#6a8aff', '#e0e8ff']][v % 4]; b = PB(20, 22); for (const [x0, y0, x1, y1] of [[10, 21, 10, 6], [10, 14, 4, 6], [10, 12, 16, 4], [5, 9, 3, 3], [15, 7, 18, 2]]) { b.line(x0, y0, x1, y1, C[1]); b.line(x0 + 1, y0, x1 + 1, y1, C[0]); b.set(x1, y1, C[2]); } break; }
    case 'salzk': { b = PB(16, 16); for (const [x, h] of [[4, 8], [8, 12], [12, 7]]) { b.rect(x - 1, 15 - h, 3, h, '#e8e4dc'); b.rect(x - 1, 15 - h, 1, h, '#ffffff'); b.set(x, 14 - h, '#ffffff'); b.rect(x + 1, 16 - h, 1, h - 1, '#b8b4ac'); } break; }
    case 'schilf': { b = PB(12, 16); const C = v ? ['#6a5a2a', '#8a7a4a'] : ['#3a5a1a', '#5a7a2a']; for (let i = 0; i < 4; i++) { const x = 2 + i * 2.5; b.line(x, 15, x + (i - 1.5), 3 + i % 2 * 2, C[i % 2]); } b.rect(4, 2, 1, 3, '#6a4a22'); b.rect(8, 4, 1, 3, '#6a4a22'); break; }
    case 'fahne': { b = PB(16, 34); b.rect(2, 2, 2, 31, WOOD[0]); b.rect(4, 3, 11, 9, '#2a5a9a'); b.rect(4, 3, 11, 1, '#57c7e6'); b.rect(8, 6, 3, 3, '#e8b04a'); b.set(14, 12, '#2a5a9a'); b.set(12, 12, '#2a5a9a'); break; }
    case 'obelisk': { b = PB(16, 50); const C = ['#3a3644', '#5a5664', '#7a7684']; for (let y = 4; y < 46; y++) { const hw = 3 + Math.round((y - 4) / 14); b.rect(8 - hw, y, hw * 2, 1, C[1]); b.rect(8 - hw, y, 2, 1, C[2]); } b.rect(6, 1, 4, 4, C[2]); b.rect(3, 45, 10, 4, C[0]); for (let y = 10; y < 40; y += 6) b.rect(7, y, 2, 3, '#57c7e6'); break; }
    case 'schrein': { b = PB(30, 34); const C = ['#4a4652', '#6a6672', '#8a8692']; b.rect(3, 26, 24, 7, C[0]); b.rect(5, 24, 20, 3, C[1]); b.rect(6, 8, 3, 16, C[1]); b.rect(21, 8, 3, 16, C[1]); b.rect(3, 4, 24, 5, C[2]); b.rect(1, 3, 28, 2, C[1]); b.disc(15, 16, 4, '#b892f4'); b.disc(15, 16, 2, '#ffffff'); break; }
    case 'turm': {
      const w = 34, h = 58; b = PB(w, h); const C = ['#4a4652', '#625e6a', '#7a7682', '#9a96a2'];
      for (let y = 8; y < h - 1; y++) for (let x = 3; x < w - 3; x++) { const row = Math.floor(y / 4), brick = ((x + (row % 2) * 3) % 6 === 0) || y % 4 === 0; b.set(x, y, brick ? C[0] : x < 8 ? C[2] : x > w - 8 ? C[0] : C[1]); }
      for (let x = 3; x < w - 3; x++) { const top = 4 + Math.round(Math.abs(Math.sin(x * 1.7)) * 6) + (x > w / 2 ? 3 : 0); for (let y = top; y < 8; y++) b.set(x, y, C[1]); }
      b.rect(14, 18, 5, 8, '#16121e'); b.rect(15, 17, 3, 1, '#16121e'); b.rect(13, h - 13, 8, 12, '#16121e'); b.rect(14, h - 14, 6, 1, '#16121e');
      for (let i = 0; i < 14; i++) b.set(3 + R() * (w - 6), 10 + R() * (h - 14), '#4a7a32');
      break;
    }
    case 'statue': {
      b = PB(18, 38); const C = ['#5a5868', '#7a7888', '#9a98a8', '#c8c6d4'];
      b.rect(2, 30, 14, 7, C[0]); b.rect(3, 29, 12, 2, C[2]); b.rect(6, 12, 6, 17, C[1]); b.rect(6, 12, 2, 17, C[2]); b.disc(9, 9, 3, C[2]); b.rect(4, 14, 2, 9, C[1]); b.rect(12, 14, 2, 8, C[1]);
      b.rect(14, 2, 1, 22, C[3]); b.rect(12, 20, 5, 1, C[2]); b.set(9, 9, C[3]);
      break;
    }
    case 'zelt': {
      const w = 28, h = 22, C = [['#7a1e18', '#c8342c', '#e8604a'], ['#4e3018', '#8a5a32', '#b07a48'], ['#2e5a3a', '#4a8a5a', '#7ac08a']][v % 3]; b = PB(w, h);
      for (let y = 0; y < 18; y++) { const hw = Math.round(y * .72) + 1; for (let x = 14 - hw; x < 14 + hw; x++) b.set(x, y + 2, x < 14 ? C[1] : C[0]); b.set(14 - hw, y + 2, C[2]); }
      for (let y = 9; y < 20; y++) { const hw = Math.round((y - 9) * .45); for (let x = 14 - hw; x <= 14 + hw; x++) b.set(x, y, '#1a1420'); }
      b.rect(13, 0, 2, 3, WOOD[1]); b.rect(1, 19, 26, 1, C[0]);
      break;
    }
    case 'wagen': {
      b = PB(34, 26); b.rect(3, 12, 28, 8, WOOD[1]); b.rect(3, 12, 28, 1, WOOD[2]); b.rect(3, 19, 28, 1, WOOD[0]);
      for (let x = 4; x < 30; x++) { const y = 12 - Math.round(Math.sin((x - 4) / 26 * Math.PI) * 9); for (let yy = y; yy < 12; yy++) b.set(x, yy, yy < y + 2 ? '#fff3dc' : '#e8dcc0'); }
      b.disc(8, 21, 4, WOOD[0]); b.disc(8, 21, 2, WOOD[2]); b.disc(26, 21, 4, WOOD[0]); b.disc(26, 21, 2, WOOD[2]); b.rect(30, 16, 4, 1, WOOD[0]);
      b.rect(11, 9, 5, 3, '#e8b04a'); b.rect(18, 8, 4, 4, '#9aa2ae');
      break;
    }
    case 'schild': { b = PB(14, 22); b.rect(6, 6, 2, 16, WOOD[0]); b.rect(1, 3, 12, 6, WOOD[1]); b.rect(1, 3, 12, 1, WOOD[2]); b.rect(3, 5, 8, 1, '#5e3a1e'); b.rect(3, 7, 6, 1, '#5e3a1e'); break; }
    case 'menhir': { b = PB(10, 22); const C = v ? ['#4a4a5a', '#6a6a7a', '#8a8a9a'] : ['#4e4a44', '#6e6a62', '#8e8a80']; b.rect(2, 3, 6, 19, C[1]); b.rect(3, 1, 4, 2, C[1]); b.rect(2, 3, 2, 19, C[2]); b.rect(7, 4, 1, 18, C[0]); b.set(4, 9, '#57c7e6'); b.set(5, 13, '#57c7e6'); break; }
    case 'meile': { b = PB(12, 16); b.rect(2, 3, 8, 12, '#6e6a62'); b.disc(6, 4, 4, '#6e6a62'); b.rect(2, 3, 2, 12, '#8e8a80'); b.rect(4, 6, 4, 1, '#3a3640'); b.rect(4, 9, 4, 1, '#3a3640'); b.rect(1, 14, 10, 2, '#4e4a44'); break; }
    case 'feuer': { b = PB(16, 30); b.rect(4, 22, 8, 7, '#4a4652'); b.rect(3, 20, 10, 3, '#6a6672'); b.rect(6, 6, 4, 15, '#5a5662'); b.rect(6, 6, 1, 15, '#7a7682'); b.rect(3, 3, 10, 4, '#6a6672'); b.rect(3, 3, 10, 1, '#8a8692'); break; }
    case 'sockel': { b = PB(20, 16); b.rect(3, 6, 14, 9, '#5a5662'); b.rect(2, 4, 16, 3, '#7a7682'); b.rect(2, 4, 16, 1, '#9a96a2'); b.rect(5, 9, 10, 1, '#3a3640'); break; }
    case 'rune': { b = PB(12, 14); b.rect(2, 3, 8, 10, '#4e4a54'); b.disc(6, 4, 4, '#4e4a54'); b.rect(2, 3, 2, 10, '#6e6a74'); b.rect(1, 12, 10, 2, '#2e2a34'); break; }
    case 'hort': { b = PB(44, 30); const C = ['#2a2430', '#4a4452', '#6a6472']; b.disc(22, 22, 20, C[1]); b.disc(22, 22, 17, C[2]); b.disc(22, 22, 14, C[1]); for (let y = 12; y < 30; y++) { const hw = Math.round(Math.sqrt(Math.max(0, 100 - (y - 22) * (y - 22) * 1.3))); b.rect(22 - hw, y, hw * 2, 1, '#0a0810'); } b.rect(0, 28, 44, 2, C[0]); for (const [x, y] of [[8, 26], [36, 25], [14, 9], [30, 8]]) { b.disc(x, y, 2.4, '#e8e2cf'); b.set(x - 1, y, '#1a1420'); b.set(x + 1, y, '#1a1420'); } break; }
    case 'kraut': { b = PB(14, 11); const fc = ['#f786a0', '#ffd24a', '#b892f4'][v % 3]; for (const [x, y] of [[3, 6], [6, 4], [9, 5], [11, 7], [5, 8]]) { b.line(x, 10, x, y, '#3a7a2a'); b.set(x - 1, y + 1, '#5aaa42'); b.set(x + 1, y + 2, '#5aaa42'); b.set(x, y - 1, fc); } b.set(6, 3, '#ffffff'); break; }
    case 'rest': { b = PB(22, 12); b.rect(2, 6, 8, 5, '#6a4224'); b.rect(3, 5, 6, 2, '#8a5a32'); b.rect(5, 7, 2, 2, '#e8b04a'); b.rect(12, 9, 9, 2, '#d8d0bc'); for (let i = 0; i < 4; i++) b.rect(13 + i * 2, 6, 1, 3, '#c8c0aa'); b.disc(19, 5, 2.5, '#e8e2cf'); b.set(18, 5, '#1a1420'); b.set(20, 5, '#1a1420'); b.rect(11, 3, 1, 5, '#9aa2ae'); break; }
    case 'ei': { b = PB(11, 14); b.disc(5, 8, 4.5, '#efe2bf'); b.disc(5, 6, 3.5, '#efe2bf'); b.disc(4, 6, 2, '#fff8e8'); b.set(7, 9, '#c8a87a'); b.set(3, 10, '#c8a87a'); b.set(6, 4, '#c8a87a'); b.set(3, 4, '#ffffff'); break; }
    case 'schl': { b = PB(14, 8); b.disc(3, 4, 2.6, '#e8b04a'); b.set(3, 4, null); b.rect(5, 3, 8, 2, '#e8b04a'); b.rect(10, 5, 1, 2, '#e8b04a'); b.rect(12, 5, 1, 2, '#e8b04a'); b.set(6, 3, '#ffe08a'); break; }
    case 'karte': { b = PB(14, 12); b.rect(2, 2, 10, 8, '#e8dcc0'); b.rect(1, 1, 2, 10, '#c8a87a'); b.rect(11, 1, 2, 10, '#c8a87a'); b.line(4, 7, 7, 4, '#c8463c'); b.line(7, 4, 10, 6, '#c8463c'); b.set(9, 6, '#1a1420'); break; }
    case 'relikt': { b = PB(12, 14); b.line(2, 1, 6, 5, '#e8b04a'); b.line(10, 1, 6, 5, '#e8b04a'); b.disc(6, 9, 3.5, '#e8b04a'); b.disc(6, 9, 2, '#57c7e6'); b.set(5, 8, '#ffffff'); break; }
    case 'lstein': { b = PB(12, 14); b.disc(6, 8, 4.5, '#7a3a1e'); b.disc(6, 7, 3.5, '#ff8a3a'); b.disc(5, 6, 1.8, '#ffe08a'); b.set(4, 5, '#ffffff'); break; }
    // Pflanzen und Dinge der Tiefe
    case 'riesenpilz': {
      const C = [['#4a1e6a', '#8a3ac8', '#e0a8ff', '#ffffff'], ['#1e3a7a', '#3a7ad8', '#9ae8ff', '#e8ffff'], ['#7a1414', '#c8342c', '#ffd0c8', '#ffffff']][v % 3];
      b = PB(40, 54); b.rect(16, 24, 8, 29, '#d8d2bf'); b.rect(16, 24, 2, 29, '#efe8d4'); b.rect(22, 24, 2, 29, '#a8a08a'); b.rect(13, 50, 14, 3, '#a8a08a');
      for (let y = 0; y < 20; y++) { const hw = Math.round(Math.sqrt(Math.max(0, 1 - Math.pow((19 - y) / 20, 2))) * 19); for (let x = 20 - hw; x < 20 + hw; x++) b.set(x, y + 5, y < 3 ? C[2] : x > 20 + hw * .5 ? C[0] : C[1]); }
      b.rect(2, 24, 36, 2, C[0]); for (let i = 0; i < 7; i++) b.disc(6 + R() * 28, 10 + R() * 11, 1.2 + R() * 1.4, C[2]); for (let i = 0; i < 4; i++) b.set(8 + R() * 24, 9 + R() * 12, C[3]);
      break;
    }
    case 'knochenbaum': {
      const C = v ? ['#a89a80', '#d8ccb0', '#7a1e1e'] : ['#c8c0aa', '#efe8d4', '#3a3440']; b = PB(28, 40);
      b.rect(12, 14, 4, 25, C[0]); b.rect(12, 14, 2, 25, C[1]); b.disc(11, 38, 2, C[0]); b.disc(17, 38, 2, C[0]);
      for (let i = 0; i < 4; i++) { const y = 18 + i * 5; for (let k = 0; k < 10 - i * 2; k++) { b.set(11 - k, y - Math.round(Math.sqrt(k) * 2.2), C[1]); b.set(16 + k, y - Math.round(Math.sqrt(k) * 2.2), C[1]); } }
      b.disc(14, 8, 6, C[1]); b.disc(14, 10, 5, C[0]); b.rect(11, 8, 2, 2, C[2]); b.rect(15, 8, 2, 2, C[2]); b.rect(12, 12, 4, 1, C[2]);
      break;
    }
    case 'glasbaum': {
      const C = v ? ['#8a3a6a', '#e080c0', '#ffd0f0'] : ['#2a6a8a', '#7ad0e8', '#e0ffff']; b = PB(24, 36);
      b.rect(11, 18, 2, 17, C[0]); b.line(12, 24, 6, 18, C[0]); b.line(12, 22, 18, 16, C[0]);
      for (const [cx, cy, r] of [[12, 10, 8], [6, 15, 5], [18, 14, 5]]) { b.disc(cx, cy, r, C[1]); b.disc(cx - r * .3, cy - r * .3, r * .45, C[2]); }
      for (let i = 0; i < 6; i++) b.set(4 + R() * 16, 4 + R() * 14, '#ffffff'); for (let y = 4; y < 20; y += 3) b.set(12, y, C[0]);
      break;
    }
    case 'zahnrad': {
      const C = v ? ['#5a2a10', '#8a4a1e', '#c8743a'] : ['#6a4a1a', '#a8803a', '#e8c070']; b = PB(30, 32);
      b.rect(13, 26, 4, 5, '#3a3440'); b.rect(8, 30, 14, 2, '#3a3440');
      for (let k = 0; k < 10; k++) { const a = k / 10 * 6.283; b.rect(Math.round(15 + Math.cos(a) * 12) - 1, Math.round(14 + Math.sin(a) * 12) - 1, 3, 3, C[0]); }
      b.disc(15, 14, 11, C[0]); b.disc(15, 14, 10, C[1]); b.disc(15, 14, 6, C[0]); b.disc(15, 14, 3.5, C[1]); b.disc(15, 14, 1.5, '#1a1420');
      for (let k = 0; k < 4; k++) { const a = k / 4 * 6.283 + .4; b.line(15 + Math.cos(a) * 4, 14 + Math.sin(a) * 4, 15 + Math.cos(a) * 9, 14 + Math.sin(a) * 9, C[0]); }
      b.line(9, 7, 13, 5, C[2]); b.set(8, 10, C[2]);
      break;
    }
    case 'scherbe': {
      const C = [['#3a6a8a', '#9ad8e8', '#ffffff'], ['#8a6a1a', '#ffd24a', '#fff8d0'], ['#2a0e4a', '#8a4ad8', '#e0c8ff']][v % 3]; b = PB(18, 28);
      for (const [x, h, w, lean] of [[8, 26, 3, 1], [4, 15, 2, -1], [13, 18, 2, 1]]) for (let y = 0; y < h; y++) { const ww = Math.max(1, Math.round(w * (y + 1) / h + .3)), xo = Math.round(lean * (h - y) / 6); b.rect(x - ww + 1 + xo, 27 - h + y, ww * 2 - 1, 1, y < 3 ? C[2] : C[1]); b.set(x + xo + ww - 1, 27 - h + y, C[0]); }
      break;
    }
    case 'schaedel': {
      const C = ['#a89a80', '#d8ccb0', '#efe8d4', '#2a2228']; b = PB(40, 30);
      b.disc(20, 13, 12, C[1]); b.rect(10, 13, 20, 10, C[1]); b.disc(16, 9, 6, C[2]); b.disc(14, 14, 3.5, C[3]); b.disc(26, 14, 3.5, C[3]); b.rect(19, 18, 2, 3, C[3]);
      for (let x = 12; x < 29; x += 3) b.rect(x, 23, 2, 4, C[2]); b.rect(10, 27, 20, 2, C[0]); b.line(28, 4, 31, 10, C[0]); b.line(30, 8, 33, 7, C[0]); b.rect(2, 26, 7, 3, C[0]); b.rect(32, 25, 6, 4, C[0]);
      break;
    }
    case 'sanduhr': {
      const C = ['#4a4460', '#6a6488', '#e8c860', '#ffe08a']; b = PB(16, 30);
      b.rect(2, 0, 12, 3, C[1]); b.rect(2, 27, 12, 3, C[1]); b.rect(2, 3, 1, 24, C[0]); b.rect(13, 3, 1, 24, C[0]);
      for (let y = 0; y < 12; y++) { const hw = Math.max(1, 5 - Math.round(y * 5 / 12)); b.rect(8 - hw, 3 + y, hw * 2, 1, '#a8b4d0'); b.rect(8 - hw, 26 - y, hw * 2, 1, '#a8b4d0'); }
      b.rect(5, 4, 6, 3, C[2]); b.rect(7, 7, 2, 13, C[3]); b.rect(4, 22, 8, 4, C[2]); b.rect(5, 21, 6, 1, C[3]);
      break;
    }
    case 'ruest': {
      const C = ['#4a2410', '#7a3a18', '#a8582a', '#d88a4a']; b = PB(32, 26);
      b.disc(16, 14, 12, C[1]); b.rect(4, 14, 24, 10, C[1]); b.disc(13, 10, 6, C[2]); b.rect(6, 14, 20, 3, C[0]); b.rect(15, 17, 2, 7, C[0]); b.rect(9, 18, 4, 1, '#1a1014'); b.rect(19, 18, 4, 1, '#1a1014');
      b.rect(15, 1, 2, 4, C[2]); b.rect(2, 23, 28, 3, C[0]); for (let i = 0; i < 8; i++) b.set(6 + R() * 20, 6 + R() * 16, R() < .5 ? C[3] : '#3a1a0a');
      break;
    }
    case 'weltende': {
      const C = ['#2a2440', '#4a4060', '#6a608a', '#9a90b8']; b = PB(46, 76);
      b.rect(4, 64, 38, 10, C[0]); b.rect(6, 62, 34, 3, C[2]); b.rect(6, 62, 34, 1, C[3]);
      b.rect(8, 20, 7, 42, C[1]); b.rect(8, 20, 2, 42, C[2]); b.rect(31, 28, 7, 34, C[1]); b.rect(31, 28, 2, 34, C[2]);
      for (let x = 8; x < 28; x++) b.rect(x, 14 + Math.round(Math.abs(x - 22) * .35), 1, 6, C[1]);
      b.rect(8, 14, 18, 1, C[3]); b.line(28, 18, 31, 26, C[0]);
      for (let y = 24; y < 60; y += 7) { b.rect(10, y, 3, 2, '#ffd24a'); b.rect(33, y + 3, 3, 2, '#b892f4'); }
      b.disc(23, 40, 5, '#ffd24a'); b.disc(23, 40, 3, '#fff8d0'); b.set(23, 33, '#ffffff'); b.set(23, 47, '#ffffff'); b.set(16, 40, '#ffffff'); b.set(30, 40, '#ffffff');
      break;
    }
    case 'mod': { b = PB(12, 12); b.disc(6, 6, 4.5, '#3a2a5a'); b.disc(6, 6, 3, '#b892f4'); b.rect(5, 3, 2, 6, '#ffffff'); b.rect(3, 5, 6, 2, '#e8d8ff'); break; }
    default: b = PB(4, 4); b.rect(0, 0, 4, 4, '#ff00ff');
  }
  return pbCanvas(pbOutline(b));
}
// Truhenbild aus dem Atlas, je Art eingefärbt
function lChestImg(t, f) {
  const key = t + f; if (LCHI[key]) return LCHI[key]; const C = LCH[t];
  return LCHI[key] = mk(16, 16, g => {
    g.drawImage(SHEET, 304 + f * 16, 416, 16, 16, 0, 0, 16, 16);
    if (C && C.tint) { g.globalCompositeOperation = 'source-atop'; g.fillStyle = C.tint; g.fillRect(0, 0, 16, 16); g.globalCompositeOperation = 'source-over'; }
    if (t === 'schloss' && !f) { px(g, 7, 7, 3, 3, '#e8b04a'); px(g, 8, 8, 1, 1, '#1a1420'); }
    if (t === 'gold' && !f) { px(g, 3, 6, 1, 1, '#ffffff'); px(g, 12, 9, 1, 1, '#fff3c0'); }
  });
}

/* ---------- Truhen, Gefahr (Tag und Nacht), Ruf, NPCs ---------- */
// Fundstellen: it = Gegenstände [min, max], min = Mindest-Seltenheit, luck = Glück, egg/key/map/stone/mod = Chancen
const LCH = {
  holz: { n: _t('Holztruhe'), it: [1, 1], min: 0, luck: 1, gold: [6, 14], mats: .5, gem: .1, part: .1, egg: 0, mod: .03 },
  eisen: { n: _t('Eisentruhe'), it: [1, 2], min: 1, luck: 1.4, gold: [10, 22], mats: .6, gem: .25, part: .25, egg: .01, mod: .06, tint: 'rgba(160,180,215,.6)' },
  gold: { n: _t('Goldtruhe'), it: [2, 2], min: 2, luck: 2.2, gold: [24, 50], mats: .8, gem: .45, part: .4, egg: .04, mod: .14, stone: .03, tint: 'rgba(255,205,60,.62)' },
  fluch: { n: _t('Verfluchte Truhe'), it: [2, 3], min: 2, luck: 3, gold: [20, 40], mats: .6, gem: .4, part: .4, egg: .05, mod: .16, stone: .02, tint: 'rgba(150,60,220,.6)', trap: 1 },
  schloss: { n: _t('Verschlossene Truhe'), it: [2, 3], min: 3, luck: 3.6, gold: [30, 60], mats: 1, gem: .6, part: .6, egg: .12, mod: .25, stone: .06, tint: 'rgba(40,50,70,.65)', lock: 1 },
  rest: { n: _t('Gefallener Abenteurer'), it: [1, 1], min: 1, luck: 1.6, gold: [8, 20], mats: .3, gem: .15, part: .2, egg: .02, mod: .05, key: .25, map: .35, stone: .03 },
  versteck: { n: _t('Vergrabener Schatz'), it: [0, 1], min: 2, luck: 2.4, gold: [20, 45], mats: .7, gem: .9, part: .7, egg: .08, mod: .2, key: .1, stone: .08 },
  kraut: { n: _t('Kräuterbeet') }
};
// Tageszeiten: ein Tag dauert 15 Minuten, jeder Ausflug beginnt am Morgen – nachts mehr und stärkere Gegner, Jäger der Nacht
const LDAY = 900;
const LDNG = [
  { n: _t('TAG'), c: '#ffd24a', t: 0 },
  { n: _t('ABEND'), c: '#ff8a3a', t: .6, b: _t('DIE SONNE SINKT'), s: _t('Bald bricht die Nacht herein – dann streifen mehr und stärkere Gegner umher.') },
  { n: _t('NACHT'), c: '#b892f4', t: .67, b: _t('DIE NACHT BRICHT AN'), s: _t('Jäger der Nacht sind unterwegs. Halte ein Tor oder Leuchtfeuer im Blick!') },
  { n: _t('MORGEN'), c: '#9ad8ee', t: .95, b: _t('DER MORGEN GRAUT'), s: _t('Die Jäger der Nacht ziehen sich zurück.') }
];
function lPhase(t) { const p = (t / LDAY) % 1; let i = 0; for (let k = 0; k < LDNG.length; k++) if (p >= LDNG[k].t) i = k; return i; }
function lNight(t) { const p = (t / LDAY) % 1; return p < .6 ? 0 : p < .67 ? (p - .6) / .07 : p < .93 ? 1 : p < 1 ? 1 - (p - .93) / .07 : 0; }
// Ruf bei den Kundschaftern: Rang ab Punkten, dazu ein Vorteil
const LREP = [
  { at: 0, n: _t('Fremder'), d: _t('Noch kennt dich hier niemand.') },
  { at: 150, n: _t('Bekannter'), d: _t('Händler geben 10 % Rabatt und verkaufen Leuchtfeuersteine.') },
  { at: 400, n: _t('Kundschafter'), d: _t('+1 Platz im Rucksack.') },
  { at: 900, n: _t('Verbündeter'), d: _t('Ein Auftrag mehr bei jeder Kundschafterin.') },
  { at: 1800, n: _t('Held der Lande'), d: _t('+1 Platz im Rucksack, Ausgänge eine Sekunde schneller.') },
  { at: 3500, n: _t('Legende der Lande'), d: _t('Jeder Ausflug beginnt mit einem Schlüssel.') }
];
const LNPC = {
  mis: { n: _t('Kundschafterin Elwa'), sp: 'elff', c: '#57c7e6', icon: 'l_auftrag', hi: _t('Aufträge') },
  trade: { n: _t('Händler Bodo'), sp: 'dwarf', c: '#79c24e', icon: 'l_tausch', hi: _t('Tauschen') },
  heal: { n: _t('Kräuterfrau Mirja'), sp: 'wizf', c: '#f786a0', icon: 'l_heil', hi: _t('Heilen') }
};
// Rivalen: Name, Kampfweise (Gegnerart), Aussehen als Held (Körper, Rüstungsstufe, Haare)
const LRIV = [[_t('Kira die Flinke'), 'elfe', 'elf_f', 3, 1], [_t('Brom Eisenfaust'), 'zwerg', 'dwarf_m', 2, 3], [_t('Selvi Schattenschritt'), 'elfe', 'elf_m', 5, 8], [_t('Taro der Gierige'), 'todesritter', 'knight_m', 4, -1], [_t('Mara Dornhand'), 'hexe', 'wizard_f', 3, 7], [_t('Ulf Sturmbart'), 'zwerg', 'dwarf_f', 3, 4], [_t('Nesa die Stille'), 'pyro', 'wizard_m', 6, 3], [_t('Gorm der Sammler'), 'todesritter', 'lizard_m', 4, -1]];
const LNAMED = [_t('Rotzahn der Plünderer'), _t('Moorhexe Ilka'), _t('Knochenfürst Zarr'), _t('Grimmfell'), _t('Sturmklaue'), _t('Vargul der Wilde'), _t('Die Aschenbraut'), _t('Schädelbrecher Orm')];
const LBOX = 40, LPACK = 20, LCPMAX = 12;
let LW = null;                     // laufender Ausflug (nur im Speicher)
const LG = { from: 'hide', sel: null, arm: null, tab: 'tausch', note: null, start: null, mz: null };   // Zustand der Bildschirme

/* ---------- Spielstand ---------- */
function lMeta() { return SAVE.meta.lande; }
function lNum(v) { return Math.max(0, Math.floor(+v) || 0); }
function lEntryOk(e) {
  if (!e || typeof e !== 'object') return false;
  switch (e.t) {
    case 'item': return !!e.it && typeof e.it === 'object' && !!e.it.slot && !!e.it.uid;
    case 'mat': return Object.prototype.hasOwnProperty.call(MATS, e.k) && e.n > 0;
    case 'gem': return typeof e.k === 'string' && !!GEMS[e.k.split(':')[0]] && e.n > 0;
    case 'part': return typeof e.k === 'string' && e.n > 0;
    case 'egg': return !!e.d && typeof e.d === 'object';
    case 'gold': return e.n > 0;
    case 'mod': return typeof e.k === 'string' && !!e.k && e.n > 0;
  }
  return false;
}
// Erkundung: Kartenfelder (384 px) in Blöcken von 16 × 16 Feldern als Bits (Base64) – klein auch nach 24 h Fußmarsch
function lB64(a) { const u = new Uint8Array(a.buffer, a.byteOffset, 32); let s = ''; for (let i = 0; i < 32; i++) s += String.fromCharCode(u[i]); return btoa(s).replace(/=+$/, ''); }
function lUnB64(s) { const a = new Uint32Array(8); try { const b = atob(String(s)), u = new Uint8Array(a.buffer); for (let i = 0; i < Math.min(32, b.length); i++) u[i] = b.charCodeAt(i); } catch (_) { } return a; }
function lMetaFix(d) {
  d = d && typeof d === 'object' ? d : {};
  const old = !d.v && (Array.isArray(d.tx) || d.runs > 0);   // Spielstand aus 6.0: Weltstufen gibt es nicht mehr
  const map = {}; if (d.map && typeof d.map === 'object') for (const k in d.map) if (/^-?\d+,-?\d+$/.test(k) && typeof d.map[k] === 'string' && d.map[k].length <= 44) map[k] = d.map[k];
  const cps = (Array.isArray(d.cps) ? d.cps : []).filter(c => c && isFinite(c.x) && isFinite(c.y) && Math.hypot(c.x, c.y) < LWR * LCK).slice(0, LCPMAX).map(c => ({ i: lNum(c.i), x: Math.round(c.x), y: Math.round(c.y), t: lNum(c.t), u: lNum(c.u), w: c.w ? 1 : 0 }));   // w: gesetzt in der Welt mit 20 Ringen (ohne w: vielleicht in einer neuen Barriere)
  const tx = Array.isArray(d.tx) ? d.tx.reduce((a, v) => a + lNum(v), 0) : 0;
  return {
    v: 2, runs: lNum(d.runs), ext: lNum(d.ext), deaths: lNum(d.deaths), aband: lNum(d.aband), best: lNum(d.best), rep: lNum(d.rep), done: lNum(d.done), keys: Math.min(99, lNum(d.keys)), kills: lNum(d.kills), bosses: lNum(d.bosses), rivals: lNum(d.rivals), tips: lNum(d.tips),
    tools: lNum(d.tools) & ((1 << LANDE_TOOLS.length) - 1), stones: Math.min(99, d.stones == null ? (old ? 1 + Math.min(4, Math.floor(tx / 3)) : 1) : lNum(d.stones)), cps, cpn: Math.max(lNum(d.cpn), ...cps.map(c => c.i + 1), 0),
    start: d.start === 'tor' || cps.some(c => 'c' + c.i === d.start) ? d.start : 'tor', map, regs: (Array.isArray(d.regs) ? d.regs : []).filter(s => typeof s === 'string' && s.length < 16).slice(0, 40000),
    far: lNum(d.far), walk: lNum(d.walk), nights: lNum(d.nights), cross: lNum(d.cross), ring: Math.min(LRMAX, Math.max(lNum(d.ring), lRingOf(lNum(d.far) / 10000 * LWR))), end: lNum(d.end), endN: lNum(d.endN),
    box: (Array.isArray(d.box) ? d.box : []).filter(lEntryOk).slice(0, LBOX),
    cur: d.cur && typeof d.cur === 'object' && d.cur.hero ? d.cur : null
  };
}
// Wirft hier etwas, würde loadAll einen leeren Spielstand anlegen – deshalb nie werfen
HOOK.meta.push(m => { try { m.lande = lMetaFix(m.lande); } catch (e) { console.error('Lande (meta):', e); m.lande = lMetaFix(null); } LMAP = null; LREGS = null; });
let LMAP = null, LREGS = null;      // entschlüsselte Karte (Map Block → Uint32Array(8)), entdeckte Regionen (Set)
function lMap() { if (!LMAP) { LMAP = new Map(); const M = lMeta().map; for (const k in M) LMAP.set(k, lUnB64(M[k])); } return LMAP; }
function lRegs() { if (!LREGS) LREGS = new Set(lMeta().regs); return LREGS; }
function lFKey(fx, fy) { return Math.floor(fx / 16) + ',' + Math.floor(fy / 16); }
function lFBit(fx, fy) { return (fy - Math.floor(fy / 16) * 16) * 16 + fx - Math.floor(fx / 16) * 16; }
function lFHas(map, fx, fy) { const a = map.get(lFKey(fx, fy)); if (!a) return false; const b = lFBit(fx, fy); return !!(a[b >> 5] & (1 << (b & 31))); }
function lFSet(map, fx, fy) { const k = lFKey(fx, fy); let a = map.get(k); if (!a) { a = new Uint32Array(8); map.set(k, a); } const b = lFBit(fx, fy), m = 1 << (b & 31); if (a[b >> 5] & m) return false; a[b >> 5] |= m; return true; }
// Bekannt = gesichert (Karte) oder in diesem Ausflug gesehen
function lKnownF(fx, fy) { return lFHas(lMap(), fx, fy) || !!(LW && LW.on && lFHas(LW.fog, fx, fy)); }
function lKnownW(wx, wy) { return lKnownF(Math.floor(wx / LFLD), Math.floor(wy / LFLD)); }
function lKnown(o) { return lKnownW(o.x - LOFF, o.y - LOFF); }
// Karte sichern: was dieser Ausflug aufgedeckt hat, kommt in den Spielstand (Leuchtfeuer setzen, durch ein Tor entkommen)
function lCommit() {
  const L = LW, M = lMeta(), map = lMap(); if (!L) return 0; let n = 0;
  for (const [k, a] of L.fog) { let b = map.get(k); if (!b) { b = new Uint32Array(8); map.set(k, b); } let ch = false; for (let i = 0; i < 8; i++) { const v = b[i] | a[i]; if (v !== b[i]) { b[i] = v; ch = true; } } if (ch) { M.map[k] = lB64(b); n++; } }
  L.fog = new Map();
  const R = lRegs(); for (const id of L.regs) if (!R.has(id)) { R.add(id); M.regs.push(id); }
  L.regs = new Set();
  if (L.farT > M.far) M.far = L.farT;
  return n;
}
/* ---------- Werkzeuge (Konto, für immer) ---------- */
function lToolBit(i) { return i >= 0 && !!(lMeta().tools & (1 << i)); }
function landeToolHas(key) { try { const i = typeof key === 'number' ? key : LTOOLK[key]; return i != null && lToolBit(i); } catch (_) { return false; } }
function landeToolGive(key) {
  const i = typeof key === 'number' ? key : LTOOLK[key]; if (i == null || !LANDE_TOOLS[i] || !SAVE) return false;
  const M = lMeta(); if (M.tools & (1 << i)) return false; M.tools |= 1 << i; persist();
  const T_ = LANDE_TOOLS[i]; try { sfx('myth'); lBanner(_t('NEUES WERKZEUG: {n}', { n: T_.n.toLocaleUpperCase(LOCALE) }), T_.d); } catch (_) { }
  stat('landeTools'); return true;
}
function lToolCount() { let n = 0; for (let i = 0; i < LANDE_TOOLS.length; i++) if (lToolBit(i)) n++; return n; }
// Das nächste fehlende Werkzeug (in Ring-Reihenfolge)
function lNextTool() { for (let i = 0; i < LANDE_TOOLS.length; i++) if (!lToolBit(i)) return i; return -1; }
/* ---------- Schnittstellen für andere Systeme ---------- */
function landeActive() { return lOn(); }
function lOn() { return !!(LW && LW.on); }   // intern: nicht über landeActive (Tests anderer Teile ersetzen es)
function landeLocal(wx, wy) { return { x: wx + LOFF, y: wy + LOFF }; }
function landeWorld(x, y) { return { x: x - LOFF, y: y - LOFF }; }
function landePos() { if (!lOn()) return null; const wx = P.x - LOFF, wy = P.y - LOFF; return { wx, wy, cx: Math.floor(wx / LCK), cy: Math.floor(wy / LCK) }; }
function landeDepth() { if (!lOn()) return 0; return Math.min(1, Math.hypot((P.x - LOFF) / LCK, (P.y - LOFF) / LCK) / LWR); }
function lCtxOf(cx, cy, salt) {
  const R = lRegAtC(cx + .5, cy + .5), depth = lDepthC(cx + .5, cy + .5);
  return { cx, cy, depth, stage: R.stage, biome: R.biome, region: R.id, rname: lRegName(R), landmark: lLandmark(R), ring: R.ring, x0: cx * LCK, y0: cy * LCK, trip: LW ? LW.seed : 0, R: mulberry(lH(cx, cy, lSalt(salt == null ? 0 : salt))) };
}
function landeCtx(cx, cy, salt) { return lCtxOf(Math.floor(+cx) || 0, Math.floor(+cy) || 0, salt); }
// Leuchtfeuer des Helden (Welt-Pixel), z. B. für Hinweise anderer Systeme
function landeBeacons() { try { if (!SAVE || !SAVE.meta) return []; return lMeta().cps.map(c => ({ name: lCpName(c), x: c.x, y: c.y, i: c.i })); } catch (_) { return []; } }
// Aussagen über einen Ort (Welt-Pixel): Region, Biom, Stufe, Tiefe, Entfernung zum Tor
function lInfoW(wx, wy) { const R = lRegAtC(wx / LCK, wy / LCK); return { R, B: LANDE_BIOMES[R.biome], stage: R.stage, depth: Math.min(1, Math.hypot(wx, wy) / LCK / LWR), km: Math.hypot(wx, wy) / 8000 }; }
function lKm(px_) { const m = px_ / 8; return lNb(m < 1000 ? _t('{n} m', { n: Math.round(m / 10) * 10 }) : _t('{n} km', { n: (m / 1000).toLocaleString(LOCALE, { maximumFractionDigits: m < 10000 ? 1 : 0 }) })); }
// Zahl und Einheit nicht umbrechen („770 m“, „2,1 km“, „12 %“): geschütztes Leerzeichen nach einer Ziffer
function lNb(s) { return String(s).replace(/(\d) (?=\S)/g, '$1\u00a0'); }
// Ring an einem Abstand vom Tor (Chunks)
function lRingOf(rho) { let r = 0; while (r < LRMAX && LRING[r] <= rho) r++; return r; }

/* ---------- Begleiter (Schnittstelle aus js/pets.js, alles optional) ---------- */
function lPetApi() { return typeof petActive === 'function' && typeof petBagSize === 'function'; }
function lPet() { if (!lPetApi()) return null; try { return petActive() || null; } catch (_) { return null; } }
function lBagSize(p) { if (!p) return 0; try { return Math.max(0, Math.floor(petBagSize(p)) || 0); } catch (_) { return 0; } }
function lBag(p) { if (!Array.isArray(p.bag)) p.bag = []; return p.bag; }
function lPetName(p) { try { if (typeof petName === 'function') return petName(p); } catch (_) { } return p && p.nm ? p.nm : _t('Begleiter'); }
function lPetIcon(p) { try { if (typeof petIconURL === 'function') { const u = petIconURL(p); if (u) return u; } } catch (_) { } return iconURL(['pa', 'l_ei']); }
function lPetAny() { const M = SAVE && SAVE.meta.pets; return M && Array.isArray(M.list) ? M.list.find(x => x.id === M.act) || null : null; }
function lPetHurt(p) { try { return !!p && typeof petIsHurt === 'function' && petIsHurt(p); } catch (_) { return false; } }

/* ---------- Beute-Einträge: Name, Bild, Wert ---------- */
const LMATV = { holz: 2, stein: 2, faser: 2, samen: 3, feder: 5, eisenholz: 20, marmor: 20, obsidian: 60, sternholz: 150 }; MONMATS.forEach((k, i) => { LMATV[k] = Math.round(5 * Math.pow(1.5, i)); });   // Rohstoffe: eigener Wert (js/bauen.js)
function lGemParts(k) { const [id, gr] = String(k).split(':'); return { id, gr: +gr || 0 }; }
function lName(e) {
  try {
    switch (e.t) {
      case 'item': return itemName(e.it);
      case 'mat': return MATS[e.k].n;
      case 'gem': { const g = lGemParts(e.k); return _t('{grade} {gem}', { grade: GEMGRADE[g.gr] || '', gem: GEMS[g.id].n }); }
      case 'part': { if (typeof pparse === 'function' && typeof pname === 'function') { const p = pparse(e.k); return pname(p.t, p.g, p.el); } return _t('Bauteil'); }
      case 'egg': return (typeof petLabel === 'function' && petLabel(e.d)) || _t('Begleiter-Ei');
      case 'gold': return _t('{n} Gold', { n: fmt(e.n) });
      case 'mod': return (typeof modName === 'function' && modName(e.k)) || _t('Mod');
    }
  } catch (_) { }
  return '?';
}
function lCol(e) {
  switch (e.t) {
    case 'item': return RAR[e.it.rar] ? RAR[e.it.rar].c : '#c8c8c8';
    case 'mat': return MATS[e.k] ? MATS[e.k].c : '#c8c8c8';
    case 'gem': { const g = GEMS[lGemParts(e.k).id]; return g ? g.c : '#c8c8c8'; }
    case 'part': { try { if (typeof gradeCol === 'function' && typeof pparse === 'function') return gradeCol(pparse(e.k).g); } catch (_) { } return '#c8c8c8'; }
    case 'egg': return '#ffd24a';
    case 'gold': return '#e8b04a';
    case 'mod': return '#b892f4';
  }
  return '#c8c8c8';
}
function lIcon(e) {
  try {
    switch (e.t) {
      case 'item': return itemIconURL(e.it);
      case 'mat': return iconURL(['mat', e.k]);
      case 'gem': { const g = lGemParts(e.k); return iconURL(['gem', g.id, g.gr]); }
      case 'part': if (typeof partIconURL === 'function' && typeof pparse === 'function') { const p = pparse(e.k); return partIconURL(p.t, p.g, p.el); } return iconURL(['pa', 'l_teil']);
      case 'egg': { if (typeof petIconURL === 'function') { const u = petIconURL(e.d); if (u) return u; } return iconURL(['pa', 'l_ei']); }
      case 'gold': return iconURL(['pa', 'l_gold']);
      case 'mod': { if (typeof modIconURL === 'function') { const u = modIconURL(e.k); if (u) return u; } return iconURL(['pa', 'l_mod']); }
    }
  } catch (_) { }
  return iconURL(['pa', 'l_teil']);
}
function lCount(e) { return e.t === 'mat' || e.t === 'gem' || e.t === 'part' || e.t === 'mod' ? e.n : 0; }
// Marktwert: aus dem Basar (js/market.js), sonst eine einfache Schätzung
function lVal(e) {
  try { if (typeof lootValue === 'function') { const v = lootValue(e); if (v > 0) return Math.round(v); } } catch (_) { }
  switch (e.t) {
    case 'item': { try { if (typeof itemValue === 'function') { const v = itemValue(e.it); if (v > 0) return Math.round(v); } } catch (_) { } return Math.round(itemPrice(e.it) * [1, 1.3, 1.8, 2.6, 5, 4, 12][e.it.rar || 0]); }
    case 'mat': return (LMATV[e.k] || 5) * e.n;
    case 'gem': { const g = lGemParts(e.k); return 25 * (g.gr + 1) * (g.gr + 1) * e.n; }
    case 'part': { let g = 1; try { g = pparse(e.k).g || 1; } catch (_) { } return 20 * g * g * e.n; }
    case 'egg': return 300 * Math.pow(1 + (+e.d.tier || 0), 2);
    case 'gold': return e.n;
    case 'mod': { try { if (typeof modValue === 'function') { const v = modValue(e.k); if (v > 0) return Math.round(v * e.n); } } catch (_) { } return 60 * e.n; }
  }
  return 0;
}
function lSum(list) { let v = 0; for (const e of list) v += lVal(e); return v; }
function lHype(e) { return (e.t === 'egg' ? 9e8 : e.t === 'item' && e.it.rar >= 3 ? e.it.rar * 1e8 : e.t === 'mod' ? 5e7 : 0) + lVal(e); }
// Kleine Zeile für eine Beute (auch für andere Systeme)
function landeLootHTML(e, right) {
  if (!lEntryOk(e)) return '';
  if (e.t === 'mod' && right == null && typeof modLootHTML === 'function') { try { const h = modLootHTML(e); if (h) return h; } catch (_) { } }
  const c = lCol(e), n = lCount(e);
  return `<div class="row" style="cursor:default"><div class="ic" style="box-shadow:inset 0 0 0 2px ${c}"><img src="${lIcon(e)}" alt=""></div><div><div class="nm" style="color:${c}">${esc(lName(e))}${n > 1 ? ' ×' + n : ''}</div><div class="st">${e.t === 'item' ? esc(RAR[e.it.rar].n + ' · ' + MAT[e.it.tier].n) : ''}</div></div>${right != null ? right : `<span class="pill dim">${_t('{n} G', { n: fmt(lVal(e)) })}</span>`}</div>`;
}

/* ---------- Rucksack ---------- */
function lRank(rep) { let r = 0; LREP.forEach((x, i) => { if (rep >= x.at) r = i; }); return r; }
function lPerk(k) { const r = lRank(lMeta().rep); if (k === 'pack') return (r >= 2 ? 1 : 0) + (r >= 4 ? 1 : 0); if (k === 'rabatt') return (r >= 1 ? .9 : 1) * perk('buy', 1); if (k === 'mis') return r >= 3 ? 1 : 0; if (k === 'ch') return r >= 4 ? 1 : 0; if (k === 'key') return r >= 5 ? 1 : 0; if (k === 'stone') return r >= 1; return 0; }
// Plätze im Rucksack: 20, je Sattlerei-Stufe (Versteck, 0–10) +2, dazu der Ruf bei den Kundschaftern
function packCap() { return LPACK + 2 * (typeof sattlerLv === 'function' ? sattlerLv() : 0) + (SAVE && SAVE.meta.lande ? lPerk('pack') : 0); }
function lCap() { return packCap(); }
function lStack(e) { return e.t === 'mat' || e.t === 'gem' || e.t === 'part' || e.t === 'gold' || e.t === 'mod'; }
function lAdd(list, e, cap) { if (lStack(e)) { const s = list.find(x => x.t === e.t && x.k === e.k); if (s) { s.n += e.n; return true; } } if (list.length >= cap) return false; list.push(e); return true; }
// Stapelbares in den Sammelbeutel (immer Platz), Gegenstände und Eier in einen Rucksack-Platz
function lPackAdd(e) { lPouch(); if (lStack(e)) return lPouchPut(e); return lAdd(LW.pack, e, lCap()); }
// Für andere Systeme (z. B. Mods aus js/mods.js): Beute in den Rucksack – false, wenn kein Ausflug läuft oder der Rucksack voll ist
function landePackAdd(e) {
  if (!lOn() || !lEntryOk(e)) return false;
  if (!lPackAdd(e)) { lMsg('full', _t('Rucksack voll! Wirf etwas weg oder leg es in die Begleiter-Tasche.'), '#ff6a5a', 2.5); return false; }
  lGot(e); return true;
}
function lPackHas(t, k) { return lPouchHas(lPouchKey({ t, k })); }
function lPackGold() { return lPouchHas('gold'); }
function lPackPay(t, k, n) { return lPouchTake(lPouchKey({ t, k }), n); }

/* ---------- Sammelbeutel (6.2): Gold, Material, Edelsteine, Bauteile und Mods ohne Platzgrenze ----------
   LW.pouch = { gold: n, <Material>: n, 'gem:<k>': n, 'part:<k>': n, 'mod:<k>': n } – nur im Speicher wie der Rucksack:
   beim Entkommen daheim, bei Tod und Abbruch verloren. Was noch als Stapel im Rucksack liegt (6.1, andere Systeme), wandert hinein. */
function lPouch() {
  const L = LW; if (!L.pouch || typeof L.pouch !== 'object' || Array.isArray(L.pouch)) L.pouch = {};
  if (Array.isArray(L.pack) && L.pack.some(lStack)) L.pack = L.pack.filter(e => { if (!lStack(e)) return true; if (lEntryOk(e)) lPouchPut(e); return false; });
  return L.pouch;
}
function lPouchKey(e) { return e.t === 'gold' ? 'gold' : e.t === 'mat' ? String(e.k) : e.t + ':' + e.k; }
function lPouchEntry(k, n) {
  k = String(k); n = Math.floor(+n) || 0; if (k === 'gold') return { t: 'gold', n };
  const i = k.indexOf(':'); if (i < 0) return { t: 'mat', k, n };
  const t = k.slice(0, i); return t === 'gem' || t === 'part' || t === 'mod' ? { t, k: k.slice(i + 1), n } : null;
}
function lPouchPut(e) { const n = Math.floor(+e.n) || 0; if (n <= 0 || !LW.pouch) return false; const k = lPouchKey(e); if (/^(__proto__|constructor|prototype)$/.test(k)) return false; LW.pouch[k] = (LW.pouch[k] || 0) + n; return true; }
function lPouchHas(k) { const B = lPouch(); return Object.prototype.hasOwnProperty.call(B, k) ? B[k] || 0 : 0; }
function lPouchTake(k, n) { const B = lPouch(), h = lPouchHas(k); if (!(n > 0) || h < n) return false; B[k] = h - n; if (B[k] <= 0) delete B[k]; return true; }
const LPOUCH_T = { gold: 0, mat: 1, gem: 2, part: 3, mod: 4 };
function lPouchList() {
  const B = lPouch(), out = [];
  for (const k of Object.keys(B)) { const e = lPouchEntry(k, B[k]); if (e && e.n > 0 && lEntryOk(e)) out.push(e); }
  const mi = k => { const i = MATORDER.indexOf(k); return i < 0 ? 99 : i; };
  return out.sort((a, b) => LPOUCH_T[a.t] - LPOUCH_T[b.t] || (a.t === 'mat' ? mi(a.k) - mi(b.k) : a.t === 'gem' ? lGemParts(b.k).gr - lGemParts(a.k).gr || (a.k < b.k ? -1 : 1) : a.k < b.k ? -1 : a.k > b.k ? 1 : 0));
}
function lPouchTakeAll() { const l = lPouchList(); LW.pouch = {}; return l; }
// Schnittstelle: Gesammeltes (Holz, Stein, Fasern … – Teil B) in den Sammelbeutel. false außerhalb der Lande – dann gibt der Aufrufer selbst.
function landePouchAdd(k, n, quiet) {
  if (!lOn()) return false;
  const e = lPouchEntry(k, n); if (!e || !(e.n > 0) || !lEntryOk(e)) return false;
  lPouch(); if (!lPouchPut(e)) return false; if (!quiet) lGot(e); return true;
}

/* ---------- Heimbringen: Beutel → Lager → Fundkiste → verkauft (Vögel: Lager → Beutel → Fundkiste) ---------- */
function lDeliver(list, stashFirst) {
  const r = { bag: 0, stash: 0, box: 0, sold: 0, eggs: 0, n: 0 }, M = lMeta(), S = SAVE.meta.hide.stash, cap = typeof stashCap === 'function' ? stashCap() : 0;
  for (const e of list) {
    if (!lEntryOk(e)) continue; r.n++;
    switch (e.t) {
      case 'item': { const it = e.it; delete it.lw; if (stashFirst && S.length < cap) { S.push(it); r.stash++; } else if (P.bag.length < bagCap()) { P.bag.push(it); r.bag++; } else if (S.length < cap) { S.push(it); r.stash++; } else if (M.box.length < LBOX) { M.box.push(e); r.box++; } else { r.sold += itemPrice(it); P.gold += itemPrice(it); } break; }
      case 'mat': gainMat(e.k, e.n); break;
      case 'gem': P.gems[e.k] = (P.gems[e.k] || 0) + e.n; break;
      case 'part': if (typeof padd === 'function' && P.parts) padd(e.k, e.n); else if (M.box.length < LBOX) { M.box.push(e); r.box++; } break;
      case 'gold': P.gold += e.n; break;
      case 'mod': { let ok = false; try { ok = typeof modGive === 'function' && modGive(e.k, e.n) !== false; } catch (_) { } if (!ok) { if (M.box.length < LBOX) { M.box.push(e); r.box++; } else { const g = lVal(e); P.gold += g; r.sold += g; } } break; }
      case 'egg': { let ok = false; try { ok = typeof eggGive === 'function' ? !!eggGive(e.d.sp, true, { tier: e.d.tier }) : typeof petImport === 'function' && petImport(Object.assign({ egg: 1 }, e.d)); } catch (_) { } if (ok) r.eggs++; else if (M.box.length < LBOX) { M.box.push(e); r.box++; } else { const g = lVal(e); P.gold += g; r.sold += g; } break; }
    }
  }
  return r;
}
function lDeliverHTML(r) {
  const p = [];
  if (r.bag) p.push(_t('{n} in den Beutel', { n: r.bag })); if (r.stash) p.push(_t('{n} ins Lager', { n: r.stash })); if (r.box) p.push(_t('{n} in die Fundkiste am Weltentor', { n: r.box })); if (r.eggs) p.push(_t('{n} Ei(er) ins Brutnest', { n: r.eggs })); if (r.sold) p.push(_t('Kein Platz mehr: für {n} Gold verkauft', { n: fmt(r.sold) }));
  return p.length ? `<p class="sub">${p.join(' · ')}</p>` : '';
}
// Was der Begleiter in der Tasche trägt, kommt heim (und die Tasche wird leer)
function lPetBagTake(p) { if (!p || !Array.isArray(p.bag)) return []; try { if (typeof petBagTake === 'function') return petBagTake(p).filter(lEntryOk); } catch (_) { } const l = p.bag.splice(0); persist(); return l.filter(lEntryOk); }
function lBagOk(e) { try { return typeof petLootFix !== 'function' || !!petLootFix(e); } catch (_) { return false; } }

/* ---------- Seltenheit in der Freiwelt (benutzt von randomItem in js/items.js) ---------- */
function landeLuck() { if (!LW || !LW.on) return 0; return LW.rollL || lLuckAt(P.x, P.y); }
// r = Zufallszahl (durch Beute-Bonus schon kleiner), L = Glück ≥ 1 → Seltenheit (6 = Mythisch)
function landeRar(r, L) { const m = .0012 * L, l = m + .012 * L, e = l + .05 + .01 * L, s = e + .18, g = s + .34; return r < m ? 6 : r < l ? 4 : r < e ? 3 : r < s ? 2 : r < g ? 1 : 0; }

/* ---------- Kleine Rechenhelfer der Welt ---------- */
// Region an einem Spielpunkt: schnell aus dem geladenen Chunk, sonst gerechnet
function lRegAt(x, y) { const r = lRecAt(x, y); if (r) return r.d.regs[r.d.rg[lTileI(r, x, y)]]; return lRegAtC((x - LOFF) / LCK, (y - LOFF) / LCK); }
function lDepthAt(x, y) { return Math.min(1, Math.hypot((x - LOFF) / LCK, (y - LOFF) / LCK) / LWR); }
function lLuckAt(x, y) { return lLuckD(lDepthAt(x, y)) * (1 + (LW ? lNight(LW.t) * .2 : 0)); }
function lStage(x, y) { const st = lRegAt(x, y).stage; return st + (LW ? Math.round(lNight(LW.t) * (2 + st * .06)) : 0); }
function lSetStage(st) { if (!G) return; G.row = st - 1 - (P.act - 1) * 7; G.stage = st; }
function lBioAt(x, y) { return lRegAt(x, y).biome; }
function lPool(bk, st) { const l = (LANDE_BIOMES[bk] ? LANDE_BIOMES[bk].en : []).filter(k => EN[k] && EN[k].from <= st + 5); return l.length ? l : poolFor(Math.max(1, st)).slice(-6); }
function lWave(bk, st, budget, max) { const pool = lPool(bk, st), list = []; while (budget > .9 && list.length < (max || 8)) { const o = pool.filter(k => EN[k].cost <= budget + .5); if (!o.length) break; const k = pick(o); list.push(k); budget -= EN[k].cost; } if (!list.length) list.push(pool[0]); return list; }
function lMatPick(st) { const a = MONMATS.slice(0, clamp(5 + Math.floor(st / 5), 5, MONMATS.length)); return a[Math.max(0, a.length - 1 - Math.floor(Math.random() * Math.random() * a.length))]; }
// Begleiter-Ei: aus dem Biom (Teil K: eggForBiome), sonst aus dem Brutnest-Würfel
function lEgg(luck, bk, depth) {
  try {
    if (typeof eggForBiome === 'function') { const r = eggForBiome(bk || (LW && LW.on ? lBioAt(P.x, P.y) : 'wiese'), depth == null ? landeDepth() : depth, luck); const sp = r && (typeof r === 'string' ? r : r.sp || r.species); if (sp && (typeof PET_SP === 'undefined' || PET_SP[sp])) return { egg: 1, sp, tier: r && r.tier != null ? r.tier : (typeof PET_SP !== 'undefined' && PET_SP[sp] ? PET_SP[sp].t : undefined) }; }
    if (typeof eggRoll === 'function' && typeof eggTierRoll === 'function') { const tier = eggTierRoll(luck), sp = eggRoll(tier); if (sp) return { egg: 1, sp, tier }; }
    if (typeof PET_SP !== 'undefined' && PET_SP) { const ks = Object.keys(PET_SP); if (ks.length) return { egg: 1, sp: pick(ks) }; }
  } catch (_) { }
  return null;
}
// Mod (Teil M): Schlüssel aus modRoll, sonst nichts
function lMod(depth, luck) { try { if (typeof modRoll === 'function') { const k = modRoll(depth, luck); if (k && typeof k === 'string') return { t: 'mod', k, n: 1 }; } } catch (_) { } return null; }
function lPart(st, bonus) { try { if (typeof partRoll === 'function' && typeof partGrade === 'function' && typeof PARTORDER !== 'undefined') return partRoll(pick(PARTORDER), partGrade(Math.min(st, 60), bonus || 0)); } catch (_) { } return null; }
// Gegenstand mit Freiwelt-Glück
function lItem(minRar, luckMul, st) {
  const s = st || lStage(P.x, P.y); LW.rollL = lLuckAt(P.x, P.y) * (luckMul || 1);
  let it; try { it = randomItem(s, minRar || 0, { setChance: .008 * (luckMul || 1) }); } finally { LW.rollL = 0; }
  return it;
}
// Wie gefährlich ist eine Stufe für diesen Helden? (Kampagnen-Fortschritt und Level)
function lHeroSt() { return Math.max(P.lv * 1.15, 7 * (P.maxAct || 1)) + (P.paragon || 0) * .15; }
function lRate(st) { const k = st / lHeroSt(); return k < .75 ? { n: _t('leicht'), c: '#79c24e' } : k < 1.05 ? { n: _t('passend'), c: '#e8d04a' } : k < 1.35 ? { n: _t('gefährlich'), c: '#ff8a3a' } : { n: _t('tödlich'), c: '#ff4a4a' }; }

/* ---------- Betreten ---------- */
function lCanGo() { return !!P && P.lv >= 5; }
// Startpunkte: das Weltentor und die eigenen Leuchtfeuer
function lStarts() { const M = lMeta(); return [{ id: 'tor', x: 384, y: 372, n: _t('Weltentor') }].concat(M.cps.slice().sort((a, b) => b.u - a.u || b.t - a.t).map(c => ({ id: 'c' + c.i, x: c.x, y: c.y + 40, cp: c, n: lCpName(c) }))); }
function lCpName(c) { return _t('Leuchtfeuer {n} · {region}', { n: c.i + 1, region: lRegName(lRegAtC(c.x / LCK, c.y / LCK)) }); }
function landeStart(sid) {
  if (!P || !lCanGo()) { sfx('deny'); return false; }
  const M = lMeta(), st = lStarts().find(s => s.id === (sid || M.start)) || lStarts()[0]; M.start = st.id; hideOverlay(); setState('menu');
  showOverlay(`<div class="center"><h2>${_t('DAS TOR ÖFFNET SICH …')}</h2><p class="sub">${esc(st.n)}</p></div>`);
  setTimeout(() => { try { lBegin(st); } catch (e) { console.error('Lande (Start):', e); LW = null; document.body.classList.remove('lande'); toast(_t('Das Tor flackert – versuch es noch einmal.'), '#ff6a5a'); lGate(); } }, 30);
  return true;
}
function lBegin(st) {
  st = st || lStarts()[0];
  const M = lMeta(), seed = (Date.now() ^ Math.floor(Math.random() * 1e9)) >>> 0;
  lPoolReg();
  if (LW) for (const r of LW.cm.values()) lFree(r);
  const L = LW = { id: uid(), seed, on: false, t: 0, cm: new Map(), ts: new Map(), fog: new Map(), regs: new Set(), pack: [], pouch: {}, mis: [], misOn: false, misFrom: null, pats: [], rivals: [], beast: null, offers: new Map(), healFree: true, scrolls: 0, xs: [], buffT: 0, buffV: 0, sleep: [], near: null, dig: 0, digO: null, tick: 0, hudT: 0, mapT: 0, huntT: 50, revT: 0, kills: 0, chests: 0, msgT: {}, hurtT: -9, ch: 0, chEx: null, danger: 0, reg: null, pcx: null, pcy: null, q: [], farT: 0, rivT: 150 + Math.random() * 120, start: st.id, nights: 0, cross: new Set(), lx: 0, ly: 0, ambA: 0, hazT: 0, newR: 0 };
  LRL = null;
  AW = AH = LWS; BD = { x0: 16, x1: LWS - 16, y0: 16, y1: LWS - 16 };
  bg = { c: { width: LWS, height: LWS, getContext: () => LDEC }, draw: lBgDraw, b: { key: '', name: '', tint: [1, 1, 1], dark: 0, root: 45, dust: '#8a7a6a', vein: 'erz', pool: null }, fountains: [], torches: [] };
  enemies = []; projs = []; parts = []; pickups = []; texts = []; rings = []; corpses = []; ghosts = []; fx = []; allies = []; obs = []; spikes = []; hazards = []; traps = []; pools = [];
  G = { type: 'lande', row: 0, stage: 6, waves: [], wi: 0, pending: [], phase: 'lande', t: 0, ambT: 999, timer: 0, dark: 0, lootMul: 1 + weekFx('loot'), spawnT: 0, spikeRush: 0, goldgob: null, startTime: T, kills: 0, extra: {}, daily: null, dstage: 0, dmod: null };
  P.x = st.x + LOFF; P.y = st.y + LOFF; P.vx = P.vy = 0; P.atkT = 0; P.roll = 0; P.rollA = 0; P.inv = 1.5; P.spin = 0; P.leap = null; P.dash = null; P.volley = 0; P.z = 0; P.chain = 0; P.wall = 0; P.stealth = 0; P.cds = [0, 0, 0]; P.manAim = null; P.hp = P.st.hp; P.res = P.st.resMax;
  if (st.cp) st.cp.u = Date.now();
  L.pet = lPet(); L.petBag = L.pet ? lBagSize(L.pet) : 0;
  if (lPerk('key')) M.keys++;
  M.runs++; M.cur = { hero: P.id, id: L.id, t0: Date.now(), gear0: JSON.parse(JSON.stringify(P.gear)), st: st.id, d: lDepthAt(P.x, P.y) };
  L.on = true;
  lStream(true);
  if (!lWalk(P.x, P.y)) { const p = lFreeNear(P.x, P.y, 200); if (p) { P.x = p.x; P.y = p.y; } }
  L.lx = P.x; L.ly = P.y; L.farT = Math.round(lDepthAt(P.x, P.y) * 10000);
  lSetStage(lStage(P.x, P.y)); lReveal();
  hook('room', 'lande');
  cam.x = P.x - VW / 2; cam.y = P.y - 10 - VH / 2;
  $('bossbar').hidden = true; $('objective').textContent = '';
  document.body.classList.add('lande'); setState('play'); showHud(true); hideOverlay(); lHudShow(true);
  lRegionTick(true);
  if (!M.tips) lTip(8, _t('Tipp: Je weiter du dich vom Weltentor entfernst, desto stärker die Gegner – und desto besser die Beute.'));
  saveChar(); persist();
}
// Freier Platz in der Nähe (Spiralsuche)
function lFreeNear(x, y, rad) { for (let k = 0; k < 80; k++) { const a = k * 2.4, r = 6 + k * rad / 80, nx = x + Math.cos(a) * r, ny = y + Math.sin(a) * r; if (lWalk(nx, ny) && lWalk(nx + 5, ny) && lWalk(nx - 5, ny) && !inPool(nx, ny, 4)) return { x: nx, y: ny }; } return null; }
// Teleport (z. B. Feenring aus Teil A): Chunks am Ziel sofort laden
function lTeleport(x, y) {
  if (!LW || !LW.on) return false;
  P.x = x; P.y = y; P.vx = P.vy = 0; P.leap = null; P.dash = null; lStream(true);
  if (!lWalk(P.x, P.y)) { const p = lFreeNear(P.x, P.y, 240); if (p) { P.x = p.x; P.y = p.y; } }
  LW.lx = P.x; LW.ly = P.y; for (const e of enemies) if (e.lw) lDespawn(e); enemies = enemies.filter(e => !e.dead);
  cam.x = P.x - VW / 2; cam.y = P.y - 10 - VH / 2; lReveal(); return true;
}

/* ---------- Ende: entkommen, gefallen, abgebrochen ---------- */
function lEnd() {
  if (!LW) return; LW.on = false; LBQ.length = 0;
  document.body.classList.remove('lande'); lHudShow(false); $('bAct').hidden = true; $('bossbar').hidden = true; $('objective').textContent = '';
  for (const e of enemies) e.dead = true; enemies = []; pickups = [];
}
function lStripFlags() { for (const s of ['weapon', 'armor', 'helm']) if (P.gear[s]) delete P.gear[s].lw; }
function lBasicGear() { const C = CLASSES[P.cls]; return { weapon: makeItem({ slot: 'weapon', base: C.start, tier: 0, rar: 0, std: true }), armor: makeItem({ slot: 'armor', base: 'armor', tier: 0, rar: 0 }), helm: makeItem({ slot: 'helm', base: 'helm', tier: 0, rar: 0 }) }; }
// Neu laden/abbrechen: Ausrüstung vom Aufbruch zurück, aber nichts doppelt (was in einer Begleiter-Tasche liegt, bleibt dort)
function lRestoreGear(cur) {
  const inBag = new Set(), PM = SAVE.meta.pets; if (PM && Array.isArray(PM.list)) for (const p of PM.list) for (const e of (Array.isArray(p.bag) ? p.bag : [])) if (e && e.t === 'item' && e.it) inBag.add(e.it.uid);
  for (const it of P.bag.concat(SAVE.meta.hide.stash || [])) if (it && it.uid) inBag.add(it.uid);   // per Vogel heimgeschickt (6.2): nicht verdoppeln
  for (const e of lMeta().box) if (e && e.t === 'item' && e.it) inBag.add(e.it.uid);
  const basic = lBasicGear(), g0 = cur.gear0 || {};
  for (const s of ['weapon', 'armor', 'helm']) { const it = P.gear[s]; if (!it || it.lw) { const o = g0[s]; P.gear[s] = o && !inBag.has(o.uid) ? o : basic[s]; } }
  lStripFlags(); computeStats(); P.hp = Math.min(P.hp, P.st.hp);
}
function lAbandon(why) {
  const M = lMeta(), cur = M.cur, lost = LW ? LW.pack.concat(lPouchTakeAll()) : [], pet = LW && LW.pet;
  M.aband++; if (cur) lRestoreGear(cur);
  const r = lDeliver(lPetBagTake(pet)); M.cur = null;
  lEnd(); if (LW) for (const r of LW.cm.values()) lFree(r); LW = null; saveChar(); persist();
  return { lost, r, why };
}
// Beim Laden eines Helden: Ausflug war noch offen (Neu laden, Absturz) → wie Abbruch; mitten im Kampf → wie Tod
HOOK.activate.push(H => {
  try {
    if (!SAVE || !SAVE.meta.lande) return; const M = lMeta();
    let fell = null;
    if (M.cur && M.cur.hero === H.id && !(LW && LW.on)) {
      if (M.cur.fight) {
        fell = M.cur; M.deaths++; P.gear = lBasicGear(); computeStats(); P.hp = P.st.hp; M.cur = null;
        LG.note = _t('Dein letzter Ausflug endete mitten im Kampf – die Lande haben dich verschlungen. Ausrüstung und Rucksack sind verloren.');
      } else { M.aband++; lRestoreGear(M.cur); M.cur = null; LG.note = _t('Dein letzter Ausflug in die Endlosen Lande wurde unterbrochen: Der Rucksack ist verloren, deine Ausrüstung vom Aufbruch hast du noch.'); }
    }
    const p = lPet(); if (p && Array.isArray(p.bag) && p.bag.length && !(LW && LW.on)) { const r = lDeliver(lPetBagTake(p)); if (r.n) LG.note = (LG.note ? LG.note + ' ' : '') + _t('Dein Begleiter hat noch Beute aus den Landen dabei – sie liegt jetzt bei dir.'); }
    if (fell && p && typeof petHurt === 'function') { try { petHurt(p, lHurtMin(fell.d)); } catch (_) { } }
    if (LG.note) { saveChar(); persist(); setTimeout(() => { if (LG.note) { toast(LG.note, '#e8b04a'); LG.note = null; } }, 900); }
  } catch (e) { console.error('Lande (activate):', e); }
});
function lHurtMin(d) { return 45 + Math.round(clamp(+d || 0, 0, 1) * 240); }
function lExtract(ex) {
  const L = LW, M = lMeta(), pouch = lPouchTakeAll(), pack = L.pack.splice(0).concat(pouch), bag = lPetBagTake(L.pet), mis = [];
  let rep = 0;
  for (const m of L.mis) if (m.done && !m.paid) { m.paid = true; rep += m.rep; mis.push(m); for (const e of m.rew) if (e.t !== 'key' && e.t !== 'map') pack.push(e); else if (e.t === 'key') M.keys++; }
  const nR = L.regs.size, nF = lCommit(), all = pack.concat(bag), val = lSum(all), r = lDeliver(all);
  M.rep += rep; M.ext++; const best = val > M.best; if (best) M.best = val;
  if (ex && ex.k === 'beacon' && ex.cp) ex.cp.u = Date.now();
  lStripFlags(); M.cur = null; stat('landeLoot', val); if (mis.length) stat('landeMis', mis.length); stat('landeExt');
  const time = L.t, kills = L.kills;
  lEnd(); computeStats(); P.hp = P.st.hp; saveChar(); persist(); if (typeof checkAch === 'function') checkAch();
  sfx('clear'); setTimeout(() => sfx('loot'), 400);
  setState('menu'); showHud(false);
  const ml = mis.length ? `<h3>${_t('AUFTRÄGE ERFÜLLT')}</h3>${mis.map(m => `<p class="sub" style="margin:2px 0">✦ ${esc(m.txt)} <b style="color:#57c7e6">${_t('+{n} Ruf', { n: m.rep })}</b></p>`).join('')}` : '';
  showOverlay(`<div class="head"><h2 style="color:var(--moss)">${_t('ENTKOMMEN!')}</h2><div class="hbtns"><span class="pill">${esc(ex && ex.k === 'beacon' ? _t('Leuchtfeuer') : ex && ex.t === 'tor' ? _t('Weltentor') : _t('Tor der Alten'))}</span></div></div>
  <p class="sub">${_t('{t} in den Landen · {k} Gegner besiegt', { t: lClock(time), k: kills })}${nF || nR ? ' · <b style="color:var(--gold)">' + _t('Karte gesichert: {n} neue Regionen', { n: nR }) + '</b>' : ''}</p>
  <div class="kv"><span class="pill" style="background:var(--gold)">${_t('BEUTEWERT {n} GOLD', { n: fmt(val) })}</span>${best && val > 0 ? `<span class="pill" style="background:#ff8a3a">${_t('NEUER BESTWERT')}</span>` : ''}${rep ? `<span class="pill" style="background:#57c7e6">${_t('+{n} RUF', { n: rep })}</span>` : ''}</div>
  ${all.length ? `<h3>${_t('IN SICHERHEIT ({n})', { n: all.length })}</h3><div class="lgot">${all.slice().sort((a, b) => lHype(b) - lHype(a)).map((e, i) => `<div style="animation-delay:${Math.min(i, 20) * 80}ms">${landeLootHTML(e)}</div>`).join('')}</div>` : `<p class="sub">${_t('Diesmal mit leeren Händen – aber lebendig.')}</p>`}
  ${lDeliverHTML(r)}${ml}
  <div class="menu foot lfoot"><button class="btn wide" data-act="l_home">${_t('Ins Versteck')}</button><button class="btn alt" data-act="l_tomap">${_t('Zur Karte')}</button><button class="btn alt" data-act="l_again">${_t('Weltentor')}</button></div>`, true);
}
function lDie() {
  P.hp = 0; setState('dead'); deadT = 999; P.atkT = 0; P.spin = 0; P.leap = null; P.dash = null;
  burst(P.x, P.y, 8, '#b8302a', 30, 100); sfx('die'); $('bossbar').hidden = true; slowmo = 1.6; shake(6);
  P.stats.deaths++; stat('deaths'); LW.dead = 2.2; $('objective').textContent = '';
  const M = lMeta(); if (M.cur) { M.cur.fight = 2; persist(); }
}
HOOK.die.push(h => { if (h || !LW || !LW.on) return h; lDie(); return true; });
function lDeathScreen() {
  const L = LW, M = lMeta(), pet = L.pet, gear = ['weapon', 'armor', 'helm'].map(s => P.gear[s]).filter(Boolean), pouch = lPouchTakeAll(), pack = L.pack.splice(0).concat(pouch), saved = lPetBagTake(pet);
  const lost = gear.map(it => ({ t: 'item', it })).concat(pack), lostV = lSum(lost), lostMap = L.regs.size, d = lDepthAt(P.x, P.y);
  M.deaths++; M.cur = null; L.fog = new Map(); L.regs = new Set();   // Erkundetes seit dem letzten Leuchtfeuer ist vergessen
  let hurt = '';
  if (pet && typeof petHurt === 'function') { const min = lHurtMin(d); try { petHurt(pet, min); hurt = _t('{name} ist verletzt und braucht etwa {n} Minuten Ruhe.', { name: esc(lPetName(pet)), n: min }); } catch (_) { } }
  lEnd();   // LW bleibt bis „Im Versteck erwachen“: die Welt bleibt hinter dem Bildschirm sichtbar
  let r = null, body, foot;
  if (P.hc) {
    for (const e of saved) if (e.t === 'item' && SAVE.meta.hide.stash.length < (typeof stashCap === 'function' ? stashCap() : 0)) { delete e.it.lw; SAVE.meta.hide.stash.push(e.it); } else if (e.t !== 'item' && M.box.length < LBOX) M.box.push(e);
    SAVE.meta.fallen.unshift({ name: P.name, cls: P.cls, lv: P.lv, act: P.act, diff: P.diff, date: Date.now(), kills: P.stats.kills });
    SAVE.chars.splice(SAVE.active, 1); SAVE.active = -1; persist();
    body = `<p class="sub">${_t('Hardcore kennt keine Gnade. {name} ist in den Endlosen Landen gefallen und steht nun in der Ruhmeshalle.', { name: esc(P.name) })}</p>${saved.length ? `<p class="sub" style="color:var(--moss)">${_t('Dein Begleiter hat {n} Dinge ins Lager gerettet.', { n: saved.length })}</p>` : ''}`;
    foot = `<div class="menu foot"><button class="btn" data-act="hcok">${_t('Zum Titel')}</button></div>`;
  } else {
    P.gear = lBasicGear(); r = lDeliver(saved); computeStats(); P.hp = P.st.hp; P.res = P.st.resMax; updWeaponUI(); saveChar(); persist();
    body = `${saved.length ? `<h3 style="color:var(--moss)">${_t('GERETTET VON {name}', { name: esc(lPetName(pet)).toLocaleUpperCase(LOCALE) })}</h3>${saved.map(e => landeLootHTML(e)).join('')}${lDeliverHTML(r)}` : `<p class="sub">${pet ? _t('Die Begleiter-Tasche war leer – nichts wurde gerettet.') : _t('Ohne Begleiter wurde nichts gerettet. Ein Begleiter trägt eine Tasche, die deinen Tod übersteht.')}</p>`}
    ${hurt ? `<p class="sub" style="color:#ff8a5a">${hurt}</p>` : ''}<p class="sub">${lostMap ? _t('Was du seit dem letzten Leuchtfeuer erkundet hast ({n} Regionen), ist vergessen.', { n: lostMap }) + ' ' : ''}${_t('Du erwachst im Versteck – mit einfacher Ausrüstung. Schmiede neue oder hol sie dir aus Beutel und Lager.')}</p>`;
    foot = `<div class="menu foot"><button class="btn" data-act="l_wake">${_t('Im Versteck erwachen')}</button></div>`;
  }
  setState('over'); showHud(false);
  showOverlay(`<div class="over"><h2 class="center">${_t('GEFALLEN IN DEN ENDLOSEN LANDEN')}</h2>
  <h3 style="color:var(--blood)">${_t('VERLOREN · {n} GOLD WERT', { n: fmt(lostV) })}</h3><div class="grid llost">${lost.map(e => lSlot(e, '', false, true)).join('') || `<p class="sub">${_t('Nichts.')}</p>`}</div>${body}</div>${foot}`, true);
}

/* ---------- Gegner der Freiwelt ---------- */
function lSpawn(type, x, y, o) {
  o = o || {}; const st = o.st || lStage(x, y), bk = lBioAt(x, y), B = LANDE_BIOMES[bk];
  if (!lWalk(x, y)) { const p = lFreeNear(x, y, 90); if (p) { x = p.x; y = p.y; } }
  lSetStage(st);
  const oo = Object.assign({ x, y, instant: o.instant !== false }, o); if (B.et && !o.tint && !o.boss && !o.champ && Math.random() < .7) oo.tint = B.et;
  let e; LW.own = true; try { e = spawnEnemy(type, oo); } finally { LW.own = false; }
  // Kampagnen-Qual raus, Tiefen-Qual rein (gleiche Formel wie die Qual der Kampagne)
  const q0 = Math.pow(1.3, qualOf(P.act)), qd = lQualOf(st), mh = Math.pow(1.3, qd) / q0, ma = Math.pow(1.3, qd * .8) / Math.pow(q0, .8);
  if (mh !== 1) { e.hp = e.maxHp = Math.max(1, Math.round(e.maxHp * mh)); e.atk *= ma; if (e.armorMax) { e.armorMax *= mh; e.armor = e.armorMax; } }
  for (const a of [].concat(B.ea || [])) if (!e.affixes.includes(a) && (e.elite || Math.random() < .35)) lAffix(e, a);
  // tief draußen (ab ~30 % Tiefe): ein zufälliges Affix mehr – am Rand bei fast der Hälfte der Gegner
  const dep = lDepthAt(x, y); if (dep > .3 && !o.boss && Math.random() < Math.min(.45, (dep - .3) * .65)) { const k = Object.keys(AFFIX).filter(a => !e.affixes.includes(a)); if (k.length) lAffix(e, pick(k)); }
  e.lw = { src: o.src || null, rec: o.rec || null }; e.lpx = e.x; e.lpy = e.y;
  lSetStage(lStage(P.x, P.y));
  return e;
}
// Gegner, die nicht über lSpawn kommen (Bosse aus B, Wächter und Begegnungen aus A, Diener der Bosse, Mimiks, Beschworenes, Schleim-Teilung),
// bekommen in der Freiwelt dieselbe Tiefen-Qual – „Stufe“ heißt überall dasselbe: Stufe 240 am Weltrand trägt 26 Qual-Stufen in sich.
// Bosse aus B (bossPower) und Gegner aus A (aSpawn) rechnen die Kampagnen-Qual schon selbst heraus, bei allen anderen geschieht das hier.
HOOK.spawn.push(e => {
  if (!lOn() || LW.own || !e || e.bPractice) return;
  const fromA = (typeof ATAG !== 'undefined' && ATAG && ATAG.v) || e.arteGuard != null || e.arteGrp, fromB = e.bossId != null || e.bz;
  const q0 = fromA || fromB ? 1 : Math.pow(1.3, qualOf(P.act)), qd = lQualOf(e.bStage || lStage(e.x, e.y)), mh = Math.pow(1.3, qd) / q0, ma = Math.pow(1.3, qd * .8) / Math.pow(q0, .8);
  if (mh === 1) return;
  e.hp = e.maxHp = Math.max(1, Math.round(e.maxHp * mh)); e.atk *= ma; if (e.armorMax) { e.armorMax *= mh; e.armor = e.armorMax; }
});
// Affix nachträglich (Biom, Tiefe): wie in spawnEnemy auch die Werte (schnell, Riese, gepanzert)
function lAffix(e, a) { e.affixes.push(a); if (a === 'schnell') { e.spd *= 1.6; e.cdMul = .7; } else if (a === 'riese') { e.sc *= 1.3; e.hp = e.maxHp = Math.round(e.maxHp * 1.6); e.mass *= 2; } else if (a === 'gepanzert' && !e.armorMax) e.armorMax = e.armor = e.maxHp * .6; }
function lSpawnGroup(src, list, x, y, rad) {
  list.forEach((r, i) => { const a = i / list.length * 6.283 + Math.random() * .5, d = rad * (.5 + Math.random() * .5); lSpawn(r.t, x + Math.cos(a) * d, y + Math.sin(a) * d * .7, { elite: r.el, src, rec: r }); });
  src.alive = (src.alive || 0) + list.length;
}
function lDespawn(e) {
  e.dead = true; const s = e.lw && e.lw.src;
  if (s) {
    s.alive = Math.max(0, (s.alive || 0) - 1); const back = s.left || s.list; if (e.lw.rec && back) back.push(e.lw.rec);
    if (s.B) { s.hp = clamp(e.hp / e.maxHp, .05, 1); s.state = 'roam'; s.x = e.x; s.y = e.y; $('bossbar').hidden = true; lMusic(); }
    if (s.rival) { s.hp = clamp(e.hp / e.maxHp, .05, 1); s.state = 'roam'; s.x = e.x; s.y = e.y; }
    if (s.left && s.state === 'act' && !s.alive) s.state = 'dorm';
    if (s.list && s.state === 'act' && !s.alive) { s.state = 'dorm'; s.x = e.x; s.y = e.y; }
    if ((s.k === 'lair' || s.k === 'tool' || s.k === 'end') && s.act && !s.alive) { s.act = false; if ((s.k === 'tool' || s.k === 'end') && s.state === 'fight') s.state = 'idle'; $('bossbar').hidden = true; lMusic(); }
  }
  fxAnim('ring', e.x, e.y - 6, { sc: .5, dur: .4, add: true });
}
// Bosse aus Teil B (bossForLair/bossSpawn) an einem Hort oder Werkzeug-Hort
function lBossAt(o, key, extra) {
  if (typeof bossForLair !== 'function' || typeof bossSpawn !== 'function') return null;
  const cx = Math.floor((o.x - LOFF) / LCK), cy = Math.floor((o.y - LOFF) / LCK), c = lCtxOf(cx, cy, key), n0 = enemies.length;
  try {
    lSetStage(c.stage); const id = bossForLair(key, c); if (id == null || id < 0) return null;
    let e = bossSpawn(id, o.x, o.y - 34, Object.assign({ lair: key, ctx: c, stage: c.stage, depth: c.depth }, extra || {}));
    if (!e || typeof e !== 'object') e = enemies.slice(n0).find(x => x.boss) || enemies[enemies.length - 1] || null;
    if (e) { e.lw = { src: o, rec: null }; e.lpx = e.x; e.lpy = e.y; o.alive = (o.alive || 0) + 1; o.bossId = id; }
    return e;
  } catch (err) { console.error('Lande (bossSpawn):', err); return null; } finally { lSetStage(lStage(P.x, P.y)); }
}

/* ---------- Beute fallen lassen ---------- */
function lCoins(x, y, n) { const k = Math.min(10, Math.max(1, Math.ceil(n / 6))); let g = n; for (let i = 0; i < k; i++) { const v = i === k - 1 ? g : Math.floor(n / k); g -= v; if (v > 0) pickups.push({ k: 'coin', x, y, z: 6, vz: rnd(70, 140), vx: rnd(-55, 55), vy: rnd(-32, 32), v, t: 0 }); } }
function lDrop(x, y, e, sp) {
  const v = sp || 1, b = () => ({ x, y, z: 8, vz: rnd(90, 150) * v, vx: rnd(-55, 55) * v, vy: rnd(-32, 32) * v, t: 0, lx: x, ly: y });
  switch (e.t) {
    case 'item': pickups.push(Object.assign(b(), { k: 'loot', it: e.it })); break;
    case 'mat': pickups.push(Object.assign(b(), { k: 'mat', m: e.k, n: e.n })); break;
    case 'gem': for (let i = 0; i < (e.n || 1); i++) pickups.push(Object.assign(b(), { k: 'gem', g: e.k })); break;
    case 'part': pickups.push(Object.assign(b(), { k: 'lpart', pk: e.k, n: e.n || 1 })); break;
    case 'egg': pickups.push(Object.assign(b(), { k: 'legg', d: e.d })); break;
    case 'gold': lCoins(x, y, e.n); break;
    case 'mod': pickups.push(Object.assign(b(), { k: typeof modDrop === 'function' ? 'mod' : 'lmod', mk: e.k, n: e.n || 1 })); break;   // mit js/mods.js: dessen Bodenbeute (gezeichnet von dort, eingesammelt über landePackAdd)
    case 'key': pickups.push(Object.assign(b(), { k: 'lkey' })); break;
    case 'map': pickups.push(Object.assign(b(), { k: 'lmap' })); break;
    case 'stone': pickups.push(Object.assign(b(), { k: 'lstone' })); break;
    case 'bird': pickups.push(Object.assign(b(), { k: 'lbird', bk: e.k })); break;   // eingesammelt und gezeichnet in js/voegel.js
  }
}
function lRollSpot(o) {
  const C = LCH[o.t], st = o.st || lStage(o.x, o.y), out = [], lm = C.luck * (1 + (o.z || 0) * .5), dep = lDepthAt(o.x, o.y);
  for (let i = 0, n = ri(C.it[0], C.it[1]); i < n; i++) out.push({ t: 'item', it: lItem(C.min, lm, st) });
  out.push({ t: 'gold', n: Math.round(rnd(C.gold[0], C.gold[1]) * (1 + Math.min(st, 120) * .45)) });
  if (Math.random() < C.mats) out.push({ t: 'mat', k: lMatPick(st), n: ri(2, 4) });
  if (Math.random() < C.gem * gemMul()) out.push({ t: 'gem', k: randomGem(st + 4), n: 1 });
  if (Math.random() < C.part) { const k = lPart(st, .1 * lm); if (k) out.push({ t: 'part', k, n: 1 }); }
  if (Math.random() < C.egg * (1 + dep * 8)) { const d = lEgg(1 + dep * 6 + (o.z || 0), lBioAt(o.x, o.y), dep); if (d) out.push({ t: 'egg', d }); }
  if (C.mod && Math.random() < C.mod * (1 + dep * 4)) { const m = lMod(dep, lm); if (m) out.push(m); }
  if (C.key && Math.random() < C.key) out.push({ t: 'key' });
  if (C.map && Math.random() < C.map) out.push({ t: 'map' });
  if (C.stone && Math.random() < C.stone * (1 + dep * 3)) out.push({ t: 'stone' });
  const bc = { holz: .02, eisen: .04, gold: .08, fluch: .08, schloss: .12, rest: .05, versteck: .06 }[o.t] || 0;   // Magische Vögel (js/voegel.js)
  if (bc && typeof birdRoll === 'function' && Math.random() < bc * (1 + dep * 2)) out.push({ t: 'bird', k: birdRoll(dep) });
  return out;
}
function lBurst(o, list) { list.forEach((e, i) => setTimeout(() => { if (LW && LW.on) lDrop(o.x, o.y - 4, e, 1 + i * .06); }, 120 + i * 90)); }

/* ---------- Meldungen ---------- */
// Banner nacheinander zeigen (zwei Meldungen im selben Moment überdecken sich sonst)
const LBQ = []; let LBT = -9;
function lBanner(t, s) { if (T - LBT < 2.1 && T >= LBT) { if (LBQ.length < 4) LBQ.push([t, s]); return; } LBT = T; banner(t, s); }
// Tipps für Neulinge: jeder nur einmal pro Konto
function lTip(bit, s) { const M = lMeta(); if (M.tips & bit) return; M.tips |= bit; persist(); setTimeout(() => { if (LW && LW.on) toast(s, '#9ad8ee'); }, 600); }
function lMsg(k, s, col, gap) { if (T - (LW.msgT[k] || -99) < (gap || 3)) return; LW.msgT[k] = T; toast(s, col); }
function lMusic() { if (!LW) return; const B = LANDE_BIOMES[(LW.reg && LW.reg.biome) || 'wiese']; setMusic(B.mus - (lNight(LW.t) > .5 ? 2 : 0), false); }

/* ---------- Fundstellen öffnen ---------- */
function lOpenSpot(o) {
  if (o.open) return;
  const C = LCH[o.t];
  if (o.t === 'kraut') {
    o.open = 1; if (o.sk) lTSet(o.sk, 1); sfx('heal'); const h = Math.round(P.st.hp * .2); P.hp = Math.min(P.st.hp, P.hp + h); txt(P.x, P.y - 24, '+' + h, '#79c24e', true);
    if (P.potions < potMax() && Math.random() < .6) { P.potions++; toast(_t('Kräuter gesammelt: +1 Heiltrank'), '#79c24e'); } else toast(_t('Kräuter gesammelt: +{n} LP', { n: h }), '#79c24e');
    if (Math.random() < .35) lDrop(o.x, o.y, { t: 'mat', k: Math.random() < .5 ? 'schleim' : 'kristall', n: 1 });
    gatherKraut(o);   // Samen und Fasern (js/bauen.js)
    for (let i = 0; i < 14; i++) part(o.x + rnd(-6, 6), o.y, rnd(0, 8), rnd(-20, 20), rnd(-10, 10), rnd(20, 50), pick(['#79c24e', '#c8f06a', '#f786a0']), rnd(.4, .8), 1, -20, 1);
    return;
  }
  if (C.lock) { const M = lMeta(); if (M.keys <= 0) { lMsg('lock', _t('Verschlossen – du brauchst einen Schlüssel. Elite-Gegner, Lager und Gefallene tragen welche.'), '#ff8a5a', 4); return; } M.keys--; toast(_t('Schlüssel benutzt (noch {n})', { n: M.keys }), '#e8b04a'); }
  o.open = .001; if (o.sk) lTSet(o.sk, 1); LW.chests++; lMisEvent('chest');
  const list = o.loot || lRollSpot(o);
  if (o.t === 'gold' || o.t === 'schloss') { flash = { a: .25, c: '255,220,120' }; rings.push({ x: o.x, y: o.y, r: 4, max: 46, life: .5, max2: .5, col: '#ffd24a' }); }
  sfx('chest'); burst(o.x, o.y, 10, o.t === 'fluch' ? '#b060ff' : '#ffd24a', 18, 70, 1);
  if (C.trap) {
    if (Math.random() < .55) { lBanner(_t('DER FLUCH ERWACHT'), _t('Wächter steigen aus der Truhe!')); const st = lStage(o.x, o.y), pool = lPool(lBioAt(o.x, o.y), st); for (let i = 0; i < 2 + Math.min(3, Math.floor(lDepthAt(o.x, o.y) * 30) + 1); i++) { const a = i * 2.1; lSpawn(pick(pool), o.x + Math.cos(a) * 34, o.y + Math.sin(a) * 22, { elite: i === 0, instant: false }); } sfx('spec'); shake(5); }
    else { toast(_t('Eine Falle! Weg von der Truhe!'), '#ff6a5a'); fx.push({ k: 'warn', x: o.x, y: o.y, r: 38, life: .9, max: .9 }); setTimeout(() => { if (LW && LW.on && state === 'play') explode(o.x, o.y, 38, 10 + Math.min(lStage(o.x, o.y), 120) * 4 * Math.pow(1.3, lQualOf(lStage(o.x, o.y)) * .8), 'e'); }, 900); }
  }
  lBurst(o, list);
  if (o.t === 'rest' && o.relic) { pickups.push({ k: 'lrel', x: o.x, y: o.y, z: 8, vz: 140, vx: 0, vy: 10, t: 0, lx: o.x, ly: o.y }); }
}

/* ---------- Einsammeln (über HOOK.collect in js/combat.js) ---------- */
// vorn eingehängt: in der Freiwelt landet alles erst im Rucksack (auch Mods), Herzen und Tränke wie immer
HOOK.collect.unshift((h, c) => {
  if (h || !LW || !LW.on) return h;
  let e = null;
  switch (c.k) {
    case 'coin': e = { t: 'gold', n: c.v }; break;
    case 'mat': e = { t: 'mat', k: c.m, n: c.n }; break;
    case 'gem': e = { t: 'gem', k: c.g, n: 1 }; break;
    case 'loot': {
      const r = typeof lootRule === 'function' ? lootRule(c.it, true) : 'take';   // Beute-Filter: liegen lassen und wegwerfen gelten auch hier
      if (r === 'leave') { if (!c.lt) { c.lt = 1; txt(c.x, c.y - 14, _t('liegen gelassen'), '#a8997e'); } return true; }
      if (r === 'trash') { c.got = true; stat('autoTrash'); dust(c.x, c.y, 5); txt(c.x, c.y - 14, _t('weggeworfen'), '#a8997e'); return true; }
      e = { t: 'item', it: c.it }; break;
    }
    case 'lpart': e = { t: 'part', k: c.pk, n: c.n || 1 }; break;
    case 'legg': e = { t: 'egg', d: c.d }; break;
    case 'lmod': e = { t: 'mod', k: c.mk, n: c.n || 1 }; break;
    case 'lkey': { const M = lMeta(); M.keys++; c.got = true; sfx('loot'); toast(_t('Schlüssel gefunden! ({n})', { n: M.keys }), '#e8b04a'); persist(); return true; }
    case 'lstone': { const M = lMeta(); M.stones = Math.min(99, M.stones + 1); c.got = true; sfx('myth'); lBanner(_t('LEUCHTFEUERSTEIN!'), _t('Damit setzt du ein Leuchtfeuer: Karte sichern, neuer Startpunkt, Ausgang. ({n})', { n: M.stones })); persist(); return true; }
    case 'lmap': c.got = true; lMapPiece(); return true;
    case 'lrel': c.got = true; LW.relic = true; sfx('ach'); lBanner(_t('ERBSTÜCK GEFUNDEN'), _t('Bring es heil zurück – zu einer Kundschafterin oder durch einen Ausgang.')); lMisEvent('relic'); return true;
    default: return false;
  }
  if (!lPackAdd(e)) { lMsg('full', _t('Rucksack voll! Wirf etwas weg, leg es in die Begleiter-Tasche oder schick einen Vogel heim.'), '#ff6a5a', 2.5); c.t = -.6; return true; }
  c.got = true; lGot(e); return true;
});
function lGot(e) {
  const hp = $(lStack(e) ? 'lhPo' : 'lhPack'); if (hp) { hp.classList.remove('pop'); void hp.offsetWidth; hp.classList.add('pop'); }
  if (e.t === 'gold') { sfx('coin'); return; }
  lTip(1, _t('Tipp: Alles im Rucksack ist verloren, wenn du fällst. Wertvolles in die Begleiter-Tasche legen – Rucksack-Knopf oben rechts.'));
  if (e.t === 'item') {
    const it = e.it; it.lw = LW.id; hook('pickup', it);
    if (it.rar === 4) stat('legs'); if (it.rar === 6) statMax('myths', 1);
    sfx(it.rar === 6 ? 'myth' : it.rar >= 3 ? 'loot' : 'coin');
    if (it.rar >= 4) { lBanner(it.rar === 6 ? _t('MYTHISCH!') : it.rar === 5 ? _t('SET-TEIL!') : _t('LEGENDÄR!'), itemName(it)); flash = { a: .3, c: it.rar === 6 ? '255,80,220' : '255,160,60' }; rings.push({ x: P.x, y: P.y, r: 4, max: 60, life: .6, max2: .6, col: RAR[it.rar].c }); }
    toast(_t('{rar}: {item} → Rucksack', { rar: RAR[it.rar].n.toLocaleUpperCase(LOCALE), item: itemName(it) }), RAR[it.rar].c);
    for (let i = 0; i < 18; i++) part(P.x, P.y, rnd(0, 16), rnd(-30, 30), rnd(-15, 15), rnd(30, 80), RAR[it.rar].c, rnd(.4, .8), 1, 80, 1);
    return;
  }
  if (e.t === 'mat') { txt(P.x, P.y - 22, '+' + e.n + ' ' + MATS[e.k].n, MATS[e.k].c); sfx('coin'); return; }
  if (e.t === 'egg') { lBanner(_t('BEGLEITER-EI!'), lName(e)); sfx('myth'); return; }
  txt(P.x, P.y - 22, '+ ' + lName(e), lCol(e)); sfx('loot');
}
// Kartenstück: deckt die Gegend um einen unbekannten Ort in der Nähe auf (Tor, Außenposten, Werkzeug-Hort)
function lMapPiece() {
  const wx = (P.x - LOFF) / LCK, wy = (P.y - LOFF) / LCK, cand = [];
  for (let gy = Math.floor(wy / LXG) - 1; gy <= Math.floor(wy / LXG) + 1; gy++) for (let gx = Math.floor(wx / LXG) - 1; gx <= Math.floor(wx / LXG) + 1; gx++) { const e = lExitCell(gx, gy); if (e) cand.push(e); }
  for (const s of lToolSitesNear(wx, wy, 40)) cand.push(s);
  const unk = cand.filter(c => !lKnownW(c.x * LCK, c.y * LCK)).sort((a, b) => Math.hypot(a.x - wx, a.y - wy) - Math.hypot(b.x - wx, b.y - wy));
  const t = unk[0] || { x: wx + rnd(-20, 20), y: wy + rnd(-20, 20) };
  lRevealW(t.x * LCK, t.y * LCK, 3);
  sfx('page'); toast(_t('Kartenstück! Ein Teil der Karte ist aufgedeckt – sieh auf die Karte.'), '#e8dcc0');
}
/* ---------- Erkunden ---------- */
function lRevealW(wx, wy, rad) { const L = LW, fx = Math.floor(wx / LFLD), fy = Math.floor(wy / LFLD); for (let j = -rad; j <= rad; j++) for (let i = -rad; i <= rad; i++) if (i * i + j * j <= rad * rad + 1 && !lFHas(lMap(), fx + i, fy + j)) lFSet(L.fog, fx + i, fy + j); }
function lReveal() { lRevealW(P.x - LOFF, P.y - LOFF, 1); }

/* ---------- Aufträge der Kundschafterinnen (verweisen auf feste Orte in der Nähe) ---------- */
// Feste Orte im Umkreis eines Außenpostens: Wahrzeichen/Ruinen als Ziel für Benannte und Erbstücke, fremde Regionen zum Erkunden
function lNearSites(wx, wy) {
  const cx = wx / LCK, cy = wy / LCK, out = [], regs = [];
  for (let j = -2; j <= 2; j++) for (let i = -2; i <= 2; i++) {
    const R = lCell(Math.floor(cx / LRC) + i, Math.floor(cy / LRC) + j), d = Math.hypot(R.sx - cx, R.sy - cy); if (d < 2 || d > 14 || R.dist < 5) continue;
    regs.push({ R, d }); const h = lF(R.rx, R.ry, 81); if (h >= .3) out.push({ R, d, mark: h < .72 });
  }
  return { sites: out.sort((a, b) => a.d - b.d), regs: regs.sort((a, b) => a.d - b.d) };
}
function lMisGen(npc) {
  const L = LW, wx = npc.x - LOFF, wy = npc.y - LOFF, st = lRegAt(npc.x, npc.y).stage, f = 1 + Math.min(st, 120) * .04, out = [], used = new Set(), ns = lNearSites(wx, wy);
  const reach = s => { for (let ring = s.R.ring; ring > lRegAt(npc.x, npc.y).ring; ring--) if (!lToolBit(ring - 1)) return false; return true; };
  const sites = ns.sites.filter(reach), regs = ns.regs.filter(r => reach(r) && !lRegs().has(r.R.id) && !L.regs.has(r.R.id));
  const types = ['kills', 'chests', 'camps', 'named', 'relic', 'explore', 'night', 'mats', 'boss'].filter(t => (t !== 'named' && t !== 'relic' || sites.length) && (t !== 'explore' || regs.length));
  const want = 3 + lPerk('mis');
  while (out.length < want && used.size < types.length) {
    const t = pick(types); if (used.has(t)) continue; used.add(t);
    const m = { t, c: 0, n: 1, done: false, paid: false, rep: 0, rew: [], tgt: null, site: null };
    switch (t) {
      case 'kills': m.n = 20 + Math.min(20, Math.floor(st / 6)) + ri(0, 10); m.txt = _t('Besiege {n} Gegner', { n: m.n }); m.rep = 25; break;
      case 'chests': m.n = ri(4, 6); m.txt = _t('Öffne {n} Truhen oder Fundstellen', { n: m.n }); m.rep = 25; break;
      case 'camps': m.n = ri(2, 3); m.txt = _t('Säubere {n} Lager der Monster', { n: m.n }); m.rep = 35; break;
      case 'named': case 'relic': {
        const s = sites[ri(0, Math.min(2, sites.length - 1))], cx = Math.floor(s.R.sx), cy = Math.floor(s.R.sy), nm = pick(LNAMED);
        m.site = { cx, cy, x: s.R.sx * LCK, y: s.R.sy * LCK, nm }; m.where = lRegName(s.R);
        if (t === 'named') { m.txt = _t('Erlege {name} in {region}', { name: nm, region: m.where }); m.rep = 50; } else { m.txt = _t('Finde das Erbstück in {region}', { region: m.where }); m.rep = 45; }
        break;
      }
      case 'explore': { const r = regs[0]; m.reg = r.R.id; m.site = null; m.tx = r.R.sx * LCK; m.ty = r.R.sy * LCK; m.txt = _t('Erkunde {region}', { region: lRegName(r.R) }); m.rep = 40; break; }
      case 'night': m.txt = _t('Überstehe eine Nacht in den Landen'); m.rep = 45; break;
      case 'boss': m.txt = _t('Bezwinge das Ungeheuer der Nacht'); m.rep = 80; break;
      case 'mats': { const k = lMatPick(st), n = ri(3, 6); m.k = k; m.n = n; m.txt = _t('Bring {n} {mat}', { n, mat: MATS[k].n }); m.rep = 30; break; }
    }
    m.rep = Math.round(m.rep * f);
    m.rew.push({ t: 'item', it: lItem(t === 'boss' || t === 'named' ? 3 : 2, 1.6, st + 3) });
    m.rew.push({ t: 'gold', n: Math.round((40 + Math.min(st, 150) * 12) * f) });
    if (t === 'boss' || t === 'night') { const d = lEgg(2 + lDepthAt(npc.x, npc.y) * 8); if (d) m.rew.push({ t: 'egg', d }); }
    if (Math.random() < .4) m.rew.push({ t: 'gem', k: randomGem(st + 8), n: 1 });
    if (t === 'named' || t === 'relic') m.rew.push({ t: 'key' });
    out.push(m);
  }
  // Orte, die schon geladen sind, gleich bestücken
  for (const m of out) if (m.site) { const r = L.cm.get(lCK(m.site.cx, m.site.cy)); if (r) lMisSite(r, m); }
  return out;
}
function lMisSite(rec, m) {
  if (m.placed) return; m.placed = true;
  const x0 = clamp(m.site.x + LOFF, rec.X0 + 100, rec.X0 + LCK - 100), y0 = clamp(m.site.y + LOFF + 70, rec.Y0 + 100, rec.Y0 + LCK - 100), p = lFreeNearRec(rec, x0, y0) || { x: x0, y: y0 };
  if (m.t === 'named') {
    const st = rec.d.R.stage + 4, bk = rec.d.R.biome, pool = lPool(bk, st);
    const c = { k: 'camp', x: p.x, y: p.y, r: 5, solid: true, z: 1, st, bk, left: [{ t: pick(pool.filter(k => EN[k].cost >= 2).concat(['orc'])), el: true, champ: m.site.nm }].concat(lWave(bk, st, 4, 4).map(k => ({ t: k, el: false }))), alive: 0, state: 'dorm', fire: true, named: m.site.nm, mis: m };
    m.tgt = c; lRecAdd(rec, c);
  } else { const o = { k: 'spot', t: 'rest', x: p.x, y: p.y, r: 0, solid: false, z: 1, st: rec.d.R.stage + 4, open: 0, relic: true }; m.tgt = o; lRecAdd(rec, o); }
}
function lFreeNearRec(rec, x, y) { void rec; return lFreeNear(x, y, 140); }
function lMisEvent(k, obj) {
  if (!LW || !LW.misOn) return;
  for (const m of LW.mis) {
    if (m.done) continue;
    if (k === 'kill' && m.t === 'kills') m.c++;
    if (k === 'chest' && m.t === 'chests') m.c++;
    if (k === 'camp' && m.t === 'camps') m.c++;
    if (k === 'camp' && m.t === 'named' && m.tgt === obj) m.c = 1;
    if (k === 'boss' && m.t === 'boss') m.c = 1;
    if (k === 'relic' && m.t === 'relic') m.c = 1;
    if (k === 'region' && m.t === 'explore' && obj === m.reg) m.c = 1;
    if (k === 'dawn' && m.t === 'night') m.c = 1;
    if (m.t !== 'mats' && m.c >= m.n) { m.done = true; sfx('ach'); lBanner(_t('AUFTRAG ERFÜLLT'), m.txt); toast(_t('Belohnung bei einer Kundschafterin abholen – oder sie kommt beim Ausgang mit.'), '#57c7e6'); }
  }
}
function lMisCheckMats() { for (const m of LW.mis) if (m.t === 'mats' && !m.paid) { m.c = Math.min(m.n, lPackHas('mat', m.k)); m.done = m.c >= m.n; } }

/* ---------- Laufzeit ---------- */
// Objekte in der Nähe (gemeinsames Feld, keine neuen Arrays je Bild – nicht verschachtelt benutzen)
const LNO = [];
function lNear(x, y, rad) {
  LNO.length = 0; const L = LW; if (!L) return LNO;
  const gx0 = Math.floor((x - rad) / LGC), gx1 = Math.floor((x + rad) / LGC), gy0 = Math.floor((y - rad) / LGC), gy1 = Math.floor((y + rad) / LGC);
  let last = null, lk = -1;
  for (let gy = gy0; gy <= gy1; gy++) for (let gx = gx0; gx <= gx1; gx++) {
    const cx = Math.floor(gx / LGN) - LOC, cy = Math.floor(gy / LGN) - LOC, k = lCK(cx, cy);
    if (k !== lk) { lk = k; last = L.cm.get(k) || null; } if (!last) continue;
    const c = last.grid[(gy - (cy + LOC) * LGN) * LGN + gx - (cx + LOC) * LGN]; if (c) for (let i = 0; i < c.length; i++) LNO.push(c[i]);
  }
  return LNO;
}
function lPush(e, r) {
  const L = lNear(e.x, e.y, 48);
  for (let i = 0; i < L.length; i++) { const o = L[i]; if (!o.solid) continue; const dx = e.x - o.x, dy = (e.y - o.y) * 1.35, m = o.r + r; if (Math.abs(dx) > m || Math.abs(dy) > m) continue; const d = Math.hypot(dx, dy) || .01; if (d < m) { e.x = o.x + dx / d * m; e.y = o.y + dy / d * m / 1.35; } }
}
// Der Held hat einen Körper: Mitte und vier Punkte am Rand müssen frei sein
function lWalkP(x, y) { return lWalk(x, y) && lWalk(x + 4, y) && lWalk(x - 4, y) && lWalk(x, y + 3) && lWalk(x, y - 3); }
// Gegen eine Barriere gelaufen: was ist das, was fehlt, wo ist der nächste Übergang?
function lBlocked(x, y) {
  const L = LW, r = lRecAt(x, y); if (!r) return; const i = lTileI(r, x, y); let bk = r.d.bar[i] - 1, nd = r.d.nd[i] - 1, v = r.wk[i];
  if (bk < 0) { for (const [dx, dy] of [[4, 0], [-4, 0], [0, 3], [0, -3]]) { const r2 = lRecAt(x + dx, y + dy); if (!r2) continue; const j = lTileI(r2, x + dx, y + dy); if (r2.d.bar[j]) { bk = r2.d.bar[j] - 1; nd = r2.d.nd[j] - 1; v = r2.wk[j]; break; } } }
  if (bk < 0) return; const B = LBAR[LBARK[bk]];
  if (B.key === 'rand') { lMsg('rand', _t('Hier endet die Welt. Dahinter ist nur noch das Nichts.'), '#c8c0d8', 6); statMax('landeEdge', 1); return; }
  const T_ = nd >= 0 ? LANDE_TOOLS[nd] : null;
  if (v === 2 && T_) lMsg('bx' + bk, _t('Übergang über {bar} – Du brauchst: {tool}', { bar: B.n, tool: T_.n }), '#ff8a5a', 3.5);
  else if (T_) lMsg('bb' + bk, _t('{bar}! Du brauchst: {tool} – und einen Übergang (auf der Karte markiert).', { bar: B.n, tool: T_.n }), '#ff8a5a', 3.5);
  else lMsg('bl' + bk, _t('{bar} – hier geht es nicht weiter. Such die Brücke!', { bar: B.n }), '#e8b04a', 3.5);
  if (!L.hint || T > L.hint.until - 9) {
    const wx = (P.x - LOFF) / LCK, wy = (P.y - LOFF) / LCK; let best = null, bd = 1e9;
    for (const c of lCrossNear(wx, wy, 26, T_ ? nd : null)) { if (T_ ? c.need !== nd : c.need >= 0) continue; const d = Math.hypot(c.px - wx, c.py - wy); if (d < bd) { bd = d; best = c; } }
    L.hint = best ? { x: best.px * LCK + LOFF, y: best.py * LCK + LOFF, need: nd, until: T + 12 } : null;
    if (best && T_ && !lToolBit(nd)) lTip(16, _t('Tipp: Der lila Pfeil zeigt zum nächsten Übergang. Das Werkzeug dafür liegt in einem Hort diesseits der Barriere – sieh auf die Karte.'));
  }
}
// Jede Bildzeit: Chunks nachladen, Barrieren, Kollision mit Bäumen und Felsen, Geschosse daran zerschellen lassen
HOOK.update.push(dt => {
  if (!LW || !LW.on || !G || G.type !== 'lande') return;
  const L = LW;
  lStream();
  if (state === 'play' && !lWalkP(P.x, P.y)) { const nx = P.x, ny = P.y; if (lWalkP(nx, L.ly)) P.y = L.ly; else if (lWalkP(L.lx, ny)) P.x = L.lx; else { P.x = L.lx; P.y = L.ly; } if (P.dash) P.dash.t = P.dash.dur; lBlocked(nx, ny); }
  if (state === 'play') { const d = Math.hypot(P.x - L.lx, P.y - L.ly); if (d < 60) L.walk = (L.walk || 0) + d; }
  L.lx = P.x; L.ly = P.y;
  // Pfützen der Tiefe (die vier alten wirken in js/combat.js)
  if (state === 'play' && P.z < 2 && !P.leap) { const pl = inPool(P.x, P.y), F = pl && LPOOLX[pl.k]; if (F) { if (F.slow) P.slowT = Math.max(P.slowT, F.slow); if (F.res) P.res = Math.max(0, P.res - P.st.resMax * F.res * dt); if (F.dmg && P.poolT <= 0 && P.roll <= 0) { P.poolT = .5; hurtPlayer(F.dmg[0] + stageNum() * F.dmg[1], null); } } }
  if (P.z < 4 && !P.leap) lPush(P, P.r);
  for (const e of enemies) {
    if (e.dead) continue;
    if (e.lpx == null) { e.lpx = e.x; e.lpy = e.y; }
    if (Math.hypot(e.x - e.lpx, e.y - e.lpy) > 160) { const p = lFreeNear(P.x + rnd(-110, 110), P.y + rnd(-80, 80), 60) || P; e.x = p.x; e.y = p.y; }   // Teleport über die halbe Welt (placeFar) zurückholen
    if (!lWalk(e.x, e.y)) { if (lWalk(e.x, e.lpy)) e.y = e.lpy; else if (lWalk(e.lpx, e.y)) e.x = e.lpx; else { e.x = e.lpx; e.y = e.lpy; } }
    if (!(e.ai === 'swoop' && e.z > 8) && e.ai !== 'ghost' && !(e.under > 0)) lPush(e, e.r * e.sc);
    e.lpx = e.x; e.lpy = e.y;
    if (e.rival && e.rival.look && e.st !== 'spawn') e.alpha = 0;
  }
  for (const p of projs) { if (p.life <= 0 || p.k === 'meteor' || p.k === 'bomb' || p.k === 'flask') continue; const N = lNear(p.x, p.y, 20); for (let i = 0; i < N.length; i++) { const o = N[i]; if (o.solid && o.k === 'prop' && LPROPR[o.t] >= 4 && p.life > 0 && Math.hypot(o.x - p.x, (o.y - p.y) * 1.35) < o.r + 2) { p.life = 0; if (p.k === 'fireball') projHitEnd(p); burst(p.x, p.y, p.h, '#8a7a6a', 4, 30); if (p.from === 'p') gatherProj(o, p); } } }
  for (const c of pickups) { if (c.z > 1) continue; if (!lWalk(c.x, c.y)) { c.x = c.lx != null ? c.lx : P.x; c.y = c.ly != null ? c.ly : P.y; c.vx = c.vy = 0; } else { c.lx = c.x; c.ly = c.y; } }
  lChannelTick(dt);
  if (state === 'dead' && L.dead) { L.dead -= dt; if (L.dead <= 0) { L.dead = 0; lDeathScreen(); } }
});
// Der Raum der Freiwelt: Zeit, Tag und Nacht, Lager, Bosse, Rivalen, Horte
HOOK.roomUpd.push((h, dt) => {
  if (h || !LW || !LW.on || !G || G.type !== 'lande') return h;
  lTick(dt); return true;
});
function lTick(dt) {
  const L = LW, M = lMeta(); L.t += dt; L.tick -= dt; G.ambT = 999;
  if (LBQ.length && T - LBT >= 2.1) { const [t, s] = LBQ.shift(); LBT = T; banner(t, s); }
  lAmbient(dt);
  if (L.tick > 0) return;
  L.tick = .2;
  // Tag und Nacht
  const ph = lPhase(L.t), nt = lNight(L.t);
  if (ph !== L.danger) { const was = L.danger; L.danger = ph; const D = LDNG[ph]; if (D.b) { lBanner(D.b, D.s); sfx(ph === 3 ? 'heal' : 'spec'); if (ph === 2) shake(3); } if (ph === 2) { L.nights++; L.beastN = true; } if (ph === 3 && was === 2) { lMisEvent('dawn'); M.nights++; } lMusic(); }
  const R = L.reg, B = LANDE_BIOMES[R ? R.biome : 'wiese'], hz = B.haz && !lToolBit(LHAZ[B.haz].tool) ? B.haz : null;
  bg.b.dark = clamp((B.dark || 0) + nt * .44 + (hz === 'dunkel' ? .32 : hz === 'traum' ? .26 : 0) + Math.min(.12, lDepthAt(P.x, P.y) * .4), 0, .82);
  if (M.cur) { const fight = lDanger(); if (!!M.cur.fight !== fight) { M.cur.fight = fight; persist(); } }
  lReveal();
  lSetStage(lStage(P.x, P.y));
  lRegionTick(false);
  lHazardTick(hz);
  const N = lNear(P.x, P.y, 300), near = N.slice();
  // Lager wecken
  for (const c of near) {
    if (c.k !== 'camp' || c.state !== 'dorm' || !c.left.length || enemies.length >= 26) continue;
    if (Math.hypot(c.x - P.x, c.y - P.y) > 300) continue;
    c.state = 'act'; const list = c.left.splice(0);
    list.forEach((r, i) => { const a = i / list.length * 6.283 + Math.random() * .4, dd = 26 + Math.random() * 30; lSpawn(r.t, c.x + Math.cos(a) * dd, c.y + Math.sin(a) * dd * .7, r.champ ? { elite: true, champ: true, name: r.champ, tint: 'rgba(255,110,40,.35)', src: c, rec: r, st: c.st } : { elite: r.el, src: c, rec: r, st: c.st }); });
    c.alive += list.length; if (c.named) { lBanner(c.named.toLocaleUpperCase(LOCALE), _t('Der Gesuchte ist hier!')); sfx('spec'); }
  }
  // Streifen
  for (const p of L.pats) {
    if (p.state !== 'dorm' || !p.list.length) continue;
    const dx = p.tx - p.x, dy = p.ty - p.y, d = Math.hypot(dx, dy);
    if (d < 8) { p.tx = p.x + rnd(-300, 300); p.ty = p.y + rnd(-300, 300); } else { const nx = p.x + dx / d * 3.6, ny = p.y + dy / d * 3.6; if (lWalk(nx, ny)) { p.x = nx; p.y = ny; } else { p.tx = p.x; p.ty = p.y; } }
    if (Math.hypot(p.x - P.x, p.y - P.y) < 260 && enemies.length < 24) { p.state = 'act'; const list = p.list.splice(0); lSpawnGroup(p, list, p.x, p.y, 20); }
  }
  if (L.patsDirty) { L.patsDirty = false; L.pats = L.pats.filter(p => !(p.state !== 'act' && Math.hypot(p.x - P.x, p.y - P.y) > 2600)); }
  // Horte (Bosse aus Teil B), Werkzeug-Horte, Begegnungen, Artefakte, Fundstellen, NPCs
  L.near = null; let nd = 34;
  for (const o of near) {
    const d = Math.hypot(o.x - P.x, (o.y - P.y) * 1.3);
    switch (o.k) {
      case 'spot': if (!o.open && o.t !== 'versteck' && d < 20 + (o.r || 0)) lOpenSpot(o); break;
      case 'npc': if (d < nd) { nd = d; L.near = o; } break;
      case 'lair': if (!o.ts && !o.act && d < 250 && enemies.length < 30) { let ok = true; try { if (typeof bossLairReady === 'function') ok = !!bossLairReady(o.key); } catch (_) { ok = false; } if (ok && lBossAt(o, o.key)) { o.act = true; sfx('boom'); shake(6); lMsg('lair', _t('Ein Hort! Sein Wächter erwacht.'), '#ff6a5a', 8); } } break;
      case 'tool': lToolTick(o, d); break;
      case 'end': lEndTick(o, d); break;
      case 'rune': if (o.site.state !== 'open' && o.site.state !== 'done' && !o.on && d < 12) lRune(o); break;
      case 'enc': if (d < 34 && !o.used) lEncounter(o); break;
      case 'arte': case 'arteT': lArteTick(o, d); break;
      case 'mile': if (d < 40 && !L.msgT['mile' + o.km]) { L.msgT['mile' + o.km] = T; toast(lNb(_t('Meilenstein: {n} km vom Weltentor', { n: o.km })), '#efe2bf'); } break;
      case 'cross': if (d < 30 && o.need >= 0 && lToolBit(o.need) && !L.cross.has(o)) { L.cross.add(o); const T_ = LANDE_TOOLS[o.need]; toast(_t('Mit {tool} über {bar}!', { tool: T_.n, bar: LBAR[LBARK[o.kind]].n }), T_.c); lMeta().cross++; } break;
    }
  }
  // Ungeheuer der Nacht, Jäger, Rivalen
  lBeastTick(nt);
  for (const r of L.rivals) lRivalTick(r);
  L.rivals = L.rivals.filter(r => r.state !== 'gone');
  if ((L.rivT -= .2) <= 0) { L.rivT = 300 + Math.random() * 240; if (!L.rivals.some(r => r.state === 'roam') && lDepthAt(P.x, P.y) > .002) lRivalSpawn(); }
  // Leine: wer zu weit weg ist, geht zurück ins Lager
  for (const e of enemies) { if (e.dead) continue; const d = Math.hypot(e.x - P.x, e.y - P.y); if (e.lw ? d > (e.boss ? 600 : 470) : d > 900) { if (e.lw) lDespawn(e); else e.dead = true; } }
  enemies = enemies.filter(e => !e.dead);
  // Jäger der Nacht (tagsüber nur selten Wanderer)
  L.huntT -= .2 * (nt > .5 ? 1 : .35);
  if (L.huntT <= 0 && enemies.length < 18 && Math.hypot(P.x - LOFF - 384, P.y - LOFF - 380) > 500) {
    L.huntT = nt > .5 ? 26 + Math.random() * 14 : 70 + Math.random() * 40;
    const st = lStage(P.x, P.y), pool = lPool(lBioAt(P.x, P.y), st), a = Math.random() * 6.283, p = lFreeNear(P.x + Math.cos(a) * 200, P.y + Math.sin(a) * 150, 80);
    if (p) { const n = nt > .5 ? 2 + Math.min(3, Math.floor(st / 40)) : 1 + (Math.random() < .4 ? 1 : 0); for (let i = 0; i < n; i++) lSpawn(pick(pool), p.x + rnd(-24, 24), p.y + rnd(-16, 16), { elite: Math.random() < .08 + nt * .1, instant: false }); if (nt > .5) lMsg('hunt', _t('Jäger der Nacht sind dir auf den Fersen!'), '#c060ff', 25); }
  }
  // Vergrabener Schatz: stehen bleiben zum Graben
  let cache = null; for (const o of near) if (o.k === 'spot' && o.t === 'versteck' && !o.open && Math.hypot(o.x - P.x, o.y - P.y) < 14) cache = o;
  if (cache && !P.moving) { L.digO = cache; L.dig += .2; if (Math.random() < .5) { dust(cache.x, cache.y, 3); sfx('dig'); } if (L.dig >= 1.4) { L.dig = 0; L.digO = null; lOpenSpot(cache); } } else { L.dig = 0; L.digO = cache || null; }
  // Beute weit weg schlafen legen, nahe wecken (spart Rechenzeit)
  if ((L.revT -= .2) <= 0) { L.revT = .6; const keep = []; for (const c of pickups) if (Math.hypot(c.x - P.x, c.y - P.y) > 700) L.sleep.push(c); else keep.push(c); pickups = keep; L.sleep = L.sleep.filter(c => { const d = Math.hypot(c.x - P.x, c.y - P.y); if (d < 600) { pickups.push(c); return false; } return d < 4000; }); }
  // Erzadern sind echte Hindernisse (js/combat.js: abbauen), aber nur in der Nähe
  if ((L.veinT = (L.veinT || 0) - 1) <= 0) { L.veinT = 4; obs = obs.filter(o => !o.dead && Math.abs(o.x - P.x) < 500 && Math.abs(o.y - P.y) < 400); for (const o of lNear(P.x, P.y, 420)) if (o.k === 'vein' && !o.dead && !obs.includes(o)) obs.push(o); }
  for (const o of obs) if (o.k === 'vein' && o.dead && o.sk && !lTS(o.sk)) lTSet(o.sk, 1);
  const fd = Math.round(lDepthAt(P.x, P.y) * 10000); if (fd > L.farT) L.farT = fd;
  lMisCheckMats();
}
// Region gewechselt: Name, Biom, Stufe – und ob du hier schon warst
function lRegionTick(first) {
  const L = LW, R = lRegAt(P.x, P.y); if (R === L.reg) return; const was = L.reg; L.reg = R;
  const B = LANDE_BIOMES[R.biome], rate = lRate(R.stage), fresh = !lRegs().has(R.id) && !L.regs.has(R.id);
  if (fresh) { L.regs.add(R.id); L.newR++; stat('landeRegs'); }
  lMusic(); lMisEvent('region', R.id);
  const sub = _t('{biome} · Stufe {st} · für dich {rate}', { biome: B.n, st: R.stage, rate: rate.n });
  if (first) lBanner(lRegName(R).toLocaleUpperCase(LOCALE), sub);
  else if (fresh) { lBanner(_t('NEUE REGION: {n}', { n: lRegName(R).toLocaleUpperCase(LOCALE) }), sub); sfx('page'); }
  else lMsg('reg', lRegName(R) + ' · ' + sub, rate.c, 1);
  if (was && R.stage > was.stage * 1.25 && rate.c === '#ff4a4a') lMsg('deadly', _t('Vorsicht: Die Gegner hier sind für dich tödlich stark!'), '#ff4a4a', 30);
  if (B.haz && !lToolBit(LHAZ[B.haz].tool)) setTimeout(() => { if (LW && LW.on) toast(LHAZ[B.haz].s, LHAZ[B.haz].c); }, 1200);
  // Meilenstein: zum ersten Mal in einem neuen Ring (für immer gemerkt)
  const M = lMeta(); if (R.ring > M.ring) { M.ring = R.ring; persist(); if (!first) { lBanner(_t('{n}. GRENZE ÜBERWUNDEN', { n: R.ring }), R.ring >= LRMAX ? _t('Der Weltenrand – dahinter liegt nur noch das Ende der Welt.') : _t('Ring {n} von {m}: neue Biome, stärkere Gegner, bessere Beute.', { n: R.ring, m: LRMAX })); sfx('ach'); } }
}
// Gefahren der Biome: ohne das passende Werkzeug tut es weh
function lHazardTick(hz) {
  const L = LW; if (!hz || state !== 'play') return; if ((L.hazT -= .2) > 0) return; L.hazT = .5;
  const m = P.st.hp;
  if (hz === 'gift') { if (P.hp > m * .12) P.hp = Math.max(m * .12, P.hp - m * .006); P.poisonT = Math.max(P.poisonT || 0, .6); part(P.x + rnd(-6, 6), P.y, rnd(4, 16), 0, 0, 20, '#a0d050', .6, 1, -8, 1); }
  else if (hz === 'kalt') { P.slowT = Math.max(P.slowT, .7); if (P.hp > m * .2) P.hp = Math.max(m * .2, P.hp - m * .003); part(P.x + rnd(-6, 6), P.y, rnd(4, 16), 0, 0, 20, '#bfefff', .6, 1, -4, 1); }
  else if (hz === 'hitze') { if (P.hp > m * .15) P.hp = Math.max(m * .15, P.hp - m * .005); part(P.x + rnd(-6, 6), P.y, rnd(2, 10), 0, 0, 25, '#ff8a3a', .5, 1, -20, 1); }
  else if (hz === 'sturm') { if (Math.random() < .3) { const a = (lVN(T * .1, 0, 9) - .5) * 12; P.vx += Math.cos(a) * 160; P.vy += Math.sin(a) * 80; for (let i = 0; i < 6; i++) part(P.x + rnd(-20, 20), P.y, rnd(4, 20), Math.cos(a) * 120, Math.sin(a) * 60, 0, '#c8d0e0', .4, 1, 0, 0); } }
  else if (hz === 'leere') { P.res = Math.max(0, P.res - P.st.resMax * .08); if (P.hp > m * .2) P.hp = Math.max(m * .2, P.hp - m * .003); part(P.x + rnd(-6, 6), P.y, rnd(4, 16), 0, 0, 20, '#c060ff', .6, 1, -12, 1); }
  // Gefahren der Tiefe: stärker, aber nie tödlich (Untergrenze), damit Kämpfe entscheiden
  else if (hz === 'blut') { if (P.hp > m * .15) P.hp = Math.max(m * .15, P.hp - m * .008); part(P.x + rnd(-8, 8), P.y, rnd(2, 14), 0, 0, 20, '#ff5a6a', .6, 1, -6, 1); }
  else if (hz === 'sporen') { if (P.hp > m * .12) P.hp = Math.max(m * .12, P.hp - m * .007); P.poisonT = Math.max(P.poisonT || 0, .6); P.slowT = Math.max(P.slowT, .3); part(P.x + rnd(-6, 6), P.y, rnd(4, 16), 0, 0, 20, '#c8a0ff', .6, 1, -8, 1); }
  else if (hz === 'hoehe') { if (Math.random() < .45) { const a = (lVN(T * .13, 3, 9) - .5) * 12; P.vx += Math.cos(a) * 230; P.vy += Math.sin(a) * 110; for (let i = 0; i < 8; i++) part(P.x + rnd(-24, 24), P.y, rnd(4, 24), Math.cos(a) * 160, Math.sin(a) * 70, 0, '#ffffff', .4, 1, 0, 0); } }
  else if (hz === 'seelen') { P.res = Math.max(0, P.res - P.st.resMax * .06); if (P.hp > m * .2) P.hp = Math.max(m * .2, P.hp - m * .005); part(P.x + rnd(-8, 8), P.y, rnd(4, 18), 0, 0, 25, '#9af0e0', .7, 1, -14, 1); }
  else if (hz === 'glut') { if (P.hp > m * .12) P.hp = Math.max(m * .12, P.hp - m * .008); part(P.x + rnd(-6, 6), P.y, rnd(2, 10), 0, 0, 25, '#ffd04a', .5, 1, -24, 1); }
  else if (hz === 'frost') { P.slowT = Math.max(P.slowT, .9); if (P.hp > m * .18) P.hp = Math.max(m * .18, P.hp - m * .005); part(P.x + rnd(-6, 6), P.y, rnd(4, 16), 0, 0, 20, '#ffffff', .6, 1, -4, 1); }
  else if (hz === 'traum') { if (Math.random() < .35) P.slowT = Math.max(P.slowT, .8); if (P.hp > m * .25) P.hp = Math.max(m * .25, P.hp - m * .003); part(P.x + rnd(-8, 8), P.y, rnd(6, 20), 0, 0, 20, pick(['#ffc0e8', '#c0e0ff', '#fff0b0']), .7, 1, -6, 1); }
  else if (hz === 'zeit') { if (Math.random() < .4) { P.slowT = Math.max(P.slowT, .6); for (let i = 0; i < P.cds.length; i++) P.cds[i] = Math.max(P.cds[i] || 0, .5); } P.res = Math.max(0, P.res - P.st.resMax * .04); part(P.x + rnd(-8, 8), P.y, rnd(2, 20), 0, 0, -20, '#ffe08a', .6, 1, 10, 1); }
  else if (hz === 'splitter') { if (Math.random() < .35) { if (P.hp > m * .1) P.hp = Math.max(m * .1, P.hp - m * .03); burst(P.x + rnd(-6, 6), P.y - 4, 4, '#e8f8ff', 10, 50, 1); sfx('hit'); } }
}
// Schwebeteilchen je Biom (statt der Teilchen der Arenen)
function lAmbient(dt) {
  const L = LW; if ((L.ambA -= dt) > 0) return; L.ambA = .1; const k = L.reg ? LANDE_BIOMES[L.reg.biome].amb : ''; if (!k || SAVE.meta.settings.calm && Math.random() < .5) return;
  const x = cam.x + rnd(0, VW), y = cam.y + rnd(0, VH), P_ = o => parts.push(Object.assign({ x, y, z: rnd(4, 24), vx: 0, vy: 0, vz: 0, g: 0, life: 3, max: 3, s: 1 }, o));
  switch (k) {
    case 'pollen': if (Math.random() < .5) P_({ vx: rnd(-6, 6), vy: rnd(-3, 3), vz: rnd(-1, 2), col: '#fff3a0', glow: 1, blink: 1 }); break;
    case 'moss': P_({ vx: rnd(-6, 6), vy: rnd(-4, 4), vz: rnd(-2, 2), col: '#c8f06a', glow: 1, blink: 1 }); break;
    case 'gruft': P_({ vx: rnd(-3, 3), vy: rnd(-2, 2), vz: rnd(-1, 1), col: '#9a94a6' }); break;
    case 'glut': P_({ y: cam.y + VH + 4, z: 0, vx: rnd(-5, 5), vy: rnd(-40, -25), vz: rnd(0, 4), col: Math.random() < .5 ? '#ff8a3a' : '#ffd24a', life: 4, max: 4, glow: 1 }); break;
    case 'schnee': for (let i = 0; i < 2; i++) parts.push({ x: cam.x + rnd(-20, VW), y: cam.y + rnd(-10, VH), z: rnd(20, 60), vx: rnd(6, 14), vy: rnd(2, 6), vz: -rnd(10, 18), g: 0, col: '#ffffff', life: 3.5, max: 3.5, s: 1 }); break;
    case 'asche': P_({ z: rnd(20, 50), vx: rnd(3, 8), vy: rnd(1, 4), vz: -rnd(5, 10), col: Math.random() < .3 ? '#ff8a3a' : '#7a7072', life: 4, max: 4 }); break;
    case 'sporen': P_({ vx: rnd(-4, 4), vy: rnd(-3, 3), vz: rnd(1, 4), col: '#c890ff', glow: 1, blink: 1 }); break;
    case 'giftsporen': P_({ vx: rnd(-4, 4), vy: rnd(-3, 3), vz: rnd(1, 4), col: '#a0d050', glow: 1, blink: 1 }); break;
    case 'blatt': if (Math.random() < .6) P_({ z: rnd(20, 50), vx: rnd(4, 12), vy: rnd(1, 4), vz: -rnd(6, 12), col: pick(['#c86a1e', '#e8a03a', '#a8401a']), life: 4, max: 4, s: 2 }); break;
    case 'sand': P_({ z: rnd(1, 10), vx: rnd(40, 70), vy: rnd(-3, 3), col: '#e8d0a0', life: 1.6, max: 1.6 }); break;
    case 'stern': P_({ vx: rnd(-2, 2), vy: rnd(-2, 2), vz: rnd(-1, 1), col: Math.random() < .5 ? '#b0b8ff' : '#ffffff', glow: 1, blink: 1 }); break;
    case 'nebel': if (Math.random() < .5) P_({ z: rnd(0, 8), vx: rnd(-4, 4), vy: rnd(-1, 1), col: 'rgba(200,210,220,.35)', life: 4, max: 4, s: 3 }); break;
    case 'schatten': P_({ vx: rnd(-3, 3), vy: rnd(-3, 3), vz: rnd(1, 3), col: '#6a48c0', glow: 1, blink: 1 }); break;
    case 'geist': if (Math.random() < .6) P_({ vx: rnd(-8, 8), vy: rnd(-3, 3), vz: rnd(1, 4), col: '#bfefff', glow: 1, blink: 1, s: 2 }); break;
    case 'blasen': P_({ z: 0, vx: rnd(-2, 2), vy: 0, vz: rnd(8, 16), col: '#9ad8ee', life: 2.5, max: 2.5 }); break;
    case 'regen': for (let i = 0; i < 3; i++) parts.push({ x: cam.x + rnd(-20, VW), y: cam.y + rnd(-10, VH), z: rnd(30, 60), vx: 20, vy: 6, vz: -120, g: 0, col: '#8a9ab8', life: .5, max: .5, s: 1 }); break;
    case 'leere': P_({ vx: rnd(-3, 3), vy: rnd(-3, 3), vz: rnd(2, 6), col: Math.random() < .5 ? '#c060ff' : '#1a0a2a', glow: 1 }); break;
    // Teilchen der Tiefe
    case 'kristall': P_({ z: 0, vx: rnd(-2, 2), vy: 0, vz: rnd(6, 14), col: Math.random() < .5 ? '#b0d0ff' : '#ffffff', glow: 1, blink: 1 }); break;
    case 'glas': if (Math.random() < .6) P_({ z: rnd(0, 6), col: '#ffffff', glow: 1, blink: 1, life: 1.2, max: 1.2 }); break;
    case 'sternmeer': P_({ z: 0, vx: rnd(-2, 2), vy: 0, vz: rnd(8, 16), col: Math.random() < .6 ? '#c0c8ff' : '#ffe08a', glow: 1, blink: 1, life: 2.5, max: 2.5 }); break;
    case 'aschesturm': for (let i = 0; i < 3; i++) parts.push({ x: cam.x - 10 + rnd(0, VW), y: cam.y + rnd(0, VH), z: rnd(2, 40), vx: rnd(70, 120), vy: rnd(-6, 6), vz: -rnd(2, 6), g: 0, col: Math.random() < .2 ? '#ff8a3a' : Math.random() < .5 ? '#6a6264' : '#8a8284', life: 1.6, max: 1.6, s: 1 }); break;
    case 'blutnebel': if (Math.random() < .6) P_({ z: rnd(0, 8), vx: rnd(-4, 4), vy: rnd(-1, 1), col: 'rgba(200,40,60,.32)', life: 4, max: 4, s: 3 }); break;
    case 'riesensporen': P_({ vx: rnd(-3, 3), vy: rnd(-2, 2), vz: rnd(2, 5), col: Math.random() < .5 ? '#c890ff' : '#9ae8ff', glow: 1, blink: 1, s: 2 }); break;
    case 'dampf': if (Math.random() < .5) P_({ z: 0, vx: rnd(-3, 3), vy: 0, vz: rnd(10, 18), col: 'rgba(220,220,210,.35)', life: 2.5, max: 2.5, s: 3 }); else P_({ col: '#ffb03a', glow: 1, life: .6, max: .6 }); break;
    case 'wolke': if (Math.random() < .6) P_({ x: cam.x - 10, z: rnd(10, 40), vx: rnd(60, 100), vy: rnd(-3, 3), col: 'rgba(255,255,255,.45)', life: 5, max: 5, s: 4 }); break;
    case 'seele': P_({ z: 0, vx: rnd(-3, 3), vy: 0, vz: rnd(6, 12), col: Math.random() < .6 ? '#9af0e0' : '#ffffff', glow: 1, blink: 1, s: 2, life: 3.5, max: 3.5 }); break;
    case 'mond': P_({ vx: rnd(-2, 2), vy: rnd(-2, 2), vz: rnd(-1, 1), col: Math.random() < .6 ? '#e0e8ff' : '#9ab0d8', glow: 1, blink: 1 }); break;
    case 'bernstein': P_({ vx: rnd(-3, 3), vy: rnd(-2, 2), vz: rnd(-1, 2), col: Math.random() < .6 ? '#ffb040' : '#ffe0a0', glow: 1, blink: 1 }); break;
    case 'splitter': if (Math.random() < .6) P_({ z: rnd(30, 50), vx: rnd(-4, 4), vy: rnd(1, 3), vz: -rnd(30, 50), col: Math.random() < .5 ? '#e8f8ff' : '#9ad8e8', life: 1.2, max: 1.2 }); break;
    case 'sonne': P_({ y: cam.y + VH + 4, z: 0, vx: rnd(-5, 5), vy: rnd(-45, -30), vz: rnd(0, 4), col: Math.random() < .5 ? '#ffd04a' : '#fff0a0', life: 4, max: 4, glow: 1 }); break;
    case 'frost': for (let i = 0; i < 4; i++) parts.push({ x: cam.x + rnd(-20, VW), y: cam.y + rnd(-10, VH), z: rnd(20, 60), vx: rnd(14, 26), vy: rnd(2, 6), vz: -rnd(14, 24), g: 0, col: Math.random() < .7 ? '#ffffff' : '#bfefff', life: 3, max: 3, s: 1 }); break;
    case 'traum': P_({ vx: rnd(-3, 3), vy: rnd(-3, 3), vz: rnd(1, 3), col: pick(['#ffc0e8', '#c0e0ff', '#fff0b0', '#e0c0ff']), glow: 1, blink: 1, s: 2 }); break;
    case 'zeit': P_({ z: 0, vx: rnd(-1, 1), vy: 0, vz: rnd(10, 20), col: Math.random() < .6 ? '#ffe08a' : '#c8a040', life: 2.5, max: 2.5 }); break;
    case 'rost': if (Math.random() < .6) P_({ z: rnd(20, 50), vx: rnd(6, 14), vy: rnd(1, 4), vz: -rnd(6, 12), col: pick(['#c8642a', '#8a3a14', '#e8904a']), life: 4, max: 4 }); break;
    case 'sternfall': if (Math.random() < .3) P_({ x: cam.x + rnd(0, VW), z: 70, vx: rnd(30, 60), vy: rnd(10, 20), vz: -rnd(60, 90), col: Math.random() < .6 ? '#ffe08a' : '#ffffff', glow: 1, life: 1, max: 1 }); else P_({ col: '#ffd24a', glow: 1, blink: 1 }); break;
    case 'daemmer': P_({ vx: rnd(-3, 3), vy: rnd(-2, 2), vz: rnd(1, 3), col: Math.random() < .5 ? '#ffd070' : '#b892f4', glow: 1, blink: 1 }); break;
    case 'urnebel': if (Math.random() < .6) P_({ z: rnd(0, 10), vx: rnd(-5, 5), vy: rnd(-1, 1), col: pick(['rgba(160,120,220,.3)', 'rgba(120,200,220,.3)', 'rgba(255,180,220,.25)']), life: 4, max: 4, s: 3 }); break;
    case 'schwarz': P_({ y: cam.y + VH + 4, z: 0, vx: rnd(-5, 5), vy: rnd(-35, -20), vz: rnd(0, 4), col: Math.random() < .6 ? '#1a0a0a' : '#c8342c', life: 4, max: 4, glow: Math.random() < .3 ? 1 : 0 }); break;
    case 'nichts': P_({ vx: rnd(-8, 8), vy: rnd(-8, 8), vz: rnd(-1, 1), col: Math.random() < .7 ? '#ffffff' : '#c060ff', glow: 1, blink: 1, life: 2, max: 2 }); break;
  }
}
// Ende der Welt: beim allerersten Besuch (einmal je Konto) Banner und Belohnung; ein Wächter (Teil B: Rang nahe 1200) hütet den letzten Hort.
// Der Wächter kehrt wie jeder Hort-Boss nach 3 Tagen zurück (bossLairReady), der Hort füllt sich in jedem Ausflug mit neuer Beute.
function lEndTick(o, d) {
  const L = LW, M = lMeta();
  if (d < 420 && !L.msgT['end' + o.key]) {
    L.msgT['end' + o.key] = T;
    if (!M.end) lEndFirst(o);
    else { lBanner(_t('ENDE DER WELT'), o.state === 'done' ? _t('Der letzte Hort ist leer. Dahinter ist nur noch das Nichts.') : _t('Ein Wächter hütet den letzten Hort. Dahinter ist nur noch das Nichts.')); sfx('spec'); }
  }
  if (o.state === 'idle' && d < 230 && enemies.length < 28) {
    let ok = true; try { if (typeof bossLairReady === 'function') ok = !!bossLairReady(o.key); } catch (_) { ok = false; }
    if (!ok) { o.state = 'rest'; lMsg('endrest', _t('Der Wächter am Ende der Welt ruht noch – sein Hort füllt sich erst wieder, wenn er zurückkehrt.'), '#c8c0d8', 20); return; }
    o.state = 'fight'; o.act = true; o.alive = 0;
    if (!lBossAt(o, o.key, { edge: true })) {   // ohne Teil B: ein Champion mit Gefolge
      const st = lStage(o.x, o.y) + 6, pool = lPool(lBioAt(o.x, o.y), st), strong = pool.filter(k => EN[k].cost >= 4);
      lSpawn(pick(strong.length ? strong : pool), o.x, o.y - 44, { elite: true, champ: true, name: _t('Wächter am Ende der Welt'), tint: 'rgba(255,210,80,.35)', src: o, st, instant: false });
      for (let i = 0; i < 3; i++) lSpawn(pick(pool), o.x + (i - 1) * 46, o.y - 12, { elite: true, src: o, st, instant: false });
      o.alive = 4;
    }
    shake(7); sfx('boom'); flash = { a: .3, c: '255,210,120' };
  }
  if (o.state === 'open' && d < 30) {
    o.state = 'done'; lTSet(o.key, 'done'); M.endN = Math.min(1e6, (M.endN || 0) + 1); persist();
    const st = lStage(o.x, o.y), dep = lDepthAt(o.x, o.y), list = [{ t: 'item', it: lItem(4, 5, st + 4) }, { t: 'item', it: lItem(3, 4, st + 4) }, { t: 'item', it: lItem(3, 4, st + 2) }, { t: 'gold', n: Math.round(800 + Math.min(st, 240) * 40) }, { t: 'gem', k: randomGem(st + 12), n: 1 }, { t: 'stone' }];
    if (Math.random() < .35) list.push({ t: 'item', it: makeMythic() });
    const eg = lEgg(10, lBioAt(o.x, o.y), dep); if (eg) list.push({ t: 'egg', d: eg });
    for (let i = 0; i < 2; i++) { const m = lMod(dep, 4); if (m) list.push(m); }
    const pk = lPart(st, .5); if (pk) list.push({ t: 'part', k: pk, n: 1 });
    lBurst({ x: o.x, y: o.y + 24 }, list); burst(o.x, o.y - 30, 18, '#ffd24a', 40, 110, 1); rings.push({ x: o.x, y: o.y - 20, r: 6, max: 90, life: .8, max2: .8, col: '#ffd24a' }); flash = { a: .35, c: '255,230,160' }; sfx('myth');
    lBanner(_t('DER LETZTE HORT'), _t('Was der Rand der Welt hergibt – jetzt nur noch lebend hinaus!'));
  }
}
// Erster Besuch am Ende der Welt (einmal je Konto): großes Banner, 3 Leuchtfeuersteine aufs Konto, ein Geschenk des Randes am Boden (in den Rucksack – heimbringen!)
function lEndFirst(o) {
  const M = lMeta(); M.end = Date.now(); M.stones = Math.min(99, M.stones + 3); stat('landeEnd'); persist();
  const st = lStage(o.x, o.y), dep = lDepthAt(o.x, o.y), list = [{ t: 'item', it: makeMythic() }, { t: 'item', it: lItem(4, 6, st + 6) }, { t: 'gold', n: Math.round(3000 + Math.min(st, 240) * 60) }];
  const eg = lEgg(12, lBioAt(o.x, o.y), dep); if (eg) list.push({ t: 'egg', d: eg });
  const m = lMod(dep, 5); if (m) list.push(m);
  setTimeout(() => { if (LW && LW.on) lBurst({ x: o.x, y: o.y + 30 }, list); }, 900);
  flash = { a: .5, c: '255,240,200' }; shake(5); sfx('myth'); setTimeout(() => sfx('ach'), 600);
  for (let i = 0; i < 3; i++) rings.push({ x: o.x, y: o.y - 30, r: 6 + i * 10, max: 120 + i * 40, life: .9 + i * .2, max2: .9 + i * .2, col: i % 2 ? '#b892f4' : '#ffd24a' });
  lBanner(_t('DAS ENDE DER WELT'), _t('Du bist den ganzen Weg gegangen – 24 Stunden vom Weltentor. Der Rand schenkt dir 3 Leuchtfeuersteine und einen Schatz. Bring ihn lebend heim!'));
}
// Werkzeug-Hort: Wächter oder Rätsel, dann liegt das Werkzeug auf dem Sockel
function lToolTick(o, d) {
  const L = LW, T_ = LANDE_TOOLS[o.tk];
  if (lToolBit(o.tk)) { if (o.state !== 'done') o.state = 'done'; return; }
  o.state = o.state || 'idle';
  if (d < 260 && !L.msgT['tool' + o.key]) { L.msgT['tool' + o.key] = T; lBanner(_t('HORT: {tool}', { tool: T_.n.toLocaleUpperCase(LOCALE) }), o.guard === 'boss' ? _t('Ein Wächter hütet das Werkzeug. Besiege ihn!') : _t('Berühre die Runensteine in der Reihenfolge I – II – III – IV.')); sfx('spec'); }
  if (o.guard === 'boss' && o.state === 'idle' && d < 190 && enemies.length < 28) {
    o.state = 'fight'; o.act = true; o.alive = 0;
    const e = lBossAt(o, o.key, { tool: T_.key });
    if (!e) { // ohne Teil B: ein Champion mit Gefolge
      const st = lStage(o.x, o.y) + 3, pool = lPool(lBioAt(o.x, o.y), st), strong = pool.filter(k => EN[k].cost >= 2.5);
      lSpawn(pick(strong.length ? strong : pool), o.x, o.y - 30, { elite: true, champ: true, name: _t('Hüter: {tool}', { tool: T_.n }), tint: 'rgba(255,110,40,.35)', src: o, st, instant: false });
      for (let i = 0; i < 2; i++) lSpawn(pick(pool), o.x + (i ? 40 : -40), o.y - 10, { elite: true, src: o, st, instant: false });
      o.alive = 3;
    }
    shake(5); sfx('boom');
  }
  if (o.state === 'open' && d < 18) {
    o.state = 'done'; landeToolGive(o.tk); lTSet(o.key, 1);
    burst(o.x, o.y, 14, T_.c, 30, 90, 1); rings.push({ x: o.x, y: o.y, r: 4, max: 70, life: .7, max2: .7, col: T_.c }); flash = { a: .35, c: '255,240,190' };
    lBurst(o, [{ t: 'gold', n: Math.round(40 + Math.min(lStage(o.x, o.y), 150) * 10) }, { t: 'item', it: lItem(2, 2) }]);
  }
}
function lRune(s) {
  const o = s.site;
  if (!o.wave) { o.wave = true; const st = lStage(o.x, o.y) + 1, pool = lPool(lBioAt(o.x, o.y), st); for (let i = 0; i < 3; i++) { const a = i * 2.1; lSpawn(pick(pool), o.x + Math.cos(a) * 80, o.y + Math.sin(a) * 50, { elite: i === 0, instant: false, st }); } lMsg('rwave', _t('Die Wächter des Horts erwachen!'), '#ff8a5a', 6); }
  if (s.n === o.lit) { s.on = true; o.lit++; sfx('ach'); burst(s.x, s.y, 8, '#57c7e6', 14, 50, 1); if (o.lit >= 4) { o.state = 'open'; sfx('myth'); lBanner(_t('DER HORT ÖFFNET SICH'), _t('Hol dir das Werkzeug vom Sockel!')); } }
  else { for (const t of o.stones) t.on = false; o.lit = 0; sfx('fail'); shake(3); hurtPlayer(Math.round(P.st.hp * .08), null); burst(s.x, s.y, 10, '#c060ff', 14, 60, 1); lMsg('rwrong', _t('Falsche Reihenfolge! Von vorn: I – II – III – IV.'), '#c060ff', 2); }
}
// Mystische Begegnung (Teil A): öffnet ihren Dialog; Teleport geht über die Welt
function lEncounter(o) {
  o.used = true; lTSet(o.ek, 1); const e = o.enc;
  try { e.teleport = e.teleport || ((wx, wy) => lTeleport(wx + LOFF, wy + LOFF)); e.local = { x: o.x, y: o.y }; if (typeof encounterOpen === 'function') encounterOpen(e); } catch (err) { console.error('Lande (encounterOpen):', err); }
  for (const r of LW.cm.values()) lRecDel(r, o);
}
// Artefakt auflesen (take) oder Schatz öffnen (open) – Ton, Lesebildschirm und Beute macht Teil A selbst.
// Ein Schatz bleibt liegen, solange open() nicht true liefert (versiegelt, Wächter erwacht): erst nach dem Weggehen fragt er wieder.
function lArte(o) {
  const s = o.s; let r = false;
  o.wait = true;
  try {
    if (o.k === 'arte') r = typeof s.take === 'function' ? s.take() : typeof artePickup === 'function' ? artePickup(s.id) : typeof s.open === 'function' ? s.open() : false;
    else r = typeof s.open === 'function' ? s.open() : typeof arteTreasureOpen === 'function' ? arteTreasureOpen(s.chain != null ? s.chain : s.id) : false;
  } catch (err) { console.error('Lande (Artefakt):', err); r = false; }
  if (o.k === 'arte') { lArteGone(o); if (r === true) lArteReady(s.chain); }
  else if (r === true) lArteGone(o);
}
function lArteGone(o) { o.used = true; for (const r of LW.cm.values()) lRecDel(r, o); }
// Liegt die Schatzstelle noch da? (Teil A weiß es: nach dem Wächter öffnet er sie selbst, ein neuer Fund bricht das Siegel)
function lArteLive(o) {
  if (typeof arteTreasureInChunk !== 'function') return true;
  try { const cx = Math.floor((o.x - LOFF) / LCK), cy = Math.floor((o.y - LOFF) / LCK), l = arteTreasureInChunk(lCtxOf(cx, cy, 'arte')) || [], s = l.find(q => q && q.id === o.s.id); if (!s) return false; o.s = s; return true; } catch (_) { return true; }
}
// Neues Artefakt: Schatzstellen derselben Spur in geladenen Chunks neu fragen (Siegel gebrochen?)
function lArteReady(chain) { if (chain == null) return; for (const rec of LW.cm.values()) for (const c of rec.grid) for (const o of c) if (o.k === 'arteT' && o.s && o.s.chain === chain) lArteLive(o); }
function lArteTick(o, d) {
  if (o.used) return;
  if (!o.wait) { if (d < 18) lArte(o); return; }
  if (d > 46 || (o.chk = (o.chk || 0) - .2) <= 0) { o.chk = 1; if (!lArteLive(o)) { lArteGone(o); return; } if (d > 46) o.wait = false; }
}
function lExitOpen(ex) { if (ex.t === 'mond') return ((LW.t + ex.ph) % 80) < 40; if (ex.t === 'schluessel') return !!ex.open; return true; }
// Ausgänge in der Nähe: Tore der Alten (aus der Welt-Saat), Weltentor, Leuchtfeuer, Rückkehrrolle
function lExitsNear() {
  const L = LW, wx = (P.x - LOFF) / LCK, wy = (P.y - LOFF) / LCK, out = [];
  for (let gy = Math.floor(wy / LXG) - 1; gy <= Math.floor(wy / LXG) + 1; gy++) for (let gx = Math.floor(wx / LXG) - 1; gx <= Math.floor(wx / LXG) + 1; gx++) { const e = lExitCell(gx, gy); if (e) out.push({ k: 'exit', t: e.t, x: e.x * LCK + LOFF, y: e.y * LCK + LOFF, ph: e.ph, id: e.id, open: !!lTS('x' + e.id), far: true }); }
  out.push({ k: 'exit', t: 'tor', x: LOFF + 384, y: LOFF + 300, id: 'tor', far: true });
  for (const c of lMeta().cps) out.push({ k: 'beacon', cp: c, x: c.x + LOFF, y: c.y + LOFF, far: true });
  for (const x of L.xs) out.push(x);
  // echte Objekte der geladenen Chunks haben Vorrang (genaue Lage, Zustand)
  for (const o of lNear(P.x, P.y, 700)) if (o.k === 'exit' || o.k === 'beacon') { const i = out.findIndex(q => q.far && (q.k === 'exit' ? q.id === o.id : q.cp === o.cp)); if (i >= 0) out[i] = o; else out.push(o); }
  return out;
}
function lNearExit() { let b = null, bd = 1e18, bo = null, bod = 1e18; for (const ex of lExitsNear()) { const d = Math.hypot(ex.x - P.x, ex.y - P.y); if (d < bd) { bd = d; b = ex; } if ((ex.k === 'beacon' || lExitOpen(ex) || (ex.t === 'schluessel' && lMeta().keys > 0)) && d < bod) { bod = d; bo = ex; } } return bo || b; }
function lChannel(ex) { return Math.max(1.5, 3 + Math.min(3, lDepthAt(P.x, P.y) * 12) - lPerk('ch')) * (ex && ex.t === 'rolle' ? 2 : 1); }
// Am Ausgang stehen: läuft genau einmal je Bild mit der echten Bildzeit
function lChannelTick(dt) {
  const L = LW; if (state !== 'play') return;
  let ex = null; for (const o of L.xs) if (Math.hypot(o.x - P.x, (o.y - P.y) * 1.2) < 22) ex = o;
  if (!ex) { const N = lNear(P.x, P.y, 30); for (let i = 0; i < N.length; i++) { const o = N[i]; if ((o.k === 'exit' || o.k === 'beacon') && Math.hypot(o.x - P.x, (o.y - P.y) * 1.2) < 22) { ex = o; break; } } }
  if (!ex) { if (L.ch > 0) { L.ch = 0; $('objective').textContent = ''; } L.chEx = null; return; }
  if (ex.t === 'schluessel' && !ex.open) { const M = lMeta(); if (M.keys > 0) { M.keys--; ex.open = true; lTSet('x' + ex.id, 1); sfx('ach'); toast(_t('Das Schlüsseltor öffnet sich!'), '#e8b04a'); persist(); } else { lMsg('xkey', _t('Dieses Tor braucht einen Schlüssel.'), '#ff8a5a', 4); return; } }
  if (ex.k === 'exit' && !lExitOpen(ex)) { $('objective').textContent = _t('MONDTOR ÖFFNET IN {n} S', { n: Math.ceil(80 - ((L.t + ex.ph) % 80)) }); L.ch = 0; return; }
  const foe = enemies.some(e => !e.dead && e.st !== 'spawn' && Math.hypot(e.x - P.x, e.y - P.y) < 70), hurt = T - L.hurtT < .6;
  if (L.chEx !== ex) { L.chEx = ex; L.ch = 0; }
  if (foe || hurt) { L.ch = Math.max(0, L.ch - dt * 1.5); $('objective').textContent = foe ? _t('GEGNER STÖREN DEN AUSGANG!') : _t('UNTERBROCHEN!'); return; }
  const need = lChannel(ex), before = L.ch; L.ch += dt;
  if (Math.floor(before * 2) !== Math.floor(L.ch * 2)) tone(440 + L.ch / need * 600, .08, 'triangle', .04);
  $('objective').textContent = ex.k === 'beacon' ? _t('LEUCHTFEUER: {n} S', { n: Math.max(0, need - L.ch).toFixed(1) }) : _t('AUSGANG: {n} S', { n: Math.max(0, need - L.ch).toFixed(1) });
  if (L.ch >= need) lExtract(ex);
}
HOOK.hurt.push((d, src) => { if (LW && LW.on && d > 0) LW.hurtT = T; return d; });
// Im Kampf: eben getroffen, ein Gegner ganz nah oder ein Boss in der Nähe – dann kein Abbrechen, kein Leuchtfeuer, und Neu laden zählt als Tod
function lDanger() {
  const L = LW; if (!L || !L.on) return false;
  if (T - L.hurtT < 5) return true;
  return enemies.some(e => !e.dead && e.st !== 'spawn' && Math.hypot(e.x - P.x, e.y - P.y) < (e.boss ? 360 : 150));
}
// Ungeheuer der Nacht: erwacht mit der Dunkelheit irgendwo in der Ferne und jagt dich
function lBeastTick(nt) {
  const L = LW;
  if (!L.beast && L.beastN && nt > .8) {
    L.beastN = false; const a = Math.random() * 6.283, p = lFreeNear(P.x + Math.cos(a) * 900, P.y + Math.sin(a) * 900, 300); if (!p) return;
    const dep = lDepthAt(P.x, P.y), B = BOSSES[Math.min(BOSSES.length - 1, Math.floor(dep * 40 + Math.random() * 3))];
    L.beast = { B, x: p.x, y: p.y, tx: p.x, ty: p.y, hp: 1, state: 'roam', rumble: 0 };
    lBanner(_t('EIN UNGEHEUER ERWACHT'), _t('{name} streift durch die Nacht – sieh auf die Karte und meide es, oder stell dich ihm!', { name: B.name })); sfx('boom'); shake(6); flash = { a: .25, c: '200,40,40' };
  }
  const B = L.beast; if (!B) return;
  if (B.state === 'roam') {
    if (nt < .2) { L.beast = null; lMsg('beast', _t('Das Ungeheuer zieht sich mit der Nacht zurück.'), '#9ad8ee', 1); return; }
    const dx = B.tx - B.x, dy = B.ty - B.y, d = Math.hypot(dx, dy);
    if (d < 10) { const hunt = Math.random() < .5; B.tx = hunt ? P.x + rnd(-200, 200) : B.x + rnd(-400, 400); B.ty = hunt ? P.y + rnd(-200, 200) : B.y + rnd(-400, 400); }
    else { const nx = B.x + dx / d * 3.4, ny = B.y + dy / d * 3.4; if (lWalk(nx, ny)) { B.x = nx; B.y = ny; } else { B.tx = B.x; B.ty = B.y; } }
    const pd = Math.hypot(B.x - P.x, B.y - P.y);
    if (pd > 2600) { B.x = P.x + (B.x - P.x) * .5; B.y = P.y + (B.y - P.y) * .5; }
    if (pd < 520 && (B.rumble -= .2) <= 0) { B.rumble = 2.4; shake(1.5 + (520 - pd) / 160); tone(55, .5, 'sawtooth', .05, 40); lMsg('boss', _t('Der Boden bebt – {name} ist ganz nah!', { name: B.B.name }), '#ff6a5a', 12); }
    if (pd < 300 && enemies.length < 30) {
      B.state = 'act'; const st = lStage(B.x, B.y) + 2;
      const e = lSpawn(B.B.type, B.x, B.y, { boss: true, sc: B.B.sc * .9, hpMul: B.B.hpMul * .75, name: B.B.name, tint: B.B.tint, src: B, st, instant: false });
      e.hp = Math.max(1, Math.round(e.maxHp * B.hp)); e.spd *= .85;
      $('bossName').textContent = B.B.name.toLocaleUpperCase(LOCALE); $('bossbar').hidden = false; setMusic(LANDE_BIOMES[L.reg.biome].mus + 5, true); lBanner(B.B.name.toLocaleUpperCase(LOCALE), _t('Kämpfen – oder davonlaufen!')); sfx('boom'); shake(7);
    }
  }
}
function lRivalSpawn() {
  const L = LW, a = Math.random() * 6.283, p = lFreeNear(P.x + Math.cos(a) * 700, P.y + Math.sin(a) * 600, 200); if (!p) return;
  const rv = LRIV[Math.floor(Math.random() * LRIV.length)];
  L.rivals.push({ name: rv[0], type: rv[1], look: { body: rv[2], at: rv[3], ht: rv[3], hair: rv[4], skin: -1, accent: -1 }, x: p.x, y: p.y, hp: 1, loot: [], state: 'roam', tgt: null, t: 0, seen: false, leave: L.t + 300 + Math.random() * 200 });
}
function lRivalTick(r) {
  const L = LW; if (r.state !== 'roam') return;
  r.t += .2;
  const pd = Math.hypot(r.x - P.x, r.y - P.y);
  if (L.t > r.leave || pd > 2400) { r.state = 'gone'; if (r.seen) lMsg('rgone' + r.name, _t('{name} ist mit der Beute entkommen.', { name: r.name }), '#ff8a3a', 1); return; }
  if (!r.tgt || r.tgt.open) { let b = null, bd = 1e9; for (const o of lNear(r.x, r.y, 600)) { if (o.k !== 'spot' || o.open || o.t === 'kraut' || o.t === 'versteck' || LCH[o.t].lock || o.relic) continue; const d = Math.hypot(o.x - r.x, o.y - r.y); if (d < bd) { bd = d; b = o; } } r.tgt = b; r.lt = 0; }
  if (r.tgt) {
    const dx = r.tgt.x - r.x, dy = r.tgt.y - r.y, d = Math.hypot(dx, dy); r.tx = r.tgt.x;
    if (d > 14) { const nx = r.x + dx / d * 6, ny = r.y + dy / d * 6; if (lWalk(nx, ny)) { r.x = nx; r.y = ny; } else r.tgt = null; }
    else if ((r.lt += .2) > 2.5) { const o = r.tgt; o.open = 1; if (o.sk) lTSet(o.sk, 1); o.by = r.name; if (r.loot.length < 8) for (const e of lRollSpot(o).slice(0, 3)) r.loot.push(e); r.tgt = null; if (pd < 320) lMsg('rloot', _t('{name} plündert eine Truhe vor deiner Nase!', { name: r.name }), '#ff8a3a', 6); }
  } else { r.x += rnd(-4, 4); r.y += rnd(-4, 4); }
  if (pd < 300) r.seen = true;
  if (pd < 230 && enemies.length < 28) {
    r.state = 'act';
    const e = lSpawn(r.type, r.x, r.y, { elite: true, name: r.name, tint: 'rgba(0,0,0,0)', src: r, instant: false });
    e.hp = e.maxHp = Math.round(e.maxHp * 1.6); e.hp = Math.max(1, Math.round(e.maxHp * r.hp)); e.rival = r; r.rival = true;
    toast(_t('Rivale {name} greift an – er will deine Beute!', { name: r.name }), '#ff8a3a'); sfx('spec');
  }
}
// Kill: Bauteile und Eier anderer Systeme werden in der Freiwelt zur Beute am Boden; Lager, Horte, Bosse, Rivalen
function lEggIds() { const E = SAVE && SAVE.meta.pets && SAVE.meta.pets.eggs; return Array.isArray(E) ? new Set(E.map(g => g.id)) : null; }
// Was Kill-Hooks anderer Systeme direkt gutschreiben (Bauteile, Mods, Eier – z. B. der erste Sieg über einen Boss aus Teil B),
// gehört in der Freiwelt zum Ausflug: Bauteile und Mods in den Rucksack (voll: auf den Boden), Eier als Bodenbeute – beim Tod verloren
function lKillPre() { if (LW && LW.on) { LW.pk = Object.assign({}, P.parts || {}); LW.mk = Object.assign({}, P.mods || {}); LW.ek = lEggIds(); } }
HOOK.kill.unshift(lKillPre);
HOOK.kill.push(lKillPost);
// erst nach allen Kill-Hooks (auch aus später geladenen Dateien) nachsehen, was dazugekommen ist
HOOK.boot.push(() => { const i = HOOK.kill.indexOf(lKillPost); if (i >= 0) HOOK.kill.splice(i, 1); HOOK.kill.push(lKillPost); const j = HOOK.kill.indexOf(lKillPre); if (j > 0) { HOOK.kill.splice(j, 1); HOOK.kill.unshift(lKillPre); } });
function lKillTake(e, x) { if (lPackAdd(x)) lGot(x); else lDrop(e.x, e.y, x, .6); }
function lKillPost(e) {
  if (!LW || !LW.on) return;
  const L = LW, M = lMeta(); L.kills++; M.kills++; lMisEvent('kill');
  if (L.pk && P.parts) for (const k in P.parts) { const d = P.parts[k] - (L.pk[k] || 0); if (d > 0) { if (typeof padd === 'function') padd(k, -d); else P.parts[k] -= d; lKillTake(e, { t: 'part', k, n: d }); } }
  L.pk = null;
  if (L.mk && P.mods) for (const k of Object.keys(P.mods)) { const d = P.mods[k] - (L.mk[k] || 0); if (d > 0) { if (typeof modAdd === 'function') modAdd(k, -d); else { P.mods[k] -= d; if (P.mods[k] <= 0) delete P.mods[k]; } lKillTake(e, { t: 'mod', k, n: d }); } }
  L.mk = null;
  const E = SAVE.meta.pets && SAVE.meta.pets.eggs;
  // Eier wie in 6.0 als Bodenbeute (Teil K verlässt sich darauf) – aufgehoben kommen sie in den Rucksack
  if (L.ek && Array.isArray(E)) { const nw = E.filter(g => !L.ek.has(g.id)); if (nw.length) { SAVE.meta.pets.eggs = E.filter(g => L.ek.has(g.id)); $('toast').classList.remove('show'); for (const g of nw) lDrop(e.x, e.y, { t: 'egg', d: { egg: 1, sp: g.sp, tier: g.tier } }, .6); persist(); } }
  L.ek = null;
  const s = e.lw && e.lw.src, dep = lDepthAt(e.x, e.y);
  if (e.elite && !e.boss && Math.random() < .3) lDrop(e.x, e.y, { t: 'key' });
  if (e.elite && Math.random() < .25) lDrop(e.x, e.y, { t: 'item', it: lItem(2, 1.5) });
  if ((e.elite || e.boss) && Math.random() < (e.boss ? .5 : .06) * (1 + dep * 4)) { const m = lMod(dep, e.boss ? 2 : 1.3); if (m) lDrop(e.x, e.y, m); }
  if (e.boss && Math.random() < .1 + dep) lDrop(e.x, e.y, { t: 'stone' });
  if (e.elite && typeof birdRoll === 'function' && Math.random() < (e.boss ? .12 : .015) * (1 + dep * 2)) lDrop(e.x, e.y, { t: 'bird', k: birdRoll(dep) });
  if (!s) return;
  s.alive = Math.max(0, (s.alive || 0) - 1);
  if (s.left && s.state === 'act' && !s.alive && !s.left.length) {
    s.state = 'done'; if (s.sk) lTSet(s.sk, 'done'); lMisEvent('camp', s);
    if (s.mis || s.named || Math.random() < .5) { const list = [{ t: 'item', it: lItem(s.named ? 3 : 1, 1.8, s.st) }, { t: 'gold', n: Math.round(20 + Math.min(s.st, 150) * 6) }]; if (Math.random() < .25) list.push({ t: 'key' }); lBurst({ x: s.x, y: s.y }, list); }
    lBanner(s.named ? _t('BEUTE GESICHERT') : _t('LAGER GESÄUBERT'), _t('Die Gegend ist sicherer – sammle, was sie hinterlassen haben.')); sfx('clear');
  }
  if (s.list && s.state === 'act' && !s.alive) s.state = 'done';
  if (s.k === 'lair' && !s.alive) { s.ts = 1; s.act = false; lTSet(s.key, 1); M.bosses++; lMusic(); }
  if (s.k === 'end' && s.state === 'fight' && !s.alive) { s.state = 'open'; s.act = false; lTSet(s.key, 'won'); M.bosses++; lBanner(_t('DER WÄCHTER IST GEFALLEN'), _t('Der letzte Hort am Ende der Welt ist offen – geh zum Denkmal!')); sfx('clear'); lMusic(); $('bossbar').hidden = true; }
  if (s.k === 'tool' && s.state === 'fight' && !s.alive) { s.state = 'open'; s.act = false; lBanner(_t('DER HORT IST OFFEN'), _t('Hol dir {tool} vom Sockel!', { tool: LANDE_TOOLS[s.tk].n })); sfx('clear'); lMusic(); $('bossbar').hidden = true; }
  if (s.B && e.boss) {
    s.state = 'dead'; L.beast = null; M.bosses++; lMisEvent('boss', s); lMusic();
    const st = lStage(e.x, e.y), list = [{ t: 'item', it: lItem(3, 3) }, { t: 'item', it: lItem(2, 2.5) }, { t: 'item', it: lItem(2, 2) }, { t: 'gold', n: Math.round(120 + Math.min(st, 150) * 30) }, { t: 'key' }, { t: 'gem', k: randomGem(st + 10), n: 1 }];
    if (Math.random() < .05 + dep) list.push({ t: 'item', it: makeMythic() });
    if (Math.random() < .3) { const d = lEgg(2 + dep * 8); if (d) list.push({ t: 'egg', d }); }
    const k = lPart(st, .3); if (k) list.push({ t: 'part', k, n: 1 });
    lBurst(e, list); lBanner(_t('UNGEHEUER BEZWUNGEN'), _t('Schnapp dir die Beute – und dann nichts wie raus!'));
  }
  if (s.rival) {
    s.state = 'dead'; M.rivals++; lMisEvent('rival', s);
    lBurst(e, s.loot.concat([{ t: 'item', it: lItem(2, 2) }, { t: 'gold', n: Math.round(30 + Math.min(lStage(e.x, e.y), 150) * 8) }]));
    setTimeout(() => lBanner(_t('RIVALE BESIEGT'), _t('{name} lässt alles fallen, was er gesammelt hat.', { name: s.name })), 50);
  }
}

/* ---------- Zeichnen ---------- */
function lObjDraw(o) { return o.di || (o.di = { y: o.y, draw: () => lDraw(o) }); }
function lShadow(x, y, w) { ctx.fillStyle = 'rgba(0,0,0,.3)'; ctx.beginPath(); ctx.ellipse(x, y, w, w * .38, 0, 0, 6.283); ctx.fill(); }
const LROMAN = ['I', 'II', 'III', 'IV'];
function lToolImg(i) { return artIcon('lt_' + LANDE_TOOLS[i].key); }
function lDraw(o) {
  const x = Math.round(o.x - CX), y = Math.round(o.y - CY);
  switch (o.k) {
    case 'prop': {
      if ((o.gone || o.gh || o.nest) && gatherDraw(o, x, y)) return;   // gefällt, angeschlagen, Vogelnest (js/bauen.js)
      // Bild mit eingebackenem Schatten (ein drawImage je Baum); Spieler hinter der Krone: durchsichtig
      const s = lPropImg(o.t, o.v), behind = s.tree && P.y < o.y && P.y > o.y - s.h && Math.abs(P.x - o.x) < s.c.width / 2;
      if (behind) ctx.globalAlpha = .5; ctx.drawImage(s.c, x - s.ox, y - s.oy); ctx.globalAlpha = 1;
      if (o.t === 'sternbaum' || o.t === 'kristall' || o.t === 'glasbaum' || o.t === 'scherbe' || (o.t === 'pilz' || o.t === 'riesenpilz') && o.v === 1) addLight(x, y - (o.t === 'riesenpilz' ? 30 : 12), o.t === 'riesenpilz' ? 40 : 22, .45);
      return;
    }
    case 'mark': {
      if (o.t === 'kreis') { ctx.fillStyle = '#6a6672'; ctx.fillRect(x - 6, y - 3, 12, 6); ctx.fillStyle = '#8a8692'; ctx.fillRect(x - 5, y - 4, 10, 2); ctx.fillStyle = `rgba(87,199,230,${.4 + .3 * Math.sin(T * 3)})`; ctx.fillRect(x - 2, y - 3, 4, 2); addLight(x, y - 4, 26, .5); return; }
      const s = lSpr(o.t, 0); lShadow(x, y, s.width * .36);
      const behind = P.y < o.y && P.y > o.y - s.height && Math.abs(P.x - o.x) < s.width / 2; if (behind) ctx.globalAlpha = .5;
      ctx.drawImage(s, x - Math.floor(s.width / 2), y - s.height + 2); ctx.globalAlpha = 1;
      if (o.t === 'riese') addLight(x, y - 30, 40, .4); if (o.t === 'obelisk' || o.t === 'schrein') addLight(x, y - 20, 30, .5);
      return;
    }
    case 'spot': {
      if (o.t === 'kraut') { if (o.open) return; ctx.drawImage(lSpr('kraut', o.v), x - 7, y - 10); return; }
      if (o.t === 'versteck') { if (o.open) { ctx.fillStyle = '#3a2a1e'; ctx.fillRect(x - 4, y - 1, 8, 3); return; } const d = Math.hypot(o.x - P.x, o.y - P.y); if (d < 90 && Math.floor(T * 3 + o.x) % 3 === 0) { ctx.fillStyle = '#fff3c0'; ctx.fillRect(x, y - 2, 1, 1); ctx.fillRect(x - 1, y - 1, 3, 1); ctx.fillRect(x, y, 1, 1); } if (d < 90) { ctx.fillStyle = 'rgba(90,64,40,.55)'; ctx.fillRect(x - 3, y, 6, 2); } return; }
      if (o.t === 'rest') { ctx.globalAlpha = o.open ? .55 : 1; ctx.drawImage(lSpr('rest', 0), x - 11, y - 9); ctx.globalAlpha = 1; if (o.relic && !o.open) { addLight(x, y - 4, 22, .7); if (Math.random() < .2) part(o.x + rnd(-6, 6), o.y, rnd(2, 10), 0, 0, 20, '#57c7e6', .6, 1, -5, 1); } return; }
      const f = o.open ? Math.min(2, Math.floor(o.open * 3)) : 0; lShadow(x, y, 8);
      ctx.drawImage(lChestImg(o.t, f), x - 8, y - 14);
      if (!o.open) { addLight(x, y - 8, o.t === 'gold' ? 30 : o.t === 'fluch' ? 26 : 16, o.t === 'gold' ? .6 : .35); if (o.t === 'fluch' && Math.random() < .2) part(o.x + rnd(-7, 7), o.y, rnd(2, 12), 0, 0, rnd(10, 25), '#b060ff', .7, 1, -6, 1); if (o.t === 'gold' && Math.random() < .08) part(o.x + rnd(-6, 6), o.y - 8, rnd(2, 8), 0, 0, 15, '#ffe08a', .4, 1, 0, 1); }
      if (o.open && o.open < 1) o.open = Math.min(1, o.open + dt0 * 5);
      return;
    }
    case 'npc': lShadow(x, y, 6); drawNpc(o); if (o.role === 'mis' && LW.misDone) { const b = Math.round(Math.sin(T * 5) * 2); ptext('!', x, y - 34 + b, '#ffd24a', 8); } else if (o.role === 'mis' && !LW.misOn) { const b = Math.round(Math.sin(T * 5) * 2); ptext('?', x, y - 34 + b, '#57c7e6', 8); } return;
    case 'fire': case 'camp': {
      if (o.k === 'camp' && o.state === 'done') { ctx.fillStyle = '#2a2420'; ctx.fillRect(x - 6, y - 1, 12, 3); return; }
      const fr = Math.floor(T * 8 + o.x); ctx.fillStyle = WOOD[0]; ctx.fillRect(x - 7, y - 2, 14, 3); ctx.fillStyle = WOOD[1]; ctx.fillRect(x - 6, y - 3, 5, 2); ctx.fillRect(x + 1, y - 3, 5, 2);
      ctx.fillStyle = '#ff6a2a'; ctx.fillRect(x - 4, y - 8 - fr % 2, 8, 6); ctx.fillStyle = '#ffb03a'; ctx.fillRect(x - 2, y - 11 + (fr % 3 ? 0 : 1), 4, 5); ctx.fillStyle = '#fff0a0'; ctx.fillRect(x - 1, y - 7, 2, 3);
      addLight(x, y - 6, 60, 1); if (Math.random() < .25) part(o.x + rnd(-3, 3), o.y, 8, rnd(-5, 5), 0, rnd(20, 40), Math.random() < .5 ? '#ffb03a' : '#ff6a2a', .6, 1, -20, 1);
      return;
    }
    case 'exit': {
      const open = lExitOpen(o), col = o.t === 'tor' ? '#6ae08a' : o.t === 'mond' ? '#8ab8ff' : o.t === 'schluessel' ? '#ffd24a' : o.t === 'rolle' ? '#e8dcc0' : '#57e6c8';
      ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.beginPath(); ctx.ellipse(x, y + 1, 16, 5, 0, 0, 6.283); ctx.fill();
      if (o.t !== 'rolle') {
        const big = o.t === 'tor' ? 1.25 : 1, w = Math.round(15 * big), h = Math.round(34 * big);
        ctx.fillStyle = o.t === 'tor' ? '#4a4652' : '#3e4a4a'; ctx.fillRect(x - w, y - h, 5, h + 1); ctx.fillRect(x + w - 5, y - h, 5, h + 1); ctx.fillStyle = o.t === 'tor' ? '#6a6672' : '#5a6a66'; ctx.fillRect(x - w - 1, y - h - 3, w * 2 + 2, 5); ctx.fillStyle = '#8a9692'; ctx.fillRect(x - w - 1, y - h - 3, w * 2 + 2, 1);
        ctx.fillStyle = col; for (let i = 0; i < 3; i++) { ctx.fillRect(x - w + 2, y - h + 6 + i * 9, 1, 2); ctx.fillRect(x + w - 3, y - h + 10 + i * 9, 1, 2); }
      }
      if (o.t === 'schluessel' && !o.open) { ctx.fillStyle = '#3a3440'; ctx.fillRect(x - 10, y - 32, 20, 32); ctx.fillStyle = '#e8b04a'; ctx.fillRect(x - 2, y - 18, 4, 5); ctx.fillStyle = '#1a1420'; ctx.fillRect(x - 1, y - 17, 2, 2); return; }
      if (open) { ctx.globalAlpha = .9; drawFxFrame('ring', Math.floor(T * 12) % 14, x, y - 16, o.t === 'tor' ? .75 : .6, 0, false, tintedFx('ring', col)); ctx.globalAlpha = 1; const [r, g, b] = hexRgb(col); ctx.fillStyle = `rgba(${r},${g},${b},${.2 + .1 * Math.sin(T * 4)})`; ctx.fillRect(x - 10, y - 30, 20, 30); addLight(x, y - 14, 60, 1); if (Math.random() < .3) part(o.x + rnd(-9, 9), o.y, rnd(0, 26), 0, 0, rnd(10, 30), col, .7, 1, -8, 1); }
      else { ctx.fillStyle = 'rgba(20,16,30,.8)'; ctx.fillRect(x - 10, y - 30, 20, 30); ctx.fillStyle = 'rgba(138,184,255,.25)'; ctx.fillRect(x - 10, y - 30, 20, 30 * ((LW.t + o.ph) % 80 - 40) / 40); addLight(x, y - 14, 30, .4); }
      return;
    }
    case 'beacon': {
      lShadow(x, y, 8); const s = lSpr('feuer', 0); ctx.drawImage(s, x - Math.floor(s.width / 2), y - s.height + 2);
      const fr = Math.floor(T * 9 + o.x); ctx.fillStyle = '#ff6a2a'; ctx.fillRect(x - 4, y - 33 - fr % 2, 8, 6); ctx.fillStyle = '#ffd24a'; ctx.fillRect(x - 2, y - 36 + (fr % 3 ? 0 : 1), 4, 5); ctx.fillStyle = '#fff8d0'; ctx.fillRect(x - 1, y - 32, 2, 3);
      addLight(x, y - 30, 80, 1); if (Math.random() < .35) part(o.x + rnd(-3, 3), o.y, 30, rnd(-5, 5), 0, rnd(20, 40), Math.random() < .5 ? '#ffd24a' : '#ff8a3a', .7, 1, -16, 1);
      return;
    }
    case 'lair': { const s = lSpr('hort', 0); ctx.drawImage(s, x - 22, y - 26); if (!o.ts) { addLight(x, y - 10, 30, .5); if (Math.random() < .1) part(o.x + rnd(-10, 10), o.y - 6, rnd(0, 8), 0, 0, 20, '#ff5a4a', .6, 1, -6, 1); } return; }
    case 'end': {
      const s = lSpr('weltende', 0), open = o.state === 'open'; lShadow(x, y, 20); ctx.drawImage(s, x - 23, y - 74);
      const p = .6 + .4 * Math.sin(T * 2.4); addLight(x, y - 36, 70 + p * 20, open ? 1 : .8); if (Math.random() < .25) part(o.x + rnd(-6, 6), o.y - 30, rnd(0, 20), rnd(-10, 10), 0, rnd(10, 30), Math.random() < .5 ? '#ffd24a' : '#b892f4', .9, 1, -8, 1);
      if (open) { ctx.globalAlpha = .5 + .3 * Math.sin(T * 5); ctx.fillStyle = '#ffd24a'; ctx.fillRect(x - 12, y - 4, 24, 3); ctx.globalAlpha = 1; }
      return;
    }
    case 'tool': {
      const s = lSpr('sockel', 0); lShadow(x, y, 10); ctx.drawImage(s, x - 10, y - 14);
      if (o.state !== 'done' && !lToolBit(o.tk)) { const img = lToolImg(o.tk), b = Math.round(Math.sin(T * 3) * 2), open = o.state === 'open'; ctx.globalAlpha = open ? 1 : .55; ctx.drawImage(img, x - 8, y - 32 + b); ctx.globalAlpha = 1; addLight(x, y - 24, open ? 50 : 26, open ? 1 : .5); if (open && Math.random() < .3) part(o.x + rnd(-6, 6), o.y - 10, rnd(10, 30), 0, 0, 25, LANDE_TOOLS[o.tk].c, .7, 1, -10, 1); }
      return;
    }
    case 'rune': { ctx.drawImage(lSpr('rune', 0), x - 6, y - 13); const lit = o.on || o.site.state === 'open' || o.site.state === 'done'; ptext(LROMAN[o.n], x, y - 6, lit ? '#9ae8ff' : '#6a6672', 6); if (lit) addLight(x, y - 8, 22, .8); return; }
    case 'mile': { ctx.drawImage(lSpr('meile', 0), x - 6, y - 14); return; }
    case 'cross': { const own = o.need < 0 || lToolBit(o.need); ctx.fillStyle = WOOD[0]; ctx.fillRect(x - 1, y - 18, 2, 18); ctx.fillStyle = own ? '#3a6a3a' : '#6a2a2a'; ctx.fillRect(x - 9, y - 28, 18, 12); ctx.fillStyle = own ? '#79c24e' : '#ff6a5a'; ctx.fillRect(x - 9, y - 28, 18, 1); if (o.need >= 0) ctx.drawImage(lToolImg(o.need), x - 6, y - 28, 12, 12); else { ctx.fillStyle = '#efe2bf'; ctx.fillRect(x - 5, y - 23, 10, 2); } return; }
    case 'enc': { const a = .5 + .4 * Math.sin(T * 4); ctx.globalAlpha = a; ctx.fillStyle = '#b892f4'; for (let i = 0; i < 6; i++) { const an = T * 2 + i * 1.05; ctx.fillRect(Math.round(x + Math.cos(an) * 9), Math.round(y - 10 + Math.sin(an) * 5), 2, 2); } ctx.globalAlpha = 1; ptext('?', x, y - 22 + Math.round(Math.sin(T * 3) * 2), '#e0c8ff', 8); addLight(x, y - 10, 34, .8); return; }
    case 'arte': { const b = Math.round(Math.sin(T * 3 + o.x) * 2); ctx.drawImage(lSpr('relikt', 0), x - 6, y - 16 + b); addLight(x, y - 10, 26, .9); if (Math.random() < .12) part(o.x + rnd(-5, 5), o.y, rnd(4, 14), 0, 0, 20, '#ffe08a', .6, 1, -6, 1); return; }
    case 'arteT': { const rd = !!o.s.ready; ctx.fillStyle = rd ? '#ffd24a' : '#8a2a26'; for (let i = -5; i <= 5; i++) { ctx.fillRect(x + i, y + i * .5, 2, 1); ctx.fillRect(x - i, y + i * .5, 2, 1); } addLight(x, y, rd ? 30 : 18, rd ? .9 : .4); if (Math.random() < (rd ? .2 : .05)) part(o.x + rnd(-5, 5), o.y, rnd(2, 8), 0, 0, 20, rd ? '#ffd24a' : '#c8342c', .6, 1, -4, 1); return; }
  }
}
// Rivale als Held gezeichnet (charStrip): Bild 0–3 Ruhe, 4–7 Laufen, 8 Treffer
function lHero(look, x, y, face, moving, hit) {
  const st = charStrip(look), fi = hit && st.hasHit ? 8 : moving ? 4 + Math.floor(T * 10) % 4 : Math.floor(T * 6) % 4;
  ctx.save(); ctx.translate(Math.round(x), Math.round(y)); ctx.scale(face < 0 ? -1 : 1, 1); ctx.drawImage(hit ? st.sil : st.c, fi * st.w, 0, st.w, st.h, -st.w / 2, -st.h, st.w, st.h); ctx.restore();
  return st.h;
}
function lDrawTok(r, rival) {
  const x = Math.round(r.x - CX), y = Math.round(r.y - CY); if (x < -30 || y < -40 || x > VW + 30 || y > VH + 30) return;
  lShadow(x, y, 5);
  let h;
  if (r.look) h = lHero(r.look, x, y, r.tx != null && r.tx < r.x ? -1 : 1, true, false);
  else { const sp = EN[r.type] ? EN[r.type].sp : 'knight', fr = frameRect(sp, 'run', Math.floor(T * 10)); h = fr[3]; ctx.drawImage(SHEET, fr[0], fr[1], fr[2], fr[3], x - fr[2] / 2, y - fr[3], fr[2], fr[3]); }
  if (rival) { ctx.font = '8px "VT323", monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'bottom'; ctx.fillStyle = '#000'; ctx.fillText(r.name, x + 1, y - h - 1); ctx.fillStyle = '#ff8a3a'; ctx.fillText(r.name, x, y - h - 2); }
}
function lPickDraw(c) {
  const x = Math.round(c.x - CX), y = Math.round(c.y - CY), z = Math.round(c.z + Math.sin(c.t * 5) + 2);
  if (c.k === 'lpart') { const p = typeof pparse === 'function' ? pparse(c.pk) : null, img = p && typeof partArt === 'function' ? partArt(p.t, p.g, p.el) : lSpr('relikt', 0); ctx.drawImage(img, x - img.width / 2, y - z - img.height + 2); addLight(x, y - 8, 16, .5); }
  else if (c.k === 'legg') { ctx.drawImage(lSpr('ei', 0), x - 5, y - z - 13); addLight(x, y - 8, 26, .8); if (Math.random() < .1) part(c.x + rnd(-4, 4), c.y, rnd(4, 14), 0, 0, 15, '#ffd24a', .5, 1, 0, 1); }
  else if (c.k === 'lkey') { ctx.drawImage(lSpr('schl', 0), x - 7, y - z - 8); addLight(x, y - 6, 16, .6); }
  else if (c.k === 'lmap') ctx.drawImage(lSpr('karte', 0), x - 7, y - z - 11);
  else if (c.k === 'lrel') { ctx.drawImage(lSpr('relikt', 0), x - 6, y - z - 13); addLight(x, y - 8, 26, .9); }
  else if (c.k === 'lstone') { ctx.drawImage(lSpr('lstein', 0), x - 6, y - z - 13); addLight(x, y - 8, 30, 1); if (Math.random() < .2) part(c.x + rnd(-4, 4), c.y, rnd(4, 14), 0, 0, 15, '#ff8a3a', .5, 1, -6, 1); }
  else if (c.k === 'lmod') { let img = null; try { if (typeof modIconURL === 'function') { const u = modIconURL(c.mk); if (u) { LMODIMG[u] = LMODIMG[u] || Object.assign(new Image(), { src: u }); img = LMODIMG[u].complete ? LMODIMG[u] : null; } } } catch (_) { } ctx.drawImage(img || lSpr('mod', 0), x - 6, y - z - 13); addLight(x, y - 8, 22, .8); }
}
const LMODIMG = {};
const LPICK = new Set(['lpart', 'legg', 'lkey', 'lmap', 'lrel', 'lstone', 'lmod']);
HOOK.draw.push(list => {
  if (!LW || !G || G.type !== 'lande') return;
  const L = LW, x0 = CX - 60, x1 = CX + VW + 60, y0 = CY - 30, y1 = CY + VH + 70, N = lNear((x0 + x1) / 2, (y0 + y1) / 2, Math.max(x1 - x0, y1 - y0) / 2);
  for (let i = 0; i < N.length; i++) { const o = N[i]; if (o.x < x0 || o.x > x1 || o.y < y0 || o.y > y1 || o.k === 'vein') continue; const d = lObjDraw(o); d.y = o.k === 'spot' && o.t !== 'kraut' ? o.y - 1 : o.k === 'lair' || o.k === 'arteT' || o.k === 'rune' ? o.y - 20 : o.y; list.push(d); }
  for (const c of pickups) if (LPICK.has(c.k)) { c.di = c.di || { y: 0, draw: () => lPickDraw(c) }; c.di.y = c.y; list.push(c.di); }
  for (const r of L.rivals) if (r.state === 'roam') { r.di = r.di || { y: 0, draw: () => lDrawTok(r, true) }; r.di.y = r.y; list.push(r.di); }
  for (const p of L.pats) if (p.state === 'dorm' && p.list.length && Math.abs(p.x - P.x) < VW && Math.abs(p.y - P.y) < VH) { p.di = p.di || { y: 0, draw: () => lDrawTok({ x: p.x, y: p.y, type: p.list[0].t }, false) }; p.di.y = p.y; list.push(p.di); }
});
HOOK.drawEnemy.push(e => {
  if (!LW || !LW.on || !(e.rival || (e.boss && e.lw && e.lw.src && e.lw.src.B))) return;
  if (e.rival && e.rival.look && e.st !== 'spawn') lHero(e.rival.look, e.x - CX, e.y - CY - (e.z || 0), e.turn, e.moving, e.flash > 0);
  const x = Math.round(e.x - CX), y = Math.round(e.y - CY) - Math.round((SP[e.sp].h + 6) * e.sc) - Math.round(e.z);
  ctx.font = '8px "VT323", monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'bottom'; ctx.fillStyle = '#000'; ctx.fillText(e.name, x + 1, y + 1); ctx.fillStyle = e.rival ? '#ff8a3a' : '#ff5a4a'; ctx.fillText(e.name, x, y);
});

/* ---------- Überlagerung: Kompass, Kanal, Namen ---------- */
function lArrow(a, dist, col, R, big) {
  const cx = P.x - CX, cy = P.y - CY - 10, x = Math.round(cx + Math.cos(a) * R), y = Math.round(cy + Math.sin(a) * R * .85), s = big ? 1 : .75, bob = Math.sin(T * 6) * 1.5;
  ctx.save(); ctx.translate(x + Math.cos(a) * bob, y + Math.sin(a) * bob); ctx.rotate(a); ctx.scale(s, s);
  ctx.beginPath(); ctx.moveTo(7, 0); ctx.lineTo(-4, -6); ctx.lineTo(-1, 0); ctx.lineTo(-4, 6); ctx.closePath();
  ctx.lineWidth = 3; ctx.strokeStyle = '#120e18'; ctx.lineJoin = 'round'; ctx.stroke(); ctx.fillStyle = col; ctx.fill(); ctx.restore();
  if (dist != null) ptext(lKm(dist), x, y + (Math.sin(a) > -.2 ? 13 : -12), col, 6);
}
HOOK.postRender.push(() => {
  const on = !!(LW && LW.on && G && G.type === 'lande');
  lHudShow(on && (state === 'play' || state === 'dead'));
  if (on && state === 'pause' && !panel.querySelector('[data-act="l_inv"]')) lPauseFix();
  if (!on || state !== 'play') return;
  const L = LW, N = lNear(P.x, P.y, 260);
  // Namen über Händlern, Ausgängen, Horten, Übergängen
  for (let i = 0; i < N.length; i++) {
    const o = N[i], x = o.x - CX, y = o.y - CY; if (x < -40 || x > VW + 40 || y < -20 || y > VH + 60) continue;
    const bob = Math.round(Math.sin(T * 4) * 2);
    if (o.k === 'npc') ptext(o === L.near ? o.name : LNPC[o.role].hi, x, y - 42, o === L.near ? '#ffd24a' : LNPC[o.role].c, 6);
    else if (o.k === 'exit') { const open = lExitOpen(o); ptext(o.t === 'tor' ? _t('WELTENTOR') : o.t === 'schluessel' && !o.open ? _t('SCHLÜSSELTOR') : o.t === 'mond' ? (open ? _t('MONDTOR · OFFEN') : _t('MONDTOR · ZU')) : _t('TOR DER ALTEN'), x, y - (o.t === 'tor' ? 56 : 46) + bob, open ? '#8ef0a8' : '#c8c0d8', 6); }
    else if (o.k === 'beacon') ptext(_t('LEUCHTFEUER'), x, y - 46 + bob, '#ffd24a', 6);
    else if (o.k === 'tool' && o.state !== 'done' && !lToolBit(o.tk)) ptext(LANDE_TOOLS[o.tk].n.toLocaleUpperCase(LOCALE), x, y - 42 + bob, LANDE_TOOLS[o.tk].c, 6);
    else if (o.k === 'end') ptext(_t('ENDE DER WELT'), x, y - 86 + bob, '#ffd24a', 6);
    else if (o.k === 'lair' && !o.ts && Math.hypot(o.x - P.x, o.y - P.y) < 200) ptext(_t('HORT'), x, y - 34, '#ff6a5a', 6);
    else if (o.k === 'cross' && Math.hypot(o.x - P.x, o.y - P.y) < 150) { const own = o.need < 0 || lToolBit(o.need); ptext(o.need < 0 ? _t('BRÜCKE') : (own ? '✓ ' : '✗ ') + LANDE_TOOLS[o.need].n.toLocaleUpperCase(LOCALE), x, y - 34, own ? '#8ef0a8' : '#ff8a7a', 6); }
    else if (o.k === 'mile' && Math.hypot(o.x - P.x, o.y - P.y) < 90) ptext(_t('{n} KM', { n: o.km }), x, y - 22, '#efe2bf', 6);
  }
  // Kompass: Ausgang/Leuchtfeuer (golden), Auftrag (blau), Übergang (lila)
  if ((L.exT = (L.exT || 0) - dt0) <= 0) { L.exT = .5; L.ex = lNearExit(); }
  const ex = L.ex; let ea = null;
  if (ex) { const dx = ex.x - P.x, dy = ex.y - P.y, d = Math.hypot(dx, dy); if (d > 130) { ea = Math.atan2(dy, dx); lArrow(ea, d, ex.k === 'beacon' || lExitOpen(ex) ? '#ffd24a' : '#a8a0b8', 34, true); } }
  const tg = lMisTarget();
  if (tg) { const dx = tg.x - P.x, dy = tg.y - P.y, d = Math.hypot(dx, dy); if (d > 90) { const a = Math.atan2(dy, dx); lArrow(a, null, '#57c7e6', ea != null && Math.abs(angDiff(a, ea)) < .5 ? 50 : 34, false); } }
  if (L.hint && T < L.hint.until) { const dx = L.hint.x - P.x, dy = L.hint.y - P.y, d = Math.hypot(dx, dy); if (d > 40) lArrow(Math.atan2(dy, dx), d, '#c890ff', 62, false); else L.hint = null; }
  // Kanal am Ausgang
  if (L.chEx && L.ch > 0) { const p = L.ch / lChannel(L.chEx), x = P.x - CX, y = P.y - CY - 12; ctx.strokeStyle = 'rgba(0,0,0,.6)'; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(x, y, 18, 0, 6.283); ctx.stroke(); ctx.strokeStyle = L.chEx.k === 'beacon' ? '#ffd24a' : '#8ef0a8'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(x, y, 18, -Math.PI / 2, -Math.PI / 2 + p * 6.283); ctx.stroke(); }
  if (L.digO && !L.digO.open) { const x = L.digO.x - CX, y = L.digO.y - CY; ptext(L.dig > 0 ? _t('GRABEN …') : _t('HIER IST WAS VERGRABEN'), x, y - 22, '#ffe08a', 6); if (L.dig > 0) { ctx.fillStyle = '#000'; ctx.fillRect(x - 12, y - 16, 24, 3); ctx.fillStyle = '#ffd24a'; ctx.fillRect(x - 12, y - 16, Math.round(24 * L.dig / 1.4), 3); } }
  // Interagieren-Knopf
  const b = $('bAct'), near = L.near;
  if (near !== L.bnear) { L.bnear = near; b.hidden = !near; if (near) { b.querySelector('img').src = iconURL(['pa', LNPC[near.role].icon]); b.setAttribute('aria-label', near.name); } }
  if (near && !isTouch) ptext('[E]', near.x - CX, near.y - CY - 32, '#efe2bf', 6);
  lHudTick();
});
function lMisTarget() {
  const L = LW;
  if (!L.misOn) return null;
  if (L.misDone) { let b = null, bd = 1e9; for (const o of lNear(P.x, P.y, 900)) if (o.k === 'npc' && o.role === 'mis') { const d = Math.hypot(o.x - P.x, o.y - P.y); if (d < bd) { bd = d; b = o; } } if (b) return b; }
  for (const m of L.mis) { if (m.done) continue; if (m.tgt && m.tgt.state !== 'done' && !m.tgt.open) return m.tgt; if (m.site) return { x: m.site.x + LOFF, y: m.site.y + LOFF }; if (m.t === 'explore') return { x: m.tx + LOFF, y: m.ty + LOFF }; }
  return null;
}

/* ---------- HUD (oben rechts): Karte, Tageszeit, Stufe, Rucksack, Leuchtfeuer ---------- */
document.head.insertAdjacentHTML('beforeend', `<style>
#lhud{zoom:var(--ui);position:fixed;top:calc(var(--sat) + 8px);right:calc(max(16px,var(--sar)) + 46px);z-index:5;display:flex;flex-direction:row-reverse;gap:6px;align-items:flex-start;pointer-events:none;font-family:var(--f-display);font-size:8px}
#lhMap{width:88px;height:88px;image-rendering:pixelated;background:#0c0a10;box-shadow:0 0 0 2px var(--night),0 0 0 3px var(--parch-dim);pointer-events:auto;cursor:pointer;touch-action:none}
#lhud .lc{display:grid;gap:4px;justify-items:end}
#lhud .lr{display:flex;gap:4px}
#lhud .lp{display:flex;align-items:center;gap:5px;background:rgba(17,14,23,.85);padding:4px 6px;box-shadow:0 0 0 2px var(--night);white-space:nowrap;text-shadow:1px 1px 0 #000;color:var(--parch)}
#lhud button.lp{border:0;pointer-events:auto;cursor:pointer;font:inherit;min-height:34px;min-width:44px}
#lhud .lp img{width:16px;height:16px;image-rendering:pixelated}
#lhud .full{color:#ff6a5a}
#lhud .pop img{animation:pop .25s steps(3)}
#lhud .dim{opacity:.55}
#lhMis{max-width:150px;white-space:normal;text-align:right;font-family:var(--f-body);font-size:15px;line-height:1;color:#9ad8ee;text-shadow:1px 1px 0 #000}
#lhReg{max-width:150px;white-space:normal;text-align:right;font-family:var(--f-body);font-size:14px;line-height:1;color:var(--parch-dim);text-shadow:1px 1px 0 #000}
@media (orientation:portrait){#lhud{flex-direction:column;align-items:flex-end}#lhud .lc{justify-items:end}}
body.lande .hud-r .info{display:none}
body.lande #combo{top:calc(var(--sat) + 170px)}
body.lande #objective{top:calc(var(--sat) + 104px);left:calc(50% - 40px)}
body.lande #bossbar{top:calc(var(--sat) + 56px);left:max(16px,var(--sal));transform:none;width:calc(100vw / var(--ui) - 172px)}
@media (orientation:landscape){body.lande #objective{top:calc(var(--sat) + 52px)}body.lande #bossbar{top:calc(var(--sat) + 60px);left:max(90px,calc(var(--sal) + 74px));width:min(420px,calc(100vw / var(--ui) - 380px))}}
.lgot>div{animation:lgot .35s steps(4) both}
@keyframes lgot{0%{opacity:0;transform:translateY(6px)}100%{opacity:1;transform:none}}
.lslot.gone{cursor:default}.lslot.gone img{filter:grayscale(.6) brightness(.8)}
.lslot.gone:after{content:"";position:absolute;inset:18%;background:linear-gradient(45deg,transparent 45%,#c8463c 45%,#c8463c 55%,transparent 55%),linear-gradient(-45deg,transparent 45%,#c8463c 45%,#c8463c 55%,transparent 55%);opacity:.85}
.lrules{display:grid;gap:4px;margin:6px 0 10px}
.lrules div{background:var(--stone-lo);padding:6px 8px;font-size:17px;line-height:1.1;box-shadow:inset 3px 0 0 var(--c)}
.lbar{height:8px;background:var(--stone-lo);box-shadow:0 0 0 2px var(--night);margin:4px 0 8px}
.lbar i{display:block;height:100%;background:#57c7e6}
.lmapw{display:grid;gap:10px;align-items:start}
.lmapc{position:relative;width:min(100%,460px);margin:0 auto}
.lmap{display:block;width:100%;aspect-ratio:1;image-rendering:pixelated;box-shadow:0 0 0 2px var(--night),0 0 0 3px var(--parch-dim);touch-action:none;background:#0c0a10}
.lmapz{position:absolute;right:6px;top:6px;display:grid;gap:6px}
.lmapz .btn{min-width:44px;min-height:44px;padding:0;font-size:18px}
.lmapn{position:absolute;left:6px;bottom:6px;font-family:var(--f-body);font-size:15px;color:var(--parch);text-shadow:1px 1px 0 #000;pointer-events:none}
@media (orientation:landscape){.lmapw{grid-template-columns:auto minmax(0,1fr)}.lmapc{width:min(460px,calc(100vh / var(--ui) - 96px),calc(100dvh / var(--ui) - 96px));margin:0}.lleg{justify-content:flex-start}}
.lleg{display:flex;flex-wrap:wrap;gap:8px;font-size:16px;color:var(--parch-dim);justify-content:center;margin-bottom:6px}
.lleg i{display:inline-block;width:9px;height:9px;margin-right:4px;box-shadow:0 0 0 1px #000;vertical-align:0}
.lleg img{width:14px;height:14px;image-rendering:pixelated;vertical-align:-2px;margin-right:3px}
.lslot{position:relative;aspect-ratio:1;background:var(--stone-lo);border:0;display:grid;place-items:center;cursor:pointer;padding:0}
.lslot img{width:70%;height:70%;object-fit:contain;image-rendering:pixelated}
.lslot .n{position:absolute;right:3px;bottom:2px;font-family:var(--f-display);font-size:7px;text-shadow:1px 1px 0 #000;color:var(--parch)}
.lslot.empty{cursor:default;background:rgba(10,8,14,.35);box-shadow:inset 0 0 0 2px var(--stone-hi)}
.lgear .lslot{width:60px;height:60px;margin:4px auto 0}
.lfoot{grid-template-columns:1fr 1fr}.lfoot .wide{grid-column:1/-1}
@media (min-width:600px){.lfoot{grid-template-columns:2fr 1fr 1fr}.lfoot .wide{grid-column:auto}}
.lnw+.lpk{margin-top:10px}.side .lwd{margin-bottom:10px}
.lslot.lfree{font-family:var(--f-display);font-size:8px;color:var(--parch-dim);text-align:center;line-height:1.4;padding:2px}
.lpouch{margin-top:10px;box-shadow:inset 0 0 0 2px var(--gold-dk)}.lpdim{font-family:var(--f-body);font-size:17px;color:var(--parch-dim)}
.lpg{display:grid;grid-template-columns:repeat(auto-fill,minmax(46px,1fr));gap:5px}.lpg .lslot .n{font-size:8px}
#lhPo{min-height:30px;gap:4px}#lhPo img+span{margin-right:2px}
.lgmini{padding:6px}.lgmini .lgear>div:first-child{display:none}.lgmini .lgear .lslot{width:46px;height:46px;margin:0 auto}
@media (min-width:600px){.lnw{display:none}}
@media (max-width:599px){.lwd{display:none}}
body.touch .lslot .n{font-size:8px}
.lmis{background:var(--stone-lo);padding:7px 9px;margin-bottom:6px;box-shadow:inset 3px 0 0 var(--c)}
.lmis .nm{font-size:19px;line-height:1.05}
.lmis .st{font-size:15px;color:var(--parch-dim)}
.ltools{display:grid;grid-template-columns:repeat(auto-fill,minmax(44px,1fr));gap:6px;margin:4px 0 10px}
.ltools div{aspect-ratio:1;background:var(--stone-lo);display:grid;place-items:center;box-shadow:inset 0 0 0 2px var(--c)}
.ltools div.no{opacity:.35;filter:grayscale(1)}
.ltools img{width:70%;height:70%;image-rendering:pixelated}
.lstart .opt{text-align:left;line-height:1.5}
.lstart .opt small{display:block}
</style>`);
document.body.insertAdjacentHTML('beforeend', `<div id="lhud" hidden><canvas id="lhMap" width="96" height="96" aria-label="${_t('Karte')}"></canvas><div class="lc"><div class="lp"><b id="lhD">${LDNG[0].n}</b><span id="lhT">0:00</span><b id="lhSt">6</b></div><div class="lr"><button class="lp" id="lhCp" aria-label="${_t('Leuchtfeuer setzen')}" hidden><img src="" alt=""><span id="lhCpn">0</span></button><button class="lp" id="lhPack" aria-label="${_t('Rucksack')}"><img src="" alt=""><span id="lhP">0/20</span></button></div><button class="lp" id="lhPo" aria-label="${_t('Sammelbeutel')}"><img src="" alt=""><span id="lhPg">0</span><img src="" alt="" id="lhPoM"><span id="lhPm">0</span></button><div class="lp" id="lhK" hidden><img src="" alt=""><span id="lhKn">0</span></div><div id="lhReg"></div><div id="lhMis"></div></div></div>`);
const LH = { on: false, c: {} };
function lHudShow(on) { if (LH.on === on) return; LH.on = on; $('lhud').hidden = !on; if (on) { $('lhPack').querySelector('img').src = iconURL(['pa', 'l_pack']); $('lhPo').querySelector('img').src = iconURL(['pa', 'l_gold']); $('lhPoM').src = iconURL(['pa', 'l_beutel']); $('lhK').querySelector('img').src = iconURL(['pa', 'l_schl']); $('lhCp').querySelector('img').src = iconURL(['pa', 'l_feuer']); LH.c = {}; } }
function lSetH(id, v) { if (LH.c[id] !== v) { LH.c[id] = v; $(id).textContent = v; } }
function lClock(t) { return Math.floor(t / 60) + ':' + String(Math.floor(t % 60)).padStart(2, '0'); }
function lHudTick() {
  const L = LW; if ((L.hudT -= dt0) > 0) return; L.hudT = .2;
  const ph = L.danger, p = (L.t / LDAY) % 1, nxt = ph === 0 ? .6 : ph === 1 ? .67 : ph === 2 ? .95 : 1, left = (nxt - p) * LDAY, D = LDNG[ph];
  lSetH('lhD', D.n); $('lhD').style.color = D.c; lSetH('lhT', lClock(left));
  const st = lStage(P.x, P.y), rt = lRate(st); lSetH('lhSt', _t('ST. {n}', { n: st })); $('lhSt').style.color = rt.c;
  const cap = lCap(); lPouch(); lSetH('lhP', L.pack.length + '/' + cap); $('lhPack').classList.toggle('full', L.pack.length >= cap);
  let pm = 0; for (const k in L.pouch) if (k !== 'gold') pm += L.pouch[k] || 0; lSetH('lhPg', fmt(L.pouch.gold || 0)); lSetH('lhPm', fmt(pm));
  const M = lMeta(), k = M.keys; $('lhK').hidden = !k; lSetH('lhKn', String(k));
  $('lhCp').hidden = !M.stones; lSetH('lhCpn', String(M.stones)); $('lhCp').classList.toggle('dim', lDanger() || lCpBlock() !== '');
  lSetH('lhReg', L.reg ? lRegName(L.reg) : '');
  const m = !L.misOn ? '' : L.misDone ? _t('Belohnung bei einer Kundschafterin') : (L.mis.find(x => !x.done) || {}).txt || '';
  const mt = L.mis.find(x => !x.done && x.n > 1); lSetH('lhMis', m + (mt && L.misOn && !L.misDone && m === mt.txt ? ' ' + mt.c + '/' + mt.n : ''));
  L.misDone = L.misOn && L.mis.some(x => x.done && !x.paid && x.t !== 'mats');
  if ((L.mapT -= .2) <= 0) { L.mapT = .2; lMiniDraw($('lhMap'), 96); }
}
// Kleine Pixelzeichen mit dunklem Rand, gut lesbar auch auf dem Handy
function lIconPx(g, X0, Y0, pat, col, edge, m) {
  const w = pat[0].length, h = pat.length, ox_ = Math.round(X0) - Math.floor(w * m / 2), oy_ = Math.round(Y0) - Math.floor(h * m / 2);
  for (const [dx, dy, c] of [[-1, 0, '#000'], [1, 0, '#000'], [0, -1, '#000'], [0, 1, '#000'], [0, 0, col]]) { g.fillStyle = c; for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) if (pat[j][i] === '#') g.fillRect(ox_ + i * m + dx, oy_ + j * m + dy, m, m); }
  if (edge) { g.fillStyle = edge; for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) if (pat[j][i] === 'o') g.fillRect(ox_ + i * m, oy_ + j * m, m, m); }
}
const LPAT = { DOT: ['##', '##'], RING: ['.###.', '#ooo#', '#ooo#', '#ooo#', '.###.'], DIA: ['..#..', '.###.', '#####', '.###.', '..#..'], CAMP: ['#.#', '.#.', '#.#'], SKULL: ['.###.', '#####', '#o#o#', '#####', '.#.#.'], STAR: ['..#..', '.###.', '#####', '.#.#.'], FIRE: ['..#..', '.###.', '.#o#.', '#####'], TENT: ['..#..', '.###.', '##o##', '#ooo#'], PED: ['.###.', '#ooo#', '.###.', '#####'], END: ['.#.#.', '#####', '#o.o#', '#o.o#', '#####'] };
// Minikarte: das Gelände der geladenen Chunks, der Held in der Mitte
function lMiniDraw(cv, sz) {
  const L = LW, g = cv.getContext('2d'); g.imageSmoothingEnabled = false; g.fillStyle = '#0c0a10'; g.fillRect(0, 0, sz, sz);
  const view = 1100, sc = sz / view, ox = P.x - view / 2, oy = P.y - view / 2, X = x => (x - ox) * sc, Y = y => (y - oy) * sc;
  for (const r of L.cm.values()) { const x = X(r.X0), y = Y(r.Y0), s = LCK * sc; if (x > sz || y > sz || x + s < 0 || y + s < 0) continue; g.drawImage(lMini(r.d), Math.floor(x), Math.floor(y), Math.ceil(s) + 1, Math.ceil(s) + 1); }
  const I = (x, y, pat, col, edge) => { const a = X(x), b = Y(y); if (a < -4 || b < -4 || a > sz + 4 || b > sz + 4) return false; lIconPx(g, a, b, LPAT[pat], col, edge, 1); return true; };
  for (const o of lNear(P.x, P.y, view / 2 + 40)) {
    switch (o.k) {
      case 'spot': if (!o.open && o.t !== 'versteck' && o.t !== 'kraut') I(o.x, o.y, o.relic ? 'STAR' : 'DOT', o.relic ? '#57c7e6' : LCH[o.t].lock ? '#9aa2ae' : o.t === 'fluch' ? '#c060ff' : o.t === 'gold' ? '#ffd24a' : '#e8b04a'); break;
      case 'camp': if (o.state !== 'done') I(o.x, o.y, o.mis ? 'STAR' : 'CAMP', o.mis ? '#57c7e6' : '#e8463c'); break;
      case 'mark': I(o.x, o.y, 'DIA', '#efe2bf'); break;
      case 'npc': if (o.role === 'mis') I(o.x, o.y, 'TENT', '#57c7e6', '#1a3a4a'); break;
      case 'exit': I(o.x, o.y, 'RING', lExitOpen(o) ? '#6ae08a' : o.t === 'schluessel' ? '#ffd24a' : '#8ab8ff', lExitOpen(o) ? '#1e6a3a' : '#1a1420'); break;
      case 'beacon': I(o.x, o.y, 'FIRE', '#ffd24a', '#ff6a2a'); break;
      case 'tool': if (!lToolBit(o.tk)) I(o.x, o.y, 'PED', LANDE_TOOLS[o.tk].c, '#1a1420'); break;
      case 'end': I(o.x, o.y, 'END', '#ffd24a', '#b892f4'); break;
      case 'lair': if (!o.ts) I(o.x, o.y, 'SKULL', '#ff6a5a', '#1a1420'); break;
      case 'cross': I(o.x, o.y, 'DIA', o.need < 0 || lToolBit(o.need) ? '#79c24e' : '#ff6a5a'); break;
      case 'enc': I(o.x, o.y, 'STAR', '#b892f4'); break;
      case 'arte': case 'arteT': I(o.x, o.y, 'STAR', '#ffe08a'); break;
    }
  }
  for (const r of L.rivals) if (r.state === 'roam' && Math.hypot(r.x - P.x, r.y - P.y) < 340) I(r.x, r.y, 'DIA', '#ff8a3a');
  const B = L.beast;
  if (B && (B.state === 'roam' || B.state === 'act')) {
    const e = B.state === 'act' ? enemies.find(x => x.lw && x.lw.src === B) : null, bx = e ? e.x : B.x, by = e ? e.y : B.y, p = Math.floor(T * 3) % 2;
    if (!I(bx, by, 'SKULL', p ? '#ffffff' : '#ff6a5a', '#c8342c')) { const a = Math.atan2(by - P.y, bx - P.x), ex_ = Math.round(sz / 2 + Math.cos(a) * (sz / 2 - 5)), ey = Math.round(sz / 2 + Math.sin(a) * (sz / 2 - 5)); g.fillStyle = '#000'; g.fillRect(ex_ - 3, ey - 3, 6, 6); g.fillStyle = p ? '#ff4a3a' : '#ffffff'; g.fillRect(ex_ - 2, ey - 2, 4, 4); }
  }
  lHeroArrow(g, sz / 2, sz / 2, 1.1);
  g.strokeStyle = 'rgba(239,226,191,.3)'; g.lineWidth = 1; g.strokeRect(.5, .5, sz - 1, sz - 1);
}
function lHeroArrow(g, hx, hy, k) { const a = Math.hypot(P.vx, P.vy) > 8 ? Math.atan2(P.vy, P.vx) : (P.face || 1) > 0 ? 0 : Math.PI; g.save(); g.translate(hx, hy); g.rotate(a); g.scale(k, k); g.beginPath(); g.moveTo(5, 0); g.lineTo(-3, -4); g.lineTo(-1, 0); g.lineTo(-3, 4); g.closePath(); g.lineWidth = 2; g.strokeStyle = '#000'; g.stroke(); g.fillStyle = '#ffffff'; g.fill(); g.restore(); }
// „click“ statt „pointerdown“: sonst trifft der nachfolgende Klick einen Knopf der eben geöffneten Tafel
$('lhMap').addEventListener('click', () => { if (LW && LW.on && state === 'play') { audioOn(); lMapScreen(); } });
$('lhPack').addEventListener('click', () => { if (LW && LW.on && state === 'play') { audioOn(); LG.sel = null; LG.arm = null; lInv(); } });
$('lhPo').addEventListener('click', () => { if (LW && LW.on && state === 'play') { audioOn(); LG.sel = null; LG.arm = null; lInv(); } });
$('lhCp').addEventListener('click', () => { if (LW && LW.on && state === 'play') { audioOn(); lCpScreen(); } });
$('bAct').addEventListener('click', () => { if (LW && LW.on && state === 'play') lInteract(); });
addEventListener('keydown', e => {
  if (!LW || !LW.on || state !== 'play' || (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA'))) return;
  if (e.code === 'KeyC' || e.code === 'KeyI' || e.code === 'KeyB') { e.stopImmediatePropagation(); LG.sel = null; LG.arm = null; lInv(); }
  else if (e.code === 'KeyM') lMapScreen();
  else if (e.code === 'KeyL') lCpScreen();
  else if (e.code === 'KeyE' || e.code === 'Enter') lInteract();
}, true);
function lInteract() { const o = LW && LW.near; if (!o) return; sfx('click'); if (o.role === 'mis') lMisScreen(o); else if (o.role === 'trade') lTradeScreen(o); else lHealScreen(o); }
function lResume() { hideOverlay(); setState('play'); showHud(true); LW.bnear = undefined; }
// Pause in der Freiwelt: Rucksack statt Charakter, Abbrechen statt Hauptmenü
function lPauseFix() {
  const m = panel.querySelector('.menu'); if (!m) return;
  const ch = m.querySelector('[data-act="pchar"]'), ti = m.querySelector('[data-act="title"]');
  if (ch) ch.outerHTML = `<button class="btn alt" data-act="l_inv">${_t('Rucksack & Ausrüstung')}</button><button class="btn alt" data-act="l_map">${_t('Karte')}</button>${lMeta().stones ? `<button class="btn alt" data-act="l_cp">${_t('Leuchtfeuer setzen ({n})', { n: lMeta().stones })}</button>` : ''}`;
  if (ti) ti.outerHTML = `<button class="btn alt" data-act="l_quit">${_t('Ausflug abbrechen')}</button>`;
  const sub = panel.querySelector('.sub'); if (sub) sub.textContent = P.name + ' · ' + (LW.reg ? lRegName(LW.reg) : '') + ' · ' + lClock(LW.t);
}

/* ---------- Bildschirme ---------- */
function lHead(title, back, extra) { return `<div class="head"><h2>${title}</h2><div class="hbtns">${extra || ''}<button class="btn alt sm" data-act="${back}">${_t('Zurück')}</button></div></div>`; }
function lSlot(e, id, sel, show) {
  if (!e) return `<div class="lslot empty"></div>`;
  const c = lCol(e), n = lCount(e) || (e.t === 'gold' ? fmt(e.n) : ''), tag = show ? 'div' : 'button';
  return `<${tag} class="lslot${show ? ' gone' : ''}"${show ? '' : ` data-act="l_sel" data-id="${id}"`} style="box-shadow:inset 0 0 0 2px ${c}${sel ? ',0 0 0 2px #e8b04a' : ''}" aria-label="${esc(lName(e))}" title="${esc(lName(e))}"><img src="${lIcon(e)}" alt="">${e.t === 'item' && e.it.up ? `<span class="n" style="left:3px;right:auto;top:2px;bottom:auto;color:var(--gold)">+${e.it.up}</span>` : ''}${n ? `<span class="n">${n}</span>` : ''}</${tag}>`;
}
function lGetSel(id) {
  if (!id) return null; const [k, v] = id.split(':');
  if (k === 'g') return P.gear[v] ? { e: { t: 'item', it: P.gear[v] }, where: 'g', slot: v } : null;
  if (k === 'p') return LW.pack[+v] ? { e: LW.pack[+v], where: 'p', i: +v } : null;
  if (k === 'b' && LW.pet) { const b = lBag(LW.pet); return b[+v] ? { e: b[+v], where: 'b', i: +v } : null; }
  if (k === 'u') { const pk = id.slice(2), e = lPouchEntry(pk, lPouchHas(pk)); return e && e.n > 0 ? { e, where: 'u', k: pk } : null; }   // Sammelbeutel
  return null;
}
function lInv() {
  if (!LW || !LW.on) return;
  setState('menu'); showHud(false);
  const L = LW, cap = lCap(), pet = L.pet, bs = pet ? L.petBag : 0, bag = pet ? lBag(pet) : [], pouch = lPouchList(), s = lGetSel(LG.sel);
  const gear = ['weapon', 'armor', 'helm'].map(sl => `<div class="gearslot lgear"><div style="font-size:14px;color:var(--parch-dim)">${sl === 'weapon' ? _t('Waffe') : AR[sl].label}</div>${lSlot(P.gear[sl] ? { t: 'item', it: P.gear[sl] } : null, 'g:' + sl, LG.sel === 'g:' + sl)}</div>`).join('');
  const freeN = cap - L.pack.length, showE = freeN > 6 ? 4 : freeN;   // viele freie Plätze: vier zeigen, Rest als „+N frei“
  const packG = L.pack.map((e, i) => lSlot(e, 'p:' + i, LG.sel === 'p:' + i)).join('') + Array.from({ length: showE }, () => lSlot(null)).join('') + (freeN > showE ? `<div class="lslot empty lfree">${_t('+{n} frei', { n: freeN - showE })}</div>` : '');
  const bagG = pet ? Array.from({ length: bs }, (_, i) => lSlot(bag[i], 'b:' + i, LG.sel === 'b:' + i)).join('') : '';
  const gearBox = cls => `<div class="box ${cls}"><div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px">${gear}</div></div>`;
  let side = `<div class="side">${gearBox('lwd')}<p class="sub">${_t('Tippe etwas an: anlegen, in die Begleiter-Tasche legen oder wegwerfen.')}</p></div>`;
  if (s) {
    const e = s.e, it = e.t === 'item' ? e.it : null, petFree = pet && bag.length < bs, packFree = L.pack.length < cap;
    let acts = '';
    if (s.where !== 'g' && it && canEquip(it)) acts += `<button class="btn sm" data-act="l_eq">${_t('Anlegen')}</button>`;
    const petStack = pet && lStack(e) && bag.some(x => x.t === e.t && x.k === e.k), petOk = petFree || petStack;
    if ((s.where === 'p' || s.where === 'u') && pet) acts += `<button class="btn ${petOk ? '' : 'alt '}sm" data-act="l_tobag" ${petOk ? '' : 'disabled'}>${petOk ? (s.where === 'u' && e.n > 1 ? _t('Alle {n} in die Begleiter-Tasche', { n: fmt(e.n) }) : _t('In die Begleiter-Tasche')) : _t('Tasche voll')}</button>`;
    if (s.where === 'b') acts += `<button class="btn alt sm" data-act="l_topack" ${packFree || lStack(e) ? '' : 'disabled'}>${lStack(e) ? _t('In den Sammelbeutel') : _t('In den Rucksack')}</button>`;
    if (s.where !== 'g' && s.where !== 'u' && e.t !== 'gold') acts += `<button class="btn ${LG.arm === LG.sel ? 'red' : 'alt'} sm" data-act="l_drop">${LG.arm === LG.sel ? _t('Wirklich wegwerfen?') : _t('Wegwerfen')}</button>`;
    const val = `<p class="sub" style="margin:4px 0">${_t('Wert: {n} Gold', { n: fmt(lVal(e)) })}${s.where === 'b' ? ' · <b style="color:var(--moss)">' + _t('sicher in der Tasche') + '</b>' : s.where === 'g' || s.where === 'u' ? ' · <b style="color:var(--blood)">' + _t('geht beim Tod verloren') + '</b>' : ''}</p>`;
    side = `<div class="side sheet">${gearBox('lwd lgmini')}<button class="btn alt sm sheetx" data-act="l_sel" data-id="" aria-label="${_t('Schließen')}"><span class="x">×</span></button>${it ? itemDetail(it, acts) + (s.where !== 'g' ? compareHTML(it) : '') : `<div class="detail"><div style="display:flex;gap:10px;align-items:center"><div class="ic big" style="box-shadow:inset 0 0 0 2px ${lCol(e)}"><img src="${lIcon(e)}" alt=""></div><div class="nm" style="color:${lCol(e)}">${esc(lName(e))}${lCount(e) > 1 ? ' ×' + lCount(e) : ''}</div></div><div class="acts" style="justify-content:flex-start;margin-top:8px">${acts}</div></div>`}${val}</div>`;
  }
  const petBox = pet ? `<div class="box" style="margin-top:10px;box-shadow:inset 0 0 0 2px var(--moss)"><div style="display:flex;gap:8px;align-items:center;margin-bottom:6px"><img class="px" src="${lPetIcon(pet)}" alt="" style="width:32px;height:32px;object-fit:contain"><div><h3 style="margin:0">${_t('BEGLEITER-TASCHE {n}/{max}', { n: bag.length, max: bs })}</h3><div class="sub" style="margin:2px 0 0;font-size:16px">${_t('{name} bringt das heim – auch wenn du fällst.', { name: esc(lPetName(pet)) })}</div></div></div><div class="grid">${bagG || `<p class="sub">${_t('Keine Plätze.')}</p>`}</div></div>`
    : `<div class="box" style="margin-top:10px"><p class="sub" style="margin:0">${lPetApi() ? _t('Kein Begleiter dabei: Stirbst du, ist alles verloren.') : _t('Ohne Begleiter-Tasche: Stirbst du, ist alles verloren.')}</p></div>`;
  const pouchG = pouch.map(e => lSlot(e, 'u:' + lPouchKey(e), LG.sel === 'u:' + lPouchKey(e))).join('');
  const pouchBox = `<div class="box lpouch"><h3 style="margin-top:0;line-height:1.6">${_t('SAMMELBEUTEL')} <span class="lpdim">${_t('ohne Platzgrenze · {n} G', { n: fmt(lSum(pouch)) })}</span></h3>${pouch.length ? `<div class="lpg">${pouchG}</div>` : `<p class="sub" style="margin:0">${_t('Gold, Material, Edelsteine, Bauteile und Mods landen hier – sie brauchen keinen Platz im Rucksack.')}</p>`}</div>`;
  const birds = typeof birdBarHTML === 'function' ? birdBarHTML() : '', bTop = typeof birdTotal === 'function' && birdTotal() > 0;   // Vögel dabei: oben, sonst der Hinweis unten
  showOverlay(`${lHead(_t('RUCKSACK {n}/{max}', { n: L.pack.length, max: cap }), 'l_resume', `<span class="pill dim">${_t('{n} G', { n: fmt(lSum(L.pack) + lSum(pouch)) })}</span>`)}
  <div class="split"><div>${bTop ? birds : ''}${gearBox('lnw')}
  <div class="box lpk"><h3 style="margin-top:0;line-height:1.6">${_t('Rucksack').toLocaleUpperCase(LOCALE)} <span style="font-family:var(--f-body);font-size:17px;color:#ff8a7a">${_t('geht beim Tod verloren')}</span></h3><div class="${L.pack.length > 24 ? 'igrid scroll' : ''}" data-sk="lpack"><div class="grid">${packG}</div></div><div class="acts" style="justify-content:flex-start;margin-top:8px">${lJunk().length ? `<button class="btn ${LG.arm === 'junk' ? 'red' : 'alt'} sm" data-act="l_junk">${LG.arm === 'junk' ? _t('Wirklich {n} wegwerfen?', { n: lJunk().length }) : _t('Plunder wegwerfen ({n})', { n: lJunk().length })}</button>` : ''}${L.scrolls ? `<button class="btn alt sm" data-act="l_scroll">${_t('Rückkehrrolle lesen ({n})', { n: L.scrolls })}</button>` : ''}</div></div>${pouchBox}${petBox}${bTop ? '' : birds}</div>${side}</div>`, true);
}
function lJunk() { const low = MATORDER.slice(0, 4); return LW.pack.filter(e => (e.t === 'item' && e.it.rar === 0 && (!canEquip(e.it) || !P.gear[e.it.slot] || itemScore(e.it) <= itemScore(P.gear[e.it.slot]))) || (e.t === 'mat' && low.includes(e.k))); }
ON.l_junk = () => { if (LG.arm !== 'junk') { LG.arm = 'junk'; lInv(); return; } const j = new Set(lJunk()); LW.pack = LW.pack.filter(e => !j.has(e)); LG.arm = null; LG.sel = null; sfx('wood'); toast(_t('{n} Dinge weggeworfen', { n: j.size }), '#a8997e'); lInv(); };
function lMoveSel(to) {
  const s = lGetSel(LG.sel); if (!s) return;
  const L = LW, bag = L.pet ? lBag(L.pet) : null, src = s.where === 'p' ? L.pack : bag;
  if (to === 'b') { if (!bag || !lBagOk(s.e) || !lAdd(bag, Object.assign({}, s.e), L.petBag)) { sfx('deny'); return; } }
  else if (!lPackAdd(s.e)) { sfx('deny'); return; }   // Stapel in den Sammelbeutel, sonst ein Rucksack-Platz
  if (s.where === 'u') lPouchTake(s.k, s.e.n); else src.splice(s.i, 1);
  LG.sel = null; sfx('click'); persist();
}
ON.l_sel = id => { LG.sel = id && id !== LG.sel ? id : null; LG.arm = null; sfx('click'); lInv(); };
ON.l_resume = () => lResume();
ON.l_inv = () => { LG.sel = null; LG.arm = null; lInv(); };
ON.l_map = () => lMapScreen();
ON.l_tobag = () => { lMoveSel('b'); lInv(); };
ON.l_topack = () => { lMoveSel('p'); lInv(); };
ON.l_eq = () => {
  const s = lGetSel(LG.sel); if (!s || s.e.t !== 'item' || !canEquip(s.e.it)) return;
  const it = s.e.it, old = P.gear[it.slot], list = s.where === 'p' ? LW.pack : lBag(LW.pet);
  P.gear[it.slot] = it; if (old) list[s.i] = { t: 'item', it: old }; else list.splice(s.i, 1);
  computeStats(); P.hp = Math.min(P.hp, P.st.hp); updWeaponUI(); if (it.set && setCount(it.set) >= 3) stat('fullset');
  sfx('swing'); LG.sel = 'g:' + it.slot; saveChar(); persist(); lInv();
};
ON.l_drop = () => {
  const s = lGetSel(LG.sel); if (!s) return;
  if (LG.arm !== LG.sel && (s.e.t !== 'item' || s.e.it.rar >= 2 || s.e.t === 'egg')) { LG.arm = LG.sel; lInv(); return; }
  const list = s.where === 'p' ? LW.pack : lBag(LW.pet); list.splice(s.i, 1);
  const ox = P.x + P.face * 10; lDrop(ox, P.y + 4, s.e, .4); for (const c of pickups) if (Math.hypot(c.x - ox, c.y - P.y - 4) < 4 && c.t === 0) c.t = -2;
  LG.sel = null; LG.arm = null; sfx('wood'); persist(); lInv();
};
ON.l_scroll = () => { if (!LW.scrolls) return; LW.scrolls--; LW.xs.push({ k: 'exit', t: 'rolle', x: P.x, y: P.y + 2, r: 0, ph: 0, open: true, solid: false, id: 'rolle' }); toast(_t('Ein Rückweg öffnet sich unter deinen Füßen – bleib stehen!'), '#e8dcc0'); sfx('cast'); lResume(); };
ON.l_quit = () => {
  if (lDanger()) { setState('menu'); showOverlay(`<div class="center"><h2>${_t('MITTEN IM KAMPF!')}</h2><p class="sub">${_t('Abbrechen geht nur, wenn dich gerade nichts angreift. Lauf weg oder kämpfe!')}</p><div class="menu"><button class="btn" data-act="l_resume">${_t('Weiter')}</button></div></div>`); return; }
  setState('menu'); showOverlay(`<div class="center"><h2>${_t('AUSFLUG ABBRECHEN?')}</h2><p class="sub">${_t('Rucksack und Sammelbeutel bleiben in den Landen, und was du seit dem letzten Leuchtfeuer erkundet hast, ist vergessen. Du behältst die Ausrüstung, mit der du aufgebrochen bist, alles in der Begleiter-Tasche und was Vögel schon heimgebracht haben.')}</p><div class="menu"><button class="btn red" data-act="l_quitok">${_t('Ja, abbrechen')}</button><button class="btn alt" data-act="l_resume">${_t('Weiter erkunden')}</button></div></div>`);
};
ON.l_quitok = () => { const r = lAbandon('quit'); toast(r.lost.length ? _t('Ausflug abgebrochen – {n} Dinge sind verloren.', { n: r.lost.length }) : _t('Ausflug abgebrochen.'), '#ff8a5a'); enterHideout(); };
ON.l_wake = () => { lRelease(); enterHideout(); };
ON.l_home = () => { lRelease(); enterHideout(); };
ON.l_tomap = () => { lRelease(); G = null; openMap(); };
ON.l_again = () => { lRelease(); enterHideout(); openStation('weltentor'); };

/* ---------- Leuchtfeuer setzen: Karte sichern, neuer Start, Ausgang ---------- */
function lCpBlock() {
  if (!LW || !LW.on) return '-';
  if (!lMeta().stones) return _t('Du hast keinen Leuchtfeuerstein. Sie liegen selten in Truhen, bei Bossen und bei Händlern.');
  if (lDanger()) return _t('Nicht mitten im Kampf!');
  if (!lWalkP(P.x, P.y) || inPool(P.x, P.y, 8)) return _t('Hier ist kein fester Boden.');
  for (const o of lNear(P.x, P.y, 240)) if ((o.k === 'beacon' || o.k === 'exit' || o.k === 'npc') && Math.hypot(o.x - P.x, o.y - P.y) < 240) return _t('Zu nah an einem Ausgang, Lager oder Leuchtfeuer.');
  return '';
}
function lCpOld() { const M = lMeta(); return M.cps.length >= LCPMAX ? M.cps.slice().sort((a, b) => (a.u || a.t) - (b.u || b.t))[0] : null; }
function lCpScreen() {
  if (!LW || !LW.on) return; setState('menu'); showHud(false);
  const M = lMeta(), why = lCpBlock(), old = lCpOld(), I = lInfoW(P.x - LOFF, P.y - LOFF);
  showOverlay(`${lHead(_t('LEUCHTFEUER SETZEN'), 'l_resume', `<span class="pill" style="background:#ff8a3a">${_t('{n} STEINE', { n: M.stones })}</span>`)}
  <div class="say"><img class="px" src="${iconURL(['pa', 'l_feuer'])}" alt=""><div>${_t('Ein Leuchtfeuer kostet einen Leuchtfeuerstein und brennt für immer.')}</div></div>
  <div class="lrules"><div style="--c:var(--gold)">${_t('Die Karte bis hierher wird gesichert – auch wenn du später fällst.')}</div><div style="--c:var(--moss)">${_t('Beim nächsten Ausflug kannst du hier starten.')}</div><div style="--c:#57c7e6">${_t('Es ist ein Ausgang: hineinstellen und warten – die Beute ist sicher.')}</div></div>
  <p class="sub">${esc(lRegName(I.R))} · ${esc(I.B.n)} · ${_t('Stufe {n}', { n: I.stage })} · ${_t('{d} vom Weltentor', { d: lKm(Math.hypot(P.x - LOFF, P.y - LOFF)) })}</p>
  ${old ? `<p class="sub" style="color:#ff8a5a">${_t('Du hast schon {n} Leuchtfeuer – das am längsten unbenutzte erlischt: {name}', { n: LCPMAX, name: esc(lCpName(old)) })}</p>` : `<p class="sub">${_t('Leuchtfeuer: {n} von {max}', { n: M.cps.length, max: LCPMAX })}</p>`}
  ${why ? `<p class="sub" style="color:var(--blood)">${esc(why)}</p>` : ''}
  <div class="menu"><button class="btn" data-act="l_cpok" ${why ? 'disabled' : ''}>${_t('Entzünden (1 Leuchtfeuerstein)')}</button><button class="btn alt" data-act="l_resume">${_t('Zurück')}</button></div>`);
}
ON.l_cp = () => lCpScreen();
ON.l_cpok = () => {
  if (lCpBlock()) { sfx('deny'); lCpScreen(); return; }
  const L = LW, M = lMeta(), old = lCpOld();
  if (old) { M.cps.splice(M.cps.indexOf(old), 1); for (const r of L.cm.values()) for (const c of r.grid) for (const o of c.slice()) if (o.k === 'beacon' && o.cp === old) lRecDel(r, o); }
  const cp = { i: M.cpn++, x: Math.round(P.x - LOFF), y: Math.round(P.y - LOFF), t: Date.now(), u: Date.now(), w: 1 };
  M.stones--; M.cps.push(cp); M.start = 'c' + cp.i; const nR = L.regs.size; lCommit(); stat('landeCps');
  const r = lRecAt(P.x, P.y); if (r) lRecAdd(r, { k: 'beacon', cp, x: cp.x + LOFF, y: cp.y + LOFF, r: 4, solid: false });
  P.y += 30; L.ly = P.y; if (!lWalkP(P.x, P.y)) { P.y -= 60; L.ly = P.y; }
  saveChar(); persist(); sfx('myth'); flash = { a: .35, c: '255,200,120' }; rings.push({ x: cp.x + LOFF, y: cp.y + LOFF, r: 4, max: 80, life: .8, max2: .8, col: '#ffd24a' });
  lResume(); lBanner(_t('LEUCHTFEUER ENTZÜNDET'), _t('Karte gesichert ({n} neue Regionen). Hier startest du beim nächsten Mal – und hier kommst du raus.', { n: nR }));
};

/* ---------- Karte der Lande: zoombar, von der ganzen bekannten Welt bis zur Umgebung ---------- */
const LMV = { z: 24, cx: 0, cy: 0, from: 'trip', ptr: new Map(), raf: 0 };
const LMCOL = {}; function lMC(h) { return LMCOL[h] || (LMCOL[h] = hexRgb(h)); }
function lMapCol(wx, wy) { const c = lClassC(wx / LCK, wy / LCK); if (c.bar >= 0) { const B = LBAR[LBARK[c.bar]]; return lMC(c.cross ? (LCROSSC[B.x] || '#c8c0aa') : B.key === 'rand' ? '#000000' : B.c[0] === '#050208' || B.c[0] === '#0a0612' || B.c[0] === '#120e18' || B.c[0] === '#14122a' ? '#2a2236' : B.c[0]); } if (c.road) return lMC('#a8865a'); return lMC(LANDE_BIOMES[c.R.biome].map); }
function lMapScreen(from) {
  LMV.from = from || (LW && LW.on ? 'trip' : 'gate');
  if (LMV.from === 'trip') { if (!LW || !LW.on) return; setState('menu'); showHud(false); LMV.cx = P.x - LOFF; LMV.cy = P.y - LOFF; LMV.z = 16; }
  else lMapFit();
  const L = LW && LW.on ? LW : null, I = L ? lInfoW(P.x - LOFF, P.y - LOFF) : null, M = lMeta();
  const leg = [['#ffd24a', _t('Leuchtfeuer / Ausgang')], ['#57e6c8', _t('Tor der Alten')], ['#57c7e6', _t('Außenposten')], ['#ff6a5a', _t('Hort')], ['#c890ff', _t('Übergang')], ['#e8dcc0', _t('Werkzeug-Hort')]];
  const info = L ? `<p class="sub" style="margin-top:0"><b style="color:${lRate(I.stage).c}">${esc(lRegName(I.R))}</b><br>${esc(I.B.n)} · ${_t('Stufe {n}', { n: I.stage })} · ${_t('für dich {r}', { r: lRate(I.stage).n })}<br>${lNb(_t('{d} vom Weltentor · Tiefe {p} %', { d: lKm(Math.hypot(P.x - LOFF, P.y - LOFF)), p: (I.depth * 100).toLocaleString(LOCALE, { maximumFractionDigits: 2 }) }))}</p>` : `<p class="sub" style="margin-top:0">${_t('Regionen entdeckt: {n} · weiteste Reise: {d}', { n: M.regs.length, d: lKm(M.far / 10000 * LWR * LCK) })}</p>`;
  const tools = `<div class="ltools">${LANDE_TOOLS.map((t, i) => `<div class="${lToolBit(i) ? '' : 'no'}" style="--c:${t.c}" title="${esc(t.n)}"><img src="${iconURL(['pa', 'lt_' + t.key])}" alt="${esc(t.n)}"></div>`).join('')}</div>`;
  const back = LMV.from === 'trip' ? 'l_resume' : 'l_gate';
  showOverlay(`${lHead(_t('KARTE DER LANDE'), back, L ? `<span class="pill" style="background:${LDNG[L.danger].c}">${LDNG[L.danger].n} · ${lClock(L.t)}</span>` : '')}
  <div class="lmapw"><div class="lmapc"><canvas class="lmap" id="lmapBig" width="240" height="240" aria-label="${_t('Karte')}"></canvas><div class="lmapz"><button class="btn alt sm" data-act="l_mz" data-id="in" aria-label="${_t('Näher')}">+</button><button class="btn alt sm" data-act="l_mz" data-id="out" aria-label="${_t('Weiter weg')}">−</button><button class="btn alt sm" data-act="l_mz" data-id="me" aria-label="${_t('Zur Mitte')}">◎</button></div><div class="lmapn" id="lmapN"></div></div>
  <div>${info}${tools}<div class="lleg">${leg.map(([c, n]) => `<span><i style="background:${c}"></i>${n}</span>`).join('')}${L ? `<span><i style="background:repeating-linear-gradient(45deg,#555 0 2px,#222 2px 4px)"></i>${_t('noch nicht gesichert')}</span>` : ''}</div>${L ? lMisList(false) : ''}</div></div>`, true);
  lMapBind(); lMapRender();
}
// Karte auf die ganze bekannte Welt einstellen (vom Weltentor aus)
function lMapFit() {
  let x0 = 0, y0 = 0, x1 = 768, y1 = 768; for (const k of lMap().keys()) { const [sx, sy] = k.split(',').map(Number); x0 = Math.min(x0, sx * 16 * LFLD); y0 = Math.min(y0, sy * 16 * LFLD); x1 = Math.max(x1, (sx + 1) * 16 * LFLD); y1 = Math.max(y1, (sy + 1) * 16 * LFLD); }
  for (const c of lMeta().cps) { x0 = Math.min(x0, c.x - 2000); y0 = Math.min(y0, c.y - 2000); x1 = Math.max(x1, c.x + 2000); y1 = Math.max(y1, c.y + 2000); }
  LMV.cx = (x0 + x1) / 2; LMV.cy = (y0 + y1) / 2; LMV.z = clamp(Math.max(x1 - x0, y1 - y0) / 220, 16, 65536);
}
ON.l_mz = id => { if (id === 'in') LMV.z = Math.max(6, LMV.z / 2); else if (id === 'out') LMV.z = Math.min(65536, LMV.z * 2); else { if (LMV.from === 'trip' && LW && LW.on) { LMV.cx = P.x - LOFF; LMV.cy = P.y - LOFF; } else lMapFit(); } sfx('click'); lMapRender(); };
ON.l_mapg = () => lMapScreen('gate');
ON.l_gate = () => lGate();
function lMapBind() {
  const cv = $('lmapBig'); if (!cv) return; LMV.ptr.clear();
  const at = e => ({ x: e.clientX, y: e.clientY });
  cv.addEventListener('pointerdown', e => { cv.setPointerCapture(e.pointerId); LMV.ptr.set(e.pointerId, at(e)); LMV.p0 = null; });
  cv.addEventListener('pointermove', e => {
    if (!LMV.ptr.has(e.pointerId)) return; const prev = LMV.ptr.get(e.pointerId), now = at(e), k = 240 / cv.getBoundingClientRect().width;
    if (LMV.ptr.size === 1) { LMV.cx -= (now.x - prev.x) * k * LMV.z; LMV.cy -= (now.y - prev.y) * k * LMV.z; }
    else if (LMV.ptr.size === 2) { const [a, b] = [...LMV.ptr.values()], o = a === prev ? b : a, d0 = Math.hypot(prev.x - o.x, prev.y - o.y), d1 = Math.hypot(now.x - o.x, now.y - o.y); if (d0 > 8 && d1 > 8) LMV.z = clamp(LMV.z * d0 / d1, 6, 65536); }
    LMV.ptr.set(e.pointerId, now); if (!LMV.raf) LMV.raf = requestAnimationFrame(() => { LMV.raf = 0; lMapRender(true); });
  });
  const up = e => { LMV.ptr.delete(e.pointerId); if (!LMV.ptr.size) setTimeout(() => lMapRender(), 0); };
  cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
  cv.addEventListener('wheel', e => { e.preventDefault(); LMV.z = clamp(LMV.z * (e.deltaY > 0 ? 1.25 : .8), 6, 65536); lMapRender(); }, { passive: false });
}
function lMapRender(lo) {
  const cv = $('lmapBig'); if (!cv) return; const S = lo ? 160 : 240; if (cv.width !== S) { cv.width = cv.height = S; }
  const g = cv.getContext('2d'), z = LMV.z * 240 / S, x0 = LMV.cx - S / 2 * z, y0 = LMV.cy - S / 2 * z, img = g.createImageData(S, S), D = img.data, map = lMap(), trip = LW && LW.on ? LW.fog : null;
  for (let i = 0; i < D.length; i += 4) { D[i] = 12; D[i + 1] = 10; D[i + 2] = 16; D[i + 3] = 255; }
  const fz = LFLD / z, put = (px0, py0, w, h, c, dim) => { const xa = Math.max(0, Math.floor(px0)), xb = Math.min(S, Math.ceil(px0 + w)), ya = Math.max(0, Math.floor(py0)), yb = Math.min(S, Math.ceil(py0 + h)); for (let y = ya; y < yb; y++) for (let x = xa; x < xb; x++) { const o = (y * S + x) * 4, hh = dim && ((x + y) & 3) < 2; D[o] = hh ? c[0] * .45 : c[0]; D[o + 1] = hh ? c[1] * .45 : c[1]; D[o + 2] = hh ? c[2] * .45 : c[2]; } };
  const fx0 = Math.floor(x0 / LFLD), fy0 = Math.floor(y0 / LFLD), fx1 = Math.floor((x0 + S * z) / LFLD), fy1 = Math.floor((y0 + S * z) / LFLD);
  const field = (fx, fy, dim) => { const n = fz >= 3 ? clamp(Math.floor(fz / 2), 1, 8) : 1, bs = fz / n; for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) put((fx * LFLD - x0) / z + i * bs, (fy * LFLD - y0) / z + j * bs, bs, bs, lMapCol(fx * LFLD + (i + .5) * LFLD / n, fy * LFLD + (j + .5) * LFLD / n), dim); };
  if ((fx1 - fx0) * (fy1 - fy0) < 70000) { for (let fy = fy0; fy <= fy1; fy++) for (let fx = fx0; fx <= fx1; fx++) { const c = lFHas(map, fx, fy); if (c) field(fx, fy, false); else if (trip && lFHas(trip, fx, fy)) field(fx, fy, true); } }
  else for (const [src, dim] of [[map, false], [trip, true]]) { if (!src) continue; for (const [k, a] of src) { const [sx, sy] = k.split(',').map(Number); if ((sx + 1) * 16 < fx0 || sx * 16 > fx1 || (sy + 1) * 16 < fy0 || sy * 16 > fy1) continue; for (let b = 0; b < 256; b++) if (a[b >> 5] & (1 << (b & 31))) { const fx = sx * 16 + (b & 15), fy = sy * 16 + (b >> 4); put((fx * LFLD - x0) / z, (fy * LFLD - y0) / z, Math.max(1, fz), Math.max(1, fz), lMapCol((fx + .5) * LFLD, (fy + .5) * LFLD), dim); } } }
  g.putImageData(img, 0, 0); g.imageSmoothingEnabled = false;
  const X = wx => (wx - x0) / z, Y = wy => (wy - y0) / z, m = 1, I = (wx, wy, pat, col, edge) => { const a = X(wx), b = Y(wy); if (a < -6 || b < -6 || a > S + 6 || b > S + 6) return false; lIconPx(g, a, b, LPAT[pat], col, edge, m); return true; };
  const known = (wx, wy) => lFHas(map, Math.floor(wx / LFLD), Math.floor(wy / LFLD)) || !!(trip && lFHas(trip, Math.floor(wx / LFLD), Math.floor(wy / LFLD)));
  const vc = { x: LMV.cx / LCK, y: LMV.cy / LCK }, vr = S * z / LCK * .75;
  // Werkzeug-Horte (bekannt) und ein Gerücht zum nächsten fehlenden Werkzeug
  const nt = lNextTool(), me = LW && LW.on ? { x: (P.x - LOFF) / LCK, y: (P.y - LOFF) / LCK } : { x: LMV.cx / LCK, y: LMV.cy / LCK };
  if (nt >= 0) { const N = lToolN(nt); let best = null, bd = 1e9; for (let j = 0; j < N; j++) { const s = lToolSite(nt, j), d = Math.hypot(s.x - me.x, s.y - me.y); if (d < bd) { bd = d; best = s; } } if (best) { const r = mulberry(lH(nt, best.j, 75)), hx = (best.x + (r() - .5) * 3) * LCK, hy = (best.y + (r() - .5) * 3) * LCK, rad = Math.max(5, 2.6 * LCK / z); g.save(); g.setLineDash([3, 3]); g.strokeStyle = LANDE_TOOLS[nt].c; g.lineWidth = 1; g.beginPath(); g.arc(X(hx), Y(hy), rad, 0, 6.283); g.stroke(); g.restore(); g.drawImage(lToolImg(nt), Math.round(X(hx)) - 6, Math.round(Y(hy)) - 6, 12, 12); } }
  if (vr < 1600) for (const s of lToolSitesNear(vc.x, vc.y, vr)) if (known(s.x * LCK, s.y * LCK)) { I(s.x * LCK, s.y * LCK, 'PED', LANDE_TOOLS[s.k].c, '#1a1420'); if (!lToolBit(s.k) && z < 400) g.drawImage(lToolImg(s.k), Math.round(X(s.x * LCK)) - 4, Math.round(Y(s.y * LCK)) - 13, 8, 8); }
  if (vr < 1600) for (const s of lEdgeSitesNear(vc.x, vc.y, vr)) if (known(s.x * LCK, s.y * LCK)) I(s.x * LCK, s.y * LCK, 'END', '#ffd24a', '#b892f4');
  // Tore, Außenposten, Horte, Wahrzeichen
  if (z <= 512) {
    const cells = (G_, fn) => { const a = Math.floor((LMV.cx - S / 2 * z) / LCK / G_) - 1, b = Math.floor((LMV.cx + S / 2 * z) / LCK / G_) + 1, c = Math.floor((LMV.cy - S / 2 * z) / LCK / G_) - 1, d = Math.floor((LMV.cy + S / 2 * z) / LCK / G_) + 1; for (let j = c; j <= d; j++) for (let i = a; i <= b; i++) fn(i, j); };
    cells(LXG, (i, j) => { const e = lExitCell(i, j); if (e && known(e.x * LCK, e.y * LCK)) I(e.x * LCK, e.y * LCK, 'RING', '#57e6c8', '#1a3a34'); });
    cells(LOG, (i, j) => { const o = lOutCell(i, j); if (o && known(o.x * LCK, o.y * LCK)) I(o.x * LCK, o.y * LCK, 'TENT', '#57c7e6', '#1a3a4a'); });
    if (z <= 192) cells(LRC, (i, j) => { const R = lCell(i, j); if (R.dist < 5 || !known(R.sx * LCK, R.sy * LCK)) return; const h = lF(R.rx, R.ry, 81); if (h < .3) { I(R.sx * LCK, R.sy * LCK, 'SKULL', '#ff6a5a', '#1a1420'); if (typeof bossForLair === 'function' && z <= 96) { try { const id = bossForLair('L' + R.id, lCtxOf(Math.floor(R.sx), Math.floor(R.sy), 'L' + R.id)); if (id != null) { g.font = '6px "Press Start 2P", monospace'; g.textAlign = 'center'; g.fillStyle = '#000'; g.fillText(String(id + 1), X(R.sx * LCK) + 1, Y(R.sy * LCK) - 5); g.fillStyle = '#ff8a7a'; g.fillText(String(id + 1), X(R.sx * LCK), Y(R.sy * LCK) - 6); } } catch (_) { } } } else if (h < .72) I(R.sx * LCK, R.sy * LCK, 'DIA', '#efe2bf'); });
  }
  // Übergänge mit dem nötigen Werkzeug
  if (z <= 96) for (const c of lCrossNear(vc.x, vc.y, vr + 2)) { if (!known(c.px * LCK, c.py * LCK)) continue; const own = c.need < 0 || lToolBit(c.need); I(c.px * LCK, c.py * LCK, 'DIA', own ? '#79c24e' : '#c890ff'); if (c.need >= 0 && z <= 48) g.drawImage(lToolImg(c.need), Math.round(X(c.px * LCK)) - 4, Math.round(Y(c.py * LCK)) - 12, 8, 8); }
  // Suchkreise der Artefakte (Teil A)
  if (typeof arteHints === 'function') { try { g.save(); g.setLineDash([2, 2]); for (const h of arteHints() || []) { if (!h || !isFinite(h.x)) continue; g.strokeStyle = '#ffe08a'; g.beginPath(); g.arc(X(h.x), Y(h.y), Math.max(3, (h.r || 200) / z), 0, 6.283); g.stroke(); } g.restore(); } catch (_) { } }
  // Weltentor, Leuchtfeuer
  I(384, 300, 'RING', '#6ae08a', '#1e6a3a');
  for (const c of lMeta().cps) if (I(c.x, c.y, 'FIRE', '#ffd24a', '#ff6a2a') && z <= 1024) { g.font = '6px "Press Start 2P", monospace'; g.textAlign = 'center'; g.fillStyle = '#000'; g.fillText(String(c.i + 1), X(c.x) + 1, Y(c.y) - 5); g.fillStyle = '#ffd24a'; g.fillText(String(c.i + 1), X(c.x), Y(c.y) - 6); }
  if (LW && LW.on) {
    const B = LW.beast; if (B && B.state === 'roam') I(B.x - LOFF, B.y - LOFF, 'SKULL', Math.floor(T * 3) % 2 ? '#ffffff' : '#ff6a5a', '#c8342c');
    const tg = lMisTarget(); if (tg) I(tg.x - LOFF, tg.y - LOFF, 'STAR', '#57c7e6');
    const hx = X(P.x - LOFF), hy = Y(P.y - LOFF); if (hx > -4 && hy > -4 && hx < S + 4 && hy < S + 4) lHeroArrow(g, hx, hy, 1.2); else { const a = Math.atan2(hy - S / 2, hx - S / 2); g.fillStyle = '#fff'; g.fillRect(Math.round(S / 2 + Math.cos(a) * (S / 2 - 6)) - 2, Math.round(S / 2 + Math.sin(a) * (S / 2 - 6)) - 2, 4, 4); }
  }
  if (!map.size && !(trip && trip.size)) { g.font = '7px "Press Start 2P", monospace'; g.textAlign = 'center'; g.fillStyle = '#8a8496'; g.fillText(_t('NOCH UNERFORSCHT'), S / 2, S / 2 + 20); }
  const n = $('lmapN'); if (n) n.textContent = _t('{d} breit', { d: lKm(S * z) });
}
function lMisList(claim) {
  const L = LW; if (!L.misOn) return `<p class="sub">${_t('Kundschafterinnen in den Außenposten haben Aufträge für dich.')}</p>`;
  return `<h3>${_t('AUFTRÄGE')}</h3>` + L.mis.map((m, i) => `<div class="lmis" style="--c:${m.paid ? 'var(--stone-hi)' : m.done ? 'var(--moss)' : '#57c7e6'}"><div class="nm">${m.paid ? '✓ ' : m.done ? '✦ ' : ''}${esc(m.txt)}</div><div class="st">${m.n > 1 ? m.c + '/' + m.n + ' · ' : ''}${_t('Belohnung: {rep} Ruf, {items}', { rep: m.rep, items: m.rew.map(e => e.t === 'key' ? _t('Schlüssel') : lName(e)).join(', ') })}</div>${claim && m.done && !m.paid ? `<button class="btn sm" data-act="l_claim" data-i="${i}" style="margin-top:6px">${_t('Belohnung nehmen')}</button>` : ''}</div>`).join('');
}
// Richtung als Wort (Norden oben)
function lDir(dx, dy) { const a = (Math.atan2(dy, dx) * 180 / Math.PI + 360 + 22.5) % 360, k = Math.floor(a / 45); return [_t('Osten'), _t('Südosten'), _t('Süden'), _t('Südwesten'), _t('Westen'), _t('Nordwesten'), _t('Norden'), _t('Nordosten')][k]; }
// Gerücht über die nächste unentdeckte Spur von Artefakten (Teil A), vom Außenposten aus – danach liegt ein Suchkreis auf der Karte
function lArteRumorHTML(npc) {
  if (!npc || typeof arteRumor !== 'function') return '';
  try {
    const r = arteRumor(Math.floor((npc.x - LOFF) / LCK), Math.floor((npc.y - LOFF) / LCK));
    if (!r || !r.text) return '';
    if (r.chain != null && typeof aRumorAdd === 'function') aRumorAdd(r.chain);
    return `<div class="lmis" style="--c:#b892f4"><div class="nm">${_t('Gerücht über eine Spur')}</div><div class="st">${esc(r.text)}</div></div>`;
  } catch (e) { console.error('Lande (arteRumor):', e); return ''; }
}
// Kundschafterin: Aufträge annehmen und abholen, dazu Gerüchte über das nächste Werkzeug und eine Spur
function lMisScreen(npc) {
  const L = LW; npc = npc || L.near; setState('menu'); showHud(false);
  if (npc && (!L.misOn || L.mis.every(m => m.paid))) { L.misOn = true; L.mis = lMisGen(npc); L.misFrom = npc.op; sfx('page'); }
  L.misNpc = npc;
  lTip(4, _t('Tipp: Erfüllte Aufträge zahlen hier – oder automatisch, wenn du lebend durch einen Ausgang gehst.'));
  const M = lMeta(), r = lRank(M.rep), nx = LREP[r + 1], nt = lNextTool();
  let rumor = '';
  if (nt >= 0 && npc) { const wx = (npc.x - LOFF) / LCK, wy = (npc.y - LOFF) / LCK, N = lToolN(nt); let best = null, bd = 1e9; for (let j = 0; j < N; j++) { const s = lToolSite(nt, j), d = Math.hypot(s.x - wx, s.y - wy); if (d < bd) { bd = d; best = s; } } if (best) rumor = `<div class="lmis" style="--c:${LANDE_TOOLS[nt].c}"><div class="nm">${_t('Gerücht: {tool}', { tool: esc(LANDE_TOOLS[nt].n) })}</div><div class="st">${_t('Ein Hort mit diesem Werkzeug soll etwa {d} im {dir} liegen. Auf der Karte ist die Gegend markiert.', { d: lKm(bd * LCK), dir: lDir(best.x - wx, best.y - wy) })}</div></div>`; }
  rumor += lArteRumorHTML(npc);
  showOverlay(`${lHead(esc(npc ? npc.name : LNPC.mis.n).toLocaleUpperCase(LOCALE), 'l_resume')}
  <div class="say"><img class="px" src="${iconURL(['sp', npc ? npc.sp : 'elff'])}" alt=""><div><b style="color:#57c7e6">${esc(npc ? npc.name : LNPC.mis.n)}</b>${_t('„Der Orden braucht Augen hier draußen. Erledige, was du kannst – bezahlt wird, wenn du es mir bringst oder lebend durch ein Tor gehst.“')}</div></div>
  <div class="stats"><span style="color:#57c7e6">${_t('RUF: {n}', { n: LREP[r].n.toLocaleUpperCase(LOCALE) })}</span><span>${M.rep}${nx ? ' / ' + nx.at : ''}</span></div>${nx ? `<div class="lbar"><i style="width:${Math.round((M.rep - LREP[r].at) / (nx.at - LREP[r].at) * 100)}%"></i></div><p class="sub" style="margin-top:0">${_t('Nächster Rang: {n} – {d}', { n: nx.n, d: nx.d })}</p>` : ''}
  ${rumor}${lMisList(true)}`, true);
}
ON.l_claim = (id, b, i) => {
  const m = LW.mis[i]; if (!m || !m.done || m.paid) return;
  if (m.t === 'mats' && !lPackPay('mat', m.k, m.n)) { sfx('deny'); return; }
  m.paid = true; const M = lMeta(); M.rep += m.rep; M.done++; stat('landeMis');
  const o = LW.misNpc || LW.near || P; lBurst({ x: o.x + 14, y: o.y + 10 }, m.rew.filter(e => e.t !== 'key').concat(m.rew.filter(e => e.t === 'key'))); sfx('ach'); toast(_t('+{n} Ruf bei den Kundschaftern', { n: m.rep }), '#57c7e6'); persist();
  lResume();
};
// Händler: Tausch, Verkauf, Kauf – bezahlt wird mit dem, was du dabei hast
function lOffers(npc) {
  const st = lRegAt(npc.x, npc.y).stage, dep = lDepthAt(npc.x, npc.y), f = lPerk('rabatt'), O = [], av = MONMATS.slice(0, clamp(5 + Math.floor(st / 5), 5, MONMATS.length)), mat = av[av.length - 1 - ri(0, 1)], mat2 = av[Math.max(0, av.length - 3 - ri(0, 2))], low = av[ri(0, 2)];
  const it1 = lItem(3, 2, st + 2), v1 = lVal({ t: 'item', it: it1 });
  O.push({ give: [{ t: 'mat', k: mat, n: clamp(Math.round(v1 * .7 / LMATV[mat]), 3, 25) }], get: { t: 'item', it: it1 } });
  const it2 = lItem(2, 2.4, st + 2); O.push({ give: [{ t: 'gold', n: Math.round(lVal({ t: 'item', it: it2 }) * 1.25 * f) }], get: { t: 'item', it: it2 } });
  const egg = lEgg(1 + dep * 6, lBioAt(npc.x, npc.y), dep); if (egg) O.push({ give: [{ t: 'mat', k: mat2, n: 6 + Math.round(dep * 40) }, { t: 'mat', k: low === mat2 ? 'leder' : low, n: 8 }], get: { t: 'egg', d: egg } });
  const gk = randomGem(st + 6); O.push({ give: [{ t: 'mat', k: low, n: 6 }], get: { t: 'gem', k: gk, n: 1 } });
  const md = lMod(dep, 1.5); if (md) O.push({ give: [{ t: 'gold', n: Math.round(lVal(md) * 1.4 * f) }], get: md });
  return O;
}
function lGiveOk(give) { for (const g of give) { if (g.t === 'gold' ? lPackGold() < g.n : lPackHas(g.t, g.k) < g.n) return false; } return true; }
function lTradeScreen(npc) {
  const L = LW; npc = npc || L.tnpc || L.near; if (!npc) return; L.tnpc = npc; setState('menu'); showHud(false); if (!L.offers.has(npc.op)) L.offers.set(npc.op, lOffers(npc));
  const offers = L.offers.get(npc.op), tab = LG.tab, f = lPerk('rabatt'), st = lRegAt(npc.x, npc.y).stage, gold = lPackGold(), t_ = (k, l) => `<button class="tab" role="tab" aria-selected="${tab === k}" data-act="l_ttab" data-id="${k}">${l}</button>`;
  let body = '';
  if (tab === 'tausch') body = offers.map((o, i) => `<div class="box" style="margin-bottom:6px;${o.done ? 'opacity:.45' : ''}">${landeLootHTML(o.get, o.done ? `<span class="pill dim">${_t('Getauscht')}</span>` : `<button class="btn sm" data-act="l_buyo" data-i="${i}" ${lGiveOk(o.give) ? '' : 'disabled'}>${_t('Tauschen')}</button>`)}<div class="cost">${_t('Gib:')} ${o.give.map(g => `<span class="${(g.t === 'gold' ? gold >= g.n : lPackHas(g.t, g.k) >= g.n) ? '' : 'bad'}"><img src="${lIcon(g)}" alt="">${g.t === 'gold' ? fmt(g.n) + ' ' + _t('Gold') : (lPackHas(g.t, g.k) + '/' + g.n + ' ' + lName(g))}</span>`).join('')}</div></div>`).join('');
  else if (tab === 'kauf') {
    const goods = [['pot', _t('Heiltrank'), Math.round((25 + Math.min(st, 150) * 3) * f), ['s', 288, 336, 16, 16]], ['key', _t('Schlüssel'), Math.round((180 + Math.min(st, 150) * 18) * f), ['pa', 'l_schl']], ['map', _t('Kartenstück'), Math.round((90 + Math.min(st, 150) * 8) * f), ['pa', 'l_karte']], ['scroll', _t('Rückkehrrolle (Ausgang überall, doppelt so lange stehen)'), Math.round((380 + Math.min(st, 150) * 30) * f), ['pa', 'l_rolle']]];
    if (lPerk('stone')) goods.push(['stone', _t('Leuchtfeuerstein (einer je Außenposten)'), Math.round((900 + Math.min(st, 150) * 60) * f), ['pa', 'l_feuer']]);
    if (typeof birdShop === 'function') for (const b of birdShop(st, f)) goods.push(b);   // Magische Vögel (js/voegel.js)
    const sold = k => (k === 'scroll' && L.boughtScroll) || (k === 'stone' && L.ts.get('st' + npc.op)) || (k.startsWith('bird:') && L.ts.get('bd' + npc.op + k));
    body = goods.map(([k, n, p, ic]) => `<div class="row" style="cursor:default"><div class="ic"><img src="${iconURL(ic)}" alt=""></div><div><div class="nm">${n}</div></div><button class="btn sm" data-act="l_buyx" data-id="${k}" data-i="${p}" ${gold >= p && !(k === 'pot' && P.potions >= potMax()) && !sold(k) ? '' : 'disabled'}><i class="coin"></i>${fmt(p)}</button></div>`).join('') + `<p class="sub">${_t('Bezahlt wird mit dem Gold in deinem Rucksack.')}${lPerk('stone') ? '' : ' ' + _t('Leuchtfeuersteine verkaufen Händler erst ab dem Ruf „Bekannter“.')}</p>`;
  }
  else { const pl = lPouchList().filter(e => e.t !== 'gold'); body = L.pack.length || pl.length ? L.pack.map((e, i) => e.t === 'gold' ? '' : landeLootHTML(e, `<button class="btn sm" data-act="l_sell" data-i="${i}"><i class="coin"></i>${fmt(Math.max(1, Math.round(lVal(e) * .45 / f)))}</button>`)).join('') + pl.map(e => landeLootHTML(e, `<button class="btn sm" data-act="l_sellp" data-id="${esc(lPouchKey(e))}"><i class="coin"></i>${fmt(Math.max(1, Math.round(lVal(e) * .45 / f)))}</button>`)).join('') + `<p class="sub">${_t('Das Gold kommt in den Sammelbeutel – raustragen musst du es trotzdem.')}</p>` : `<p class="sub">${_t('Dein Rucksack ist leer.')}</p>`; }
  showOverlay(`${lHead(esc(npc.name).toLocaleUpperCase(LOCALE), 'l_resume', `<div class="gold"><img src="${iconURL(['pa', 'l_gold'])}" alt="" style="width:16px;vertical-align:-3px;image-rendering:pixelated"> ${fmt(gold)}</div>`)}
  <div class="say"><img class="px" src="${iconURL(['sp', npc.sp])}" alt=""><div><b style="color:#79c24e">${esc(npc.name)}</b>${_t('„Hier draußen zahlt man mit dem, was man trägt. Zeig her, was du hast.“')}</div></div>
  <div class="tabs" role="tablist">${t_('tausch', _t('TAUSCH'))}${t_('kauf', _t('KAUFEN'))}${t_('verkauf', _t('VERKAUFEN'))}</div>${body}`, true);
}
ON.l_ttab = id => { LG.tab = id; sfx('click'); lTradeScreen(); };
ON.l_buyo = (id, b, i) => {
  const L = LW, offers = L.tnpc && L.offers.get(L.tnpc.op), o = offers && offers[i]; if (!o || o.done || !lGiveOk(o.give)) { sfx('deny'); return; }
  if (!lPackAdd(Object.assign({}, o.get))) { toast(_t('Rucksack voll!'), '#ff6a5a'); sfx('deny'); return; }
  for (const g of o.give) lPackPay(g.t, g.k, g.n); o.done = true; if (o.get.t === 'item') { o.get.it.lw = L.id; hook('pickup', o.get.it); }
  sfx('buy'); toast(_t('Getauscht: {n}', { n: lName(o.get) }), lCol(o.get)); lTradeScreen();
};
ON.l_buyx = (id, b, p) => {
  const L = LW; if (lPackGold() < p) { sfx('deny'); return; }
  if (id === 'pot') { if (P.potions >= potMax()) return; P.potions++; }
  else if (id === 'key') { lMeta().keys++; }
  else if (id === 'map') lMapPiece();
  else if (id === 'scroll') { if (L.boughtScroll) return; L.boughtScroll = true; L.scrolls++; }
  else if (id === 'stone') { if (!lPerk('stone') || !L.tnpc || L.ts.get('st' + L.tnpc.op)) return; L.ts.set('st' + L.tnpc.op, 1); lMeta().stones++; toast(_t('Leuchtfeuerstein gekauft ({n})', { n: lMeta().stones }), '#ff8a3a'); }
  else if (String(id).startsWith('bird:')) { const k = id.slice(5); if (typeof birdGive !== 'function' || !L.tnpc || L.ts.get('bd' + L.tnpc.op + id) || !birdGive(k, 1)) return; L.ts.set('bd' + L.tnpc.op + id, 1); toast(_t('{bird} gekauft – im Rucksack unter „Vogel schicken“', { bird: BIRDS[k].n }), BIRDS[k].c); saveChar(); }
  lPackPay('gold', undefined, p); sfx('buy'); persist(); lTradeScreen();
};
ON.l_sell = (id, b, i) => {
  const e = LW.pack[i]; if (!e || e.t === 'gold') return; const g = Math.max(1, Math.round(lVal(e) * .45 / lPerk('rabatt')));
  LW.pack.splice(i, 1); lPackAdd({ t: 'gold', n: g }); sfx('coin'); lTradeScreen();
};
// ganzen Stapel aus dem Sammelbeutel verkaufen
ON.l_sellp = id => {
  const e = lPouchEntry(id, lPouchHas(id)); if (!e || e.t === 'gold' || !(e.n > 0)) return; const g = Math.max(1, Math.round(lVal(e) * .45 / lPerk('rabatt')));
  lPouchTake(id, e.n); lPackAdd({ t: 'gold', n: g }); sfx('coin'); lTradeScreen();
};
// Heilerin
function lHealScreen(npc) {
  const L = LW; npc = npc || L.hnpc || L.near; if (!npc) return; L.hnpc = npc;
  const st = Math.min(lRegAt(npc.x, npc.y).stage, 150), gold = lPackGold(), hp = Math.round((30 + st * 5) * lPerk('rabatt')), bl = Math.round((60 + st * 9) * lPerk('rabatt'));
  setState('menu'); showHud(false);
  showOverlay(`${lHead(esc(npc.name).toLocaleUpperCase(LOCALE), 'l_resume', `<div class="gold"><img src="${iconURL(['pa', 'l_gold'])}" alt="" style="width:16px;vertical-align:-3px;image-rendering:pixelated"> ${fmt(gold)}</div>`)}
  <div class="say"><img class="px" src="${iconURL(['sp', npc.sp])}" alt=""><div><b style="color:#f786a0">${esc(npc.name)}</b>${_t('„Setz dich ans Feuer. Die Lande nehmen viel – ein bisschen gebe ich zurück.“')}</div></div>
  <p class="sub">${_t('LP {hp}/{max} · Tränke {n}/{m}', { hp: Math.ceil(P.hp), max: P.st.hp, n: P.potions, m: potMax() })}</p>
  <div class="menu"><button class="btn" data-act="l_heal" ${P.hp < P.st.hp && (L.healFree || gold >= hp) ? '' : 'disabled'}>${L.healFree ? _t('Wunden versorgen (einmal frei)') : _t('Wunden versorgen ({n} Gold)', { n: hp })}</button>
  <button class="btn alt" data-act="l_bless" data-i="${bl}" ${gold >= bl && L.buffT <= L.t ? '' : 'disabled'}>${L.buffT > L.t ? _t('Kräutersegen wirkt noch') : _t('Kräutersegen: 2 Minuten Regeneration ({n} Gold)', { n: bl })}</button></div>`);
  LG.healCost = hp;
}
ON.l_heal = () => { const L = LW; if (!L.healFree) { if (!lPackPay('gold', undefined, LG.healCost)) { sfx('deny'); return; } } L.healFree = false; P.hp = P.st.hp; P.res = P.st.resMax; sfx('heal'); toast(_t('Vollständig geheilt'), '#79c24e'); lHealScreen(); };
ON.l_bless = (id, b, p) => { const L = LW; if (!lPackPay('gold', undefined, p)) { sfx('deny'); return; } L.buffT = L.t + 120; L.buffV = Math.max(1, P.st.hp * .012); computeStats(); sfx('heal'); toast(_t('Kräutersegen: Regeneration für 2 Minuten'), '#79c24e'); lHealScreen(); };
HOOK.stats.push(add => { if (LW && LW.on && LW.buffT > LW.t) add('regen', LW.buffV); });

/* ---------- Weltentor: Startpunkt wählen, Was du riskierst ---------- */
function lGate(from) {
  if (from) LG.from = from;
  setState('menu'); showHud(false);
  const M = lMeta(), starts = lStarts(), sel = starts.find(s => s.id === M.start) || starts[0], lvOk = lCanGo();
  const opts = starts.map(s => { const I = lInfoW(s.x, s.y), rt = lRate(I.stage); return `<button class="opt${s === sel ? ' sel' : ''}" data-act="l_start" data-id="${s.id}" style="${s === sel ? 'box-shadow:inset 0 0 0 3px #ffd24a' : ''}"><span style="color:${s.cp ? '#ffd24a' : '#6ae08a'}">${esc(s.n)}</span><small>${esc(I.B.n)} · ${_t('Stufe {n}', { n: I.stage })} · <b style="color:${rt.c}">${rt.n}</b> · ${s.cp ? lKm(Math.hypot(s.x, s.y)) : _t('Mitte der Welt')}</small></button>`; }).join('');
  const gear = ['weapon', 'armor', 'helm'].map(s => P.gear[s]).filter(Boolean), gv = lSum(gear.map(it => ({ t: 'item', it })));
  const pet = lPet(), anyPet = lPetAny(), bs = pet ? lBagSize(pet) : 0;
  const petHTML = pet ? `<div class="row" style="cursor:default;box-shadow:inset 3px 0 0 var(--moss)"><div class="ic"><img src="${lPetIcon(pet)}" alt=""></div><div><div class="nm" style="color:var(--moss)">${esc(lPetName(pet))}</div><div class="st">${bs ? _t('Tasche mit {n} Plätzen – was darin liegt, überlebt deinen Tod.', { n: bs }) : _t('Hat keine Tasche.')}</div></div><span class="pill">${_t('{n} PLÄTZE', { n: bs })}</span></div>`
    : `<div class="row" style="cursor:default;box-shadow:inset 3px 0 0 var(--blood)"><div class="ic"><img src="${iconURL(['pa', 'l_ei'])}" alt=""></div><div><div class="nm">${anyPet && lPetHurt(anyPet) ? _t('{name} ist verletzt', { name: esc(lPetName(anyPet)) }) : _t('Kein Begleiter dabei')}</div><div class="st">${anyPet && lPetHurt(anyPet) && typeof petHurtLeft === 'function' ? _t('Ruht sich noch {n} Minuten im Versteck aus.', { n: Math.max(1, Math.ceil(petHurtLeft(anyPet) / 60000)) }) + ' ' : ''}${_t('Ohne Begleiter-Tasche ist bei deinem Tod alles verloren.')}</div></div><span></span></div>`;
  const r = lRank(M.rep), nx = LREP[r + 1], nt = lNextTool();
  const box = M.box.length ? `<h3>${_t('FUNDKISTE ({n})', { n: M.box.length })}</h3><p class="sub" style="margin-top:0">${_t('Was beim letzten Mal keinen Platz mehr hatte.')}</p>${M.box.slice(0, 6).map(e => landeLootHTML(e)).join('')}<button class="btn alt sm" data-act="l_box">${_t('Alles abholen')}</button>` : '';
  const tools = `<h3>${_t('WERKZEUGE {n}/{max}', { n: lToolCount(), max: LANDE_TOOLS.length })}</h3><div class="ltools">${LANDE_TOOLS.map((t, i) => `<div class="${lToolBit(i) ? '' : 'no'}" style="--c:${t.c}" title="${esc(t.n)}"><img src="${iconURL(['pa', 'lt_' + t.key])}" alt="${esc(t.n)}"></div>`).join('')}</div>${nt >= 0 ? `<p class="sub" style="margin-top:0">${_t('Als Nächstes: {tool} – für {bar} etwa {d} vom Tor. Horte damit liegen diesseits davon.', { tool: esc(LANDE_TOOLS[nt].n), bar: esc(LBAR[LANDE_TOOLS[nt].bar].n), d: lKm(LRING[nt] * LCK) })}</p>` : `<p class="sub" style="margin-top:0">${_t('Du hast alle Werkzeuge. Die ganze Welt steht dir offen – bis an ihren Rand.')}</p>`}`;
  const body = `<h3 style="margin-top:4px">${_t('STARTPUNKT')}</h3><div class="opts lstart">${opts}</div>
  <div class="kv"><span class="pill" style="background:#ff8a3a">${_t('LEUCHTFEUERSTEINE {n}', { n: M.stones })}</span><span class="pill">${_t('LEUCHTFEUER {n}/{max}', { n: M.cps.length, max: LCPMAX })}</span>${M.keys ? `<span class="pill">${_t('SCHLÜSSEL {n}', { n: M.keys })}</span>` : ''}<button class="btn alt sm" data-act="l_mapg">${_t('Karte der Lande')}</button></div>
  ${tools}
  <h3>${_t('WAS DU RISKIERST · {n} GOLD', { n: fmt(gv) })}</h3>${gear.map(it => landeLootHTML({ t: 'item', it })).join('')}
  <h3>${_t('WAS ÜBERLEBT')}</h3>${petHTML}
  <div class="lrules"><div style="--c:var(--blood)">${_t('Stirbst du, sind Ausrüstung, Rucksack und Sammelbeutel verloren.')}</div><div style="--c:var(--moss)">${_t('Nur die Begleiter-Tasche kommt heim – dein Begleiter teleportiert mit dir zurück.')}</div><div style="--c:#9ae8ff">${_t('Gold, Material und Edelsteine landen im Sammelbeutel – ohne Platzgrenze. Magische Vögel bringen Beute schon unterwegs heim (dabei: {n}).', { n: typeof birdTotal === 'function' ? birdTotal() : 0 })}</div><div style="--c:var(--gold)">${_t('Raus kommst du durch ein Tor der Alten, das Weltentor oder ein Leuchtfeuer: hineinstellen und warten.')}</div><div style="--c:#57c7e6">${_t('Die Karte wird nur gesichert, wenn du ein Leuchtfeuer setzt oder entkommst – wer fällt, vergisst den Weg seit dem letzten Leuchtfeuer.')}</div><div style="--c:var(--blood)">${_t('Abbrechen geht nur außerhalb des Kampfes – wer mitten im Kampf das Spiel schließt, fällt.')}</div></div>
  <h3>${_t('RUF: {n}', { n: LREP[r].n.toLocaleUpperCase(LOCALE) })}</h3>${nx ? `<div class="lbar"><i style="width:${Math.round((M.rep - LREP[r].at) / (nx.at - LREP[r].at) * 100)}%"></i></div><p class="sub" style="margin-top:0">${_t('Noch {n} Ruf bis {r}: {d}', { n: nx.at - M.rep, r: nx.n, d: nx.d })}</p>` : ''}
  <div class="stats"><span>${_t('AUSFLÜGE {n}', { n: M.runs })}</span><span style="color:var(--moss)">${_t('ENTKOMMEN {n}', { n: M.ext })}</span><span style="color:var(--blood)">${_t('GEFALLEN {n}', { n: M.deaths })}</span><span style="color:var(--gold)">${_t('BESTE BEUTE {n}', { n: fmt(M.best) })}</span><span>${_t('REGIONEN {n}', { n: M.regs.length })}</span><span>${_t('WEITESTE REISE {d}', { d: lKm(M.far / 10000 * LWR * LCK) })}</span><span>${_t('GRENZEN {n}/{m}', { n: M.ring, m: LRMAX })}</span>${M.end ? `<span style="color:#ffd24a">${_t('ENDE DER WELT ERREICHT')}</span>` : ''}</div>${box}
  <div class="menu foot"><button class="btn" data-act="l_go" ${lvOk ? '' : 'disabled'}>${lvOk ? _t('Betreten: {n}', { n: esc(sel.n) }) : _t('Ab Level {n} – dir fehlen noch {m}', { n: 5, m: 5 - P.lv })}</button></div>`;
  if (LG.from === 'hide' && typeof stationShell === 'function' && G && G.type === 'versteck') stationShell('weltentor', `<p class="sub" style="margin-top:0">${_t('Hinter dem Tor liegen die Endlosen Lande: eine Welt ohne Ende, für alle dieselbe – die beste Beute, aber wer dort stirbt, verliert, was er trägt.')}</p>${body}`, true);
  else showOverlay(`${lHead(_t('DIE ENDLOSEN LANDE'), 'l_back')}<p class="sub" style="margin-top:0">${_t('Die beste Beute – aber wer dort stirbt, verliert, was er trägt.')}</p>${body}`, true);
}
ON.l_open = id => { lGate(id || 'map'); };
ON.l_start = id => { lMeta().start = id; persist(); sfx('click'); lGate(); };
ON.l_go = () => { landeStart(lMeta().start); };
ON.l_back = () => { if (LG.from === 'map') showMapMore(); else if (LG.from === 'hide') backToHide(); else showTitle(); };
ON.l_box = () => { const M = lMeta(), list = M.box.splice(0), r = lDeliver(list); saveChar(); persist(); sfx('loot'); toast(_t('{n} Dinge abgeholt', { n: r.n - r.box }), '#79c24e'); lGate(); };
HOOK.mapMore.push(() => `<button class="btn" data-act="l_open" data-id="map">${_t('Endlose Lande')}${P && P.lv < 5 ? ' · ' + _t('ab LV 5') : ''}</button>`);
// Hauptmenü mitten im Ausflug: wie Abbrechen
HOOK.titleBtns.push(() => { if (LW && LW.on && P) lAbandon('title'); return ''; });

/* ---------- Weltentor im Versteck: Station, Bild, Wächterin ---------- */
BUILD.weltentor.npc = _t('Torhüterin Ysra'); BUILD.weltentor.body = 'knightf';
SPEAKERS.ysra = { n: _t('Torhüterin Ysra'), sp: 'knightf', c: '#6ae08a' };
NPCTALK.weltentor = [[1, 'ysra', _t('Hinter dem Tor liegen die Endlosen Lande. Wer dort fällt, kommt nackt zurück – wenn überhaupt.')], [1, 'ysra', _t('Nimm deinen Begleiter mit. Was in seiner Tasche steckt, bringt er immer heim.')], [1, 'ysra', _t('Je weiter du gehst, desto härter wird es. Ein Leuchtfeuer sichert den Weg, den du gegangen bist.')], [3, 'ysra', _t('Schluchten, Flüsse, Giftnebel … ohne das richtige Werkzeug kommst du nicht weiter. Die Kundschafterinnen wissen, wo eins liegt.')], [5, 'ysra', _t('Zwanzig Grenzen liegen zwischen hier und dem Rand. Hinter der elften helfen nur noch Meisterwerkzeuge – und am Ende der Welt wartet ein Denkmal auf den, der so weit kommt.')]];
HOOK.station.push((h, id) => { if (h || id !== 'weltentor') return h; lGate('hide'); return true; });
HOOK.drawStation.push((o, x, y, r, lv) => {
  if (o.id !== 'weltentor') return;
  const f = Math.floor(T * 6);
  r(-15, -34, 6, 35, '#4a4652'); r(9, -34, 6, 35, '#4a4652'); r(-15, -34, 2, 35, '#6a6672'); r(9, -34, 2, 35, '#6a6672');
  r(-17, -39, 34, 6, '#5a5662'); r(-17, -39, 34, 1, '#8a8692'); r(-5, -43, 10, 4, '#5a5662'); r(-1, -42, 2, 2, '#6ae08a');
  for (let i = 0; i < 4; i++) { const on = (f + i) % 4 === 0; r(-13, -29 + i * 7, 2, 3, on ? '#c8ffd8' : '#6ae08a'); r(11, -26 + i * 7, 2, 3, on ? '#c8ffd8' : '#6ae08a'); }
  ctx.globalAlpha = .9; drawFxFrame('ring', Math.floor(T * 12) % 14, x, y - 17, .55, 0, false, tintedFx('ring', '#6ae08a')); ctx.globalAlpha = 1;
  ctx.fillStyle = `rgba(90,220,140,${.22 + .12 * Math.sin(T * 3)})`; ctx.fillRect(x - 9, y - 32, 18, 32);
  r(-18, -1, 36, 3, '#3a3440'); r(-16, -2, 32, 1, '#5a5662');
  addLight(x, y - 16, 46, .9); if (Math.random() < .25) part(o.x + rnd(-8, 8), o.y, rnd(0, 26), 0, 0, rnd(10, 30), Math.random() < .5 ? '#6ae08a' : '#c8ffd8', .7, 1, -8, 1);
});
HOOK.artIcon.push(lArt);
// Bilder der Lande; Meisterwerkzeuge (b = Grundwerkzeug): dessen Bild, dazu zwei goldene Striche (II) und ein Funkeln in ihrer Farbe
function lArt(name, b) {
  const ti = name.startsWith('lt_') ? LTOOLK[name.slice(3)] : null, T2 = ti != null ? LANDE_TOOLS[ti] : null;
  if (T2 && T2.b != null) { lArt('lt_' + LANDE_TOOLS[T2.b].key, b); b.rect(0, 0, 1, 5, '#ffd24a'); b.rect(2, 0, 1, 5, '#ffd24a'); b.set(15, 0, '#ffffff'); b.set(14, 1, T2.c); b.set(15, 1, T2.c); b.set(13, 0, T2.c); return; }
  switch (name) {
    case 'tor': b.rect(2, 3, 3, 12, '#5a5662'); b.rect(11, 3, 3, 12, '#5a5662'); b.rect(1, 1, 14, 3, '#6a6672'); b.rect(2, 3, 1, 12, '#8a8692'); b.disc(8, 9, 3.5, '#2e8a52'); b.disc(8, 9, 2.2, '#6ae08a'); b.set(8, 9, '#e0ffe8'); b.set(3, 6, '#6ae08a'); b.set(12, 9, '#6ae08a'); break;
    case 'l_pack': b.rect(4, 4, 8, 10, '#8a5a32'); b.rect(3, 6, 10, 7, '#8a5a32'); b.rect(4, 4, 8, 2, '#b07a48'); b.rect(6, 2, 4, 3, '#5e3a1e'); b.rect(7, 8, 2, 2, '#e8b04a'); b.rect(3, 12, 10, 1, '#5e3a1e'); break;
    case 'l_beutel': b.disc(8, 10, 5, '#6a4224'); b.disc(8, 10, 4, '#a8743e'); b.rect(6, 3, 4, 3, '#a8743e'); b.rect(5, 5, 6, 1, '#4a2a18'); b.rect(5, 2, 2, 1, '#6a4224'); b.rect(9, 2, 2, 1, '#6a4224'); b.disc(7, 9, 1.2, '#d8a868'); b.rect(9, 11, 2, 2, '#e8b04a'); b.set(10, 11, '#ffe08a'); break;   // Sammelbeutel
    case 'l_gold': b.disc(5, 11, 3.5, '#9c6a24'); b.disc(5, 11, 2.6, '#ffd24a'); b.disc(11, 11, 3.5, '#9c6a24'); b.disc(11, 11, 2.6, '#e8b04a'); b.disc(8, 6, 3.5, '#9c6a24'); b.disc(8, 6, 2.6, '#ffe08a'); b.set(7, 5, '#ffffff'); break;
    case 'l_ei': b.disc(8, 9, 5, '#efe2bf'); b.disc(8, 7, 4, '#efe2bf'); b.disc(7, 7, 2, '#fff8e8'); b.set(10, 11, '#c8a87a'); b.set(6, 12, '#c8a87a'); b.set(9, 5, '#c8a87a'); break;
    case 'l_teil': b.rect(3, 6, 10, 4, '#9aa2ae'); b.rect(3, 6, 10, 1, '#d0d6de'); b.rect(6, 3, 4, 10, '#7a828e'); b.set(8, 8, '#e8b04a'); break;
    case 'l_schl': b.disc(4, 8, 3, '#e8b04a'); b.set(4, 8, null); b.rect(7, 7, 7, 2, '#e8b04a'); b.rect(11, 9, 1, 2, '#e8b04a'); b.rect(13, 9, 1, 2, '#e8b04a'); b.set(8, 7, '#ffe08a'); break;
    case 'l_karte': b.rect(3, 3, 10, 10, '#e8dcc0'); b.rect(2, 2, 2, 12, '#c8a87a'); b.rect(12, 2, 2, 12, '#c8a87a'); b.line(5, 10, 8, 6, '#c8463c'); b.line(8, 6, 11, 8, '#c8463c'); b.set(10, 8, '#1a1420'); break;
    case 'l_rolle': b.rect(3, 4, 10, 8, '#e8dcc0'); b.rect(2, 3, 2, 10, '#b89060'); b.rect(12, 3, 2, 10, '#b89060'); b.disc(8, 8, 2, '#6ae08a'); b.set(8, 8, '#ffffff'); break;
    case 'l_tausch': b.rect(2, 5, 9, 2, '#79c24e'); b.rect(9, 3, 2, 6, '#79c24e'); b.rect(5, 10, 9, 2, '#e8b04a'); b.rect(5, 8, 2, 6, '#e8b04a'); b.set(11, 6, '#79c24e'); b.set(4, 11, '#e8b04a'); break;
    case 'l_auftrag': b.rect(4, 2, 8, 12, '#e8dcc0'); b.rect(4, 2, 8, 1, '#c8a87a'); b.rect(6, 5, 4, 1, '#57c7e6'); b.rect(6, 8, 4, 1, '#8a7a6a'); b.rect(6, 11, 3, 1, '#8a7a6a'); b.rect(12, 3, 1, 4, '#57c7e6'); b.set(12, 8, '#57c7e6'); break;
    case 'l_heil': b.rect(6, 2, 4, 12, '#e8402a'); b.rect(2, 6, 12, 4, '#e8402a'); b.rect(7, 3, 1, 10, '#ff8a7a'); b.rect(3, 7, 10, 1, '#ff8a7a'); break;
    case 'l_feuer': b.rect(5, 11, 6, 4, '#5a5662'); b.rect(4, 10, 8, 2, '#7a7682'); b.disc(8, 7, 3.5, '#ff6a2a'); b.disc(8, 8, 2.2, '#ffd24a'); b.rect(7, 2, 2, 3, '#ff8a3a'); b.set(8, 8, '#fff8d0'); break;
    case 'l_mod': b.disc(8, 8, 5.5, '#3a2a5a'); b.disc(8, 8, 4, '#b892f4'); b.rect(7, 4, 2, 8, '#ffffff'); b.rect(4, 7, 8, 2, '#e8d8ff'); break;
    // Werkzeuge
    case 'lt_seil': b.disc(7, 9, 5, '#8a6a3a'); b.disc(7, 9, 3, '#5e462e'); b.disc(7, 9, 1.5, '#c8a070'); b.line(11, 6, 14, 2, '#9aa2ae'); b.line(14, 2, 12, 1, '#9aa2ae'); b.set(3, 8, '#c8a070'); b.set(10, 12, '#c8a070'); break;
    case 'lt_brueckenstein': b.rect(3, 4, 10, 9, '#6a6672'); b.rect(3, 4, 10, 2, '#8a8692'); b.rect(3, 12, 10, 1, '#4a4652'); b.rect(7, 6, 2, 5, '#9ad0ff'); b.rect(5, 8, 6, 1, '#9ad0ff'); b.set(8, 7, '#ffffff'); break;
    case 'lt_kraeutermaske': b.disc(8, 8, 5.5, '#c8b890'); b.rect(4, 6, 3, 2, '#1a1420'); b.rect(9, 6, 3, 2, '#1a1420'); b.disc(8, 12, 2.5, '#5aa83a'); b.set(4, 3, '#79c24e'); b.set(12, 3, '#79c24e'); b.set(3, 4, '#79c24e'); b.set(13, 4, '#79c24e'); break;
    case 'lt_eishaken': b.line(5, 14, 10, 3, WOOD[1]); b.line(6, 14, 11, 3, WOOD[0]); b.rect(8, 2, 6, 2, '#d8f0ff'); b.line(13, 3, 14, 6, '#a8d0e8'); b.line(8, 3, 6, 5, '#a8d0e8'); b.set(10, 2, '#ffffff'); break;
    case 'lt_feuermantel': for (let y = 3; y < 15; y++) { const hw = 2 + Math.round((y - 3) * .35); b.rect(8 - hw, y, hw * 2, 1, y < 6 ? '#e8b04a' : '#c8401e'); } b.rect(6, 3, 4, 2, '#e8b04a'); b.line(5, 8, 4, 14, '#ff8a3a'); b.line(11, 8, 12, 14, '#7a1e10'); break;
    case 'lt_schattenlaterne': b.rect(7, 1, 2, 2, '#5a5662'); b.rect(5, 3, 6, 2, '#5a5662'); b.rect(5, 5, 6, 7, '#ffe08a'); b.rect(5, 5, 1, 7, '#5a5662'); b.rect(10, 5, 1, 7, '#5a5662'); b.disc(8, 8, 1.6, '#ffffff'); b.rect(5, 12, 6, 2, '#5a5662'); break;
    case 'lt_gezeitenperle': b.disc(8, 11, 5, '#c8a87a'); b.rect(3, 11, 11, 4, '#c8a87a'); b.disc(8, 8, 3.5, '#e8f8ff'); b.disc(7, 7, 1.6, '#ffffff'); b.set(10, 9, '#57c7e6'); b.rect(3, 13, 11, 1, '#8a6a3a'); break;
    case 'lt_dornenklinge': b.line(3, 13, 12, 3, '#79c24e'); b.line(4, 13, 13, 3, '#3a7a2a'); for (const [x, y] of [[6, 10], [9, 7], [11, 5]]) { b.set(x - 1, y - 1, '#c8b070'); b.set(x + 1, y + 1, '#c8b070'); } b.rect(2, 13, 3, 2, WOOD[0]); break;
    case 'lt_sturmfeder': b.line(4, 14, 11, 2, '#8a92a2'); for (let i = 0; i < 9; i++) { const x = 5 + i * .75, y = 12 - i * 1.25; b.line(x, y, x + 3, y - 1, '#e8ecf4'); b.line(x, y, x - 2, y - 2, '#c8d0e0'); } b.set(11, 2, '#ffffff'); break;
    case 'lt_sternenschluessel': b.rect(7, 7, 2, 8, '#b0b8ff'); b.rect(9, 12, 2, 1, '#b0b8ff'); b.rect(9, 14, 2, 1, '#b0b8ff'); b.disc(8, 5, 3.5, '#4a4ad0'); b.set(8, 1, '#ffffff'); b.set(4, 5, '#ffffff'); b.set(12, 5, '#ffffff'); b.disc(8, 5, 1.5, '#ffffff'); break;
    case 'lt_leereanker': b.rect(7, 2, 2, 11, '#c060ff'); b.disc(8, 3, 2, '#c060ff'); b.set(8, 3, null); b.rect(5, 5, 6, 1, '#c060ff'); b.line(3, 10, 8, 14, '#9a40d8'); b.line(13, 10, 8, 14, '#9a40d8'); b.set(3, 9, '#ffffff'); b.set(13, 9, '#ffffff'); break;
  }
}
HOOK.boot.push(() => { try { if (LG.note) { toast(LG.note, '#e8b04a'); LG.note = null; } } catch (_) { } });
