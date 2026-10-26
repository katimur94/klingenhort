'use strict';
/* =========================================================
   KLINGENHORT – Artefakte, Spuren & mystische Begegnungen: Geschichten, Hinweise, Schatzorte, Chronik
   Hängt sich über HOOK/ON (js/core.js) ins Spiel ein.
   Über 5000 Artefakte in über 800 Spuren (3–9 Artefakte je Spur), fest aus ARTE_SEED – für alle Spieler gleich.
   Jede Spur: eine kleine Geschichte (Thema, Figuren, Orte), jedes Artefakt verrät, wo das nächste liegt (Richtung, Schritte,
   Gelände) und legt einen Suchkreis auf die Weltkarte. Das letzte führt zu einem versiegelten Schatz – das Siegel bricht,
   wenn alle Artefakte der Spur gefunden sind.
   Welt-Konvention 6.1: Chunk 768 px, Weltradius 9000 Chunks, Tiefe = Abstand zum Tor / 9000, Weltentor in Chunk (0, 0).
   Schnittstelle (für die Welt, js/lande.js):
     arteDef(id) → { id, chain, idx, kind, kindName, name, icon, text, parts, last }   (ARTE_N Artefakte, ARTE_NC Spuren)
     arteInChunk(ctx) → [{ id, x, y, chain, idx, kind, name, icon, next, take() }]   nicht gefundene Fundstellen (Welt-px)
     arteTreasureInChunk(ctx) → [{ id: 'T' + Spur, chain, x, y, ready, name, open() }]   Schatzorte (ready = Siegel bricht)
     arteHints() → [{ x, y, r, label, c, k, chain, track }]   Suchkreise für die Karte (Welt-px)
     artePickup(id) / arteTreasureOpen(chain) – dasselbe wie take()/open(); Beute am Boden { k: 'arte', id } geht auch (HOOK.collect)
     arteRumor(cx, cy) → { chain, text, x, y } Gerücht über die nächste unentdeckte Spur (z. B. für Elwa)
     arteChronik(back) Chronik öffnen · arteRead(id, back) Lesebildschirm · arteIconURL(kind, v)
     encounterRoll(ctx) → null | { key, x, y, depth, name }   selten, je Chunk und Ausflug fest
     encounterOpen(enc) Dialog mit Bild und Wahl; nutzt enc.teleport(x, y) und enc.done(ergebnis), wenn die Welt sie mitgibt
   Benutzt (alles optional, mit typeof-Prüfung): landeCtx(cx, cy), LANDE_BIOMES, landeActive(), landeDepth(), landePos(),
     worldStage(d), landeToolGive(k), landeToolHas(k), LANDE_TOOLS, eggGive, modRoll, modGive, modName, bossForLair, bossSpawn
   Konto: SAVE.meta.arte = { v, f: Bits gefundener Artefakte, t: Bits geöffneter Schätze, c: Bits abgeholter Abschriften,
     tr: verfolgte Spur, ru: [Gerüchte], enc: { Begegnung: Anzahl }, ms: Meilensteine, nw: [neue Funde], g: [Wächter besiegt] }
   ========================================================= */

/* ---------- Grundwerte ---------- */
const ARTE_SEED = 61061, ARTE_NC = 830, ACK = 768, AWR = 9000, ASTEP = 16;   // Spuren, Chunk-Größe, Weltradius, px je Schritt
const AGATE = .5;   // das Weltentor steht in der Mitte von Chunk (0, 0)
function aH(a, b, c, d) { let h = 0x9E3779B9 ^ ARTE_SEED; for (const x of [a, b, c, d]) { if (x === undefined) break; h = Math.imul(h ^ (x | 0), 0x85EBCA6B); h ^= h >>> 13; h = Math.imul(h, 0xC2B2AE35); h ^= h >>> 16; } return h >>> 0; }
const aPk = (R, a) => a[Math.floor(R() * a.length)];
function aShuf(R, a) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(R() * (i + 1)), t = a[i]; a[i] = a[j]; a[j] = t; } return a; }
function aFill(t, V) { const r = String(t).replace(/\{(\w+)\}/g, (m, k) => (V[k] != null ? V[k] : m)); return V.schritte != null ? r.split(V.schritte + ' ').join(V.schritte + '\u00a0') : r; }   // „450 Schritte“ bricht nicht um
function aNum(n) { try { return Number(n).toLocaleString(typeof LOCALE !== 'undefined' ? LOCALE : 'de-DE'); } catch (_) { return String(n); } }
function aLocal() { return SAVE && SAVE.meta ? SAVE.meta.arte : null; }

/* ---------- Namen (Eigennamen bleiben in allen Sprachen gleich) ---------- */
const ANM = [
  { f: ['Hallvard', 'Sigrun', 'Brynja', 'Torvald', 'Ragna', 'Eirik', 'Asla', 'Kjell', 'Ylva', 'Gunnar', 'Hedda', 'Ulvar', 'Ingrid', 'Sten', 'Freya', 'Orm', 'Tove', 'Leif', 'Runa', 'Halla', 'Vidar', 'Solveig', 'Arne', 'Dagny', 'Ivar', 'Liv', 'Bjarke', 'Thyra'],
    l: ['Brenn', 'Eskeland', 'Hrafnsson', 'Kaldmoor', 'Steinvik', 'Ulfhed', 'Vinter', 'Grimsdal', 'Haldor', 'Skarvik', 'Torbrand', 'Isfjell', 'Lodmark', 'Rimvald'] },
  { f: ['Ithriel', 'Sylvaen', 'Aelira', 'Caelum', 'Mireth', 'Elenwe', 'Thalion', 'Ysara', 'Lorien', 'Vaelis', 'Naeris', 'Faelan', 'Ilyndra', 'Aerin', 'Seren', 'Liriel', 'Calen', 'Eluvien', 'Tirael', 'Amarel', 'Noviel', 'Riellan', 'Shael', 'Varien'],
    l: ['Silberblatt', 'Morgentau', 'Sternquell', 'Windlied', 'Nachthain', 'Mondbach', 'Lichtwind', 'Tauglanz', 'Dämmerweide', 'Funkenhain', 'Nebelsang', 'Glanzfeder'] },
  { f: ['Zahir', 'Amaru', 'Selene', 'Tarik', 'Nesrin', 'Kaveh', 'Ilyas', 'Oruna', 'Bahira', 'Darian', 'Ishara', 'Rami', 'Talia', 'Soraya', 'Kian', 'Mehra', 'Navid', 'Esra', 'Yaro', 'Lejla', 'Omid', 'Ziva', 'Arash', 'Neyla'],
    l: ['Sandwind', 'Ibn Kesh', 'Oasenhain', 'Sonnstein', 'Dünenfels', 'Al-Maruk', 'Goldstaub', 'Karawe', 'Sternbrunn', 'Salzhand', 'Rotsand', 'Mirabay'] },
  { f: ['Dorgin', 'Brumli', 'Thrain', 'Gundra', 'Balin', 'Hilda', 'Korrin', 'Durna', 'Grimbald', 'Malva', 'Borri', 'Thekla', 'Ulrik', 'Ragnhild', 'Fundin', 'Sigga', 'Nori', 'Brunhild', 'Kili', 'Hulda', 'Orik', 'Gerda', 'Tharbad', 'Esse'],
    l: ['Eisenbart', 'Steinfaust', 'Glutamboss', 'Tiefgrund', 'Erzhammer', 'Kupferzahn', 'Felsbrecher', 'Silberader', 'Funkenbart', 'Kohlenherz', 'Grubenlicht', 'Hammerschlag'] }
];
const APL = [
  [['Hall', 'Esk', 'Brann', 'Kald', 'Ulfs', 'Grim', 'Skar', 'Vint', 'Hrafn', 'Tor', 'Isen', 'Rim', 'Sval', 'Ask'], ['vor', 'moor', 'sted', 'havn', 'heim', 'dal', 'vik', 'fjell', 'gard', 'holt', 'mark', 'by']],
  [['Ith', 'Syl', 'Ael', 'Mir', 'Elen', 'Cael', 'Lor', 'Thal', 'Ys', 'Vaer', 'Nim', 'Lune', 'Eld', 'Sil'], ['andor', 'ien', 'wyn', 'aris', 'ethil', 'mar', 'iel', 'ora', 'thas', 'quen', 'lith', 'dell']],
  [['Zan', 'Ka', 'Amar', 'Sel', 'Tah', 'Ruma', 'Ish', 'Oru', 'Bal', 'Nesh', 'Qad', 'Sur', 'Mira', 'Ash'], ['dar', 'ir', 'esh', 'ana', 'ukar', 'im', 'ora', 'abad', 'un', 'is', 'ahn', 'el']],
  [['Dun', 'Khaz', 'Brom', 'Gor', 'Durn', 'Thra', 'Bar', 'Mor', 'Kar', 'Grun', 'Ost', 'Zir', 'Bel', 'Nar'], ['grund', 'mar', 'dol', 'kul', 'dum', 'bar', 'rak', 'hold', 'gath', 'zan', 'tor', 'helm']]
];
const ATRS = [['Aure', 'Mor', 'Ith', 'Vael', 'Sol', 'Nyx', 'Cael', 'Ser', 'Ory', 'Thal', 'Lum', 'Ar', 'Ven', 'Zeph', 'Kor', 'Ely', 'Astr', 'Iri', 'Quel', 'Sev'], ['lith', 'vaine', 'andris', 'mir', 'oth', 'ael', 'yra', 'eth', 'ion', 'ara', 'is', 'orn', 'iel', 'une', 'ax', 'ysse', 'ond', 'anth']];
const ABST = [['Skar', 'Vhol', 'Grath', 'Ur', 'Nag', 'Xir', 'Bal', 'Kro', 'Zul', 'Dra', 'Mor', 'Fen', 'Hal', 'Shar', 'Tor'], ['nath', 'gor', 'mok', 'zhul', 'thar', 'rax', 'ghast', 'vor', 'mira', 'ith', 'gul', 'riel', 'dris', 'kan']];
const AGOD = ['Ylvane', 'Oruth', 'Senne', 'Varna', 'Ilmar', 'Aethra', 'Moros', 'Thessa', 'Calyx', 'Nymara', 'Orrin', 'Saelith'];
const ANMM = [['Hallvard', 'Torvald', 'Eirik', 'Kjell', 'Gunnar', 'Ulvar', 'Sten', 'Orm', 'Leif', 'Vidar', 'Arne', 'Ivar', 'Bjarke'], ['Caelum', 'Thalion', 'Faelan', 'Calen', 'Varien', 'Riellan', 'Aldeth', 'Corvan'], ['Zahir', 'Amaru', 'Tarik', 'Kaveh', 'Ilyas', 'Darian', 'Rami', 'Kian', 'Navid', 'Yaro', 'Omid', 'Arash'], ['Dorgin', 'Brumli', 'Thrain', 'Balin', 'Korrin', 'Grimbald', 'Borri', 'Ulrik', 'Fundin', 'Nori', 'Kili', 'Orik', 'Tharbad']];
function aPlace(R, cu) { const P_ = APL[cu]; let s = aPk(R, P_[0]) + aPk(R, P_[1]); if (R() < .12) s = aPk(R, P_[0]) + aPk(R, P_[1]).replace(/^./, '') + ' ' + aPk(R, P_[0]) + aPk(R, P_[1]); return s; }
function aPerson(R, cu, full, male) { const N = ANM[cu]; return aPk(R, male ? ANMM[cu] : N.f) + (full ? ' ' + aPk(R, N.l) : ''); }
function aWord(R, S) { return aPk(R, S[0]) + aPk(R, S[1]); }

/* ---------- Himmelsrichtungen (0 = Osten, gegen den Uhrzeigersinn) ---------- */
const ADIR = [_t('Osten'), _t('Nordosten'), _t('Norden'), _t('Nordwesten'), _t('Westen'), _t('Südwesten'), _t('Süden'), _t('Südosten')];
function aDirIdx(dx, dy) { return ((Math.round(Math.atan2(-dy, dx) / (Math.PI / 4)) % 8) + 8) % 8; }
function aSteps(d) { const s = d / ASTEP; return Math.max(50, s < 1000 ? Math.round(s / 50) * 50 : Math.round(s / 100) * 100); }

/* ---------- Gelände: Schlüssel und Name der Welt (js/lande.js) → Art des Ortes für die Hinweise ---------- */
const ATERR = [
  ['kalt', /schnee|eis|frost|gletsch|tundra|kalt|winter|firn/],
  ['heiss', /lava|glut|asche|vulkan|feuer|brand|magma|schlacke/],
  ['gift', /gift|seuche|toxi|faul|pest|säure|saeure/],
  ['sumpf', /sumpf|moor|morast|marsch|bruch|schlick/],
  ['pilz', /pilz|spor|myzel/],
  ['kristall', /kristall|glas|prisma|edel|juwel/],
  ['wueste', /wüste|wueste|sand|dün|duen|steppe|öde|oede|salz/],
  ['schatten', /schatten|leere|nacht|dunkel|void|finster|abgrund|riss/],
  ['wasser', /see|küste|kueste|strand|meer|fluss|wasser|ufer|lagune|riff|teich/],
  ['sturm', /sturm|wind|gewitter|blitz|himmel|wolke/],
  ['ruine', /ruine|tempel|stadt|grab|gruft|friedhof|trümmer|truemmer/],
  ['wald', /wald|hain|forst|dschungel|urwald|baum|dickicht/],
  ['fels', /fels|berg|klipp|schlucht|gebirg|stein|hoch|gipfel|canyon|kluft/],
  ['wiese', /wiese|feld|flur|ebene|heide|weide|gras|aue|blumen/]
];
// {gelaende}: ein Nebensatz, der mit „wo“ beginnt – so passt er hinter „dort,“ und „dorthin,“ ohne Artikel
const AWO = {
  kalt: [_t('wo der Atem in der Luft gefriert'), _t('wo Eis wie Glas unter den Stiefeln knirscht'), _t('wo der Schnee nie schmilzt')],
  heiss: [_t('wo die Erde glüht'), _t('wo Asche wie grauer Schnee fällt'), _t('wo die Luft vor Hitze flimmert')],
  gift: [_t('wo giftige Dämpfe aus dem Boden steigen'), _t('wo nichts Gesundes mehr wächst'), _t('wo die Pfützen grün leuchten')],
  sumpf: [_t('wo der Boden bei jedem Schritt schmatzt'), _t('wo Nebel über schwarzem Wasser liegt'), _t('wo das Schilf höher wächst als ein Mensch')],
  pilz: [_t('wo Pilze so groß wie Häuser stehen'), _t('wo leuchtende Sporen durch die Luft treiben'), _t('wo der Boden weich und warm ist')],
  kristall: [_t('wo Kristalle wie Bäume aus dem Boden wachsen'), _t('wo das Licht in tausend Farben bricht'), _t('wo die Steine von selbst leuchten')],
  wueste: [_t('wo der Sand bei Nacht singt'), _t('wo die Dünen wandern wie Tiere'), _t('wo die Sonne alles verbrennt')],
  schatten: [_t('wo das Licht zu sterben scheint'), _t('wo die Schatten länger sind als die Dinge'), _t('wo die Stille in den Ohren dröhnt')],
  wasser: [_t('wo das Wasser ans Ufer schlägt'), _t('wo die Luft nach Salz schmeckt'), _t('wo der Nebel vom Wasser aufsteigt')],
  sturm: [_t('wo der Sturm niemals schläft'), _t('wo Blitze in die Felsen fahren'), _t('wo der Wind dir die Worte vom Mund reißt')],
  ruine: [_t('wo eingestürzte Mauern von alten Zeiten erzählen'), _t('wo zerbrochene Säulen im Gras liegen'), _t('wo einst eine Stadt stand')],
  wald: [_t('wo die Bäume so dicht stehen, dass es mittags dämmert'), _t('wo alte Wurzeln den Weg verschlingen'), _t('wo das Moos jeden Laut verschluckt')],
  fels: [_t('wo die Felsen wie Zähne aus dem Boden ragen'), _t('wo der Wind durch steinerne Schluchten heult'), _t('wo kaum ein Halm zwischen den Steinen wächst')],
  wiese: [_t('wo das Gras im Wind wogt wie ein Meer'), _t('wo wilde Blumen bis zum Horizont blühen'), _t('wo nichts ist als Himmel und Gras')],
  x: [_t('wo sich das Land verändert'), _t('wo ein Stein mit einem eingeritzten Kreuz steht'), _t('wo es stiller wird als hier'), _t('wo der Weg sich gabelt')]
};
// Wie der Fund daliegt (erste Zeile des Lesebildschirms), je Gelände des Fundorts
const AFUND = {
  kalt: [_t('Der Fund ist von Raureif überzogen, als hätte er lange auf dich gewartet.'), _t('Halb im Schnee vergraben liegt der Fund.'), _t('Der Wind hat Schnee über den Fund geweht, doch eine Ecke schaut hervor.')],
  heiss: [_t('Der Fund ist noch warm von der glühenden Erde.'), _t('Asche bedeckt den Fund wie eine graue Decke.'), _t('Zwischen glimmenden Steinen, kaum zu berühren, liegt der Fund.')],
  gift: [_t('Giftiger Dunst liegt über dem Fund, doch er ist unversehrt.'), _t('Ringsum ist alles verdorrt – nur der Fund hat überdauert.'), _t('Am Rand einer grün schimmernden Pfütze liegt der Fund, seltsam unberührt.')],
  sumpf: [_t('Der Fund steckt im Schlamm, nur eine Ecke ragt heraus.'), _t('Moos hat den Fund fast verschluckt.'), _t('Zwischen Schilf und schwarzem Wasser schimmert der Fund.')],
  pilz: [_t('Leuchtende Sporen tanzen über dem Fund.'), _t('Zwischen weichen Pilzhüten, gut verborgen, liegt der Fund.'), _t('Ein Pilz ist halb über den Fund gewachsen, als wolle er ihn behalten.')],
  kristall: [_t('Kristalle sind um den Fund gewachsen wie eine Hand, die ihn festhält.'), _t('Der Fund funkelt zwischen Kristallen, als gehöre er dazu.'), _t('Im Licht der Kristalle wirft der Fund tausend kleine Schatten.')],
  wueste: [_t('Der Wind hat den Fund aus dem Sand gegraben.'), _t('Halb im Sand begraben, heiß von der Sonne, liegt der Fund.'), _t('Eine Düne hat den Fund freigegeben – für wie lange, weiß niemand.')],
  schatten: [_t('Selbst im Dunkel ist der Fund zu sehen, als leuchte er von innen.'), _t('Kalte Schatten kriechen um den Fund und weichen zurück, als du näher kommst.'), _t('Der Fund liegt im Dunkeln, aber er flüstert, als du vorbeigehst.')],
  wasser: [_t('Das Wasser hat den Fund ans Ufer gespült.'), _t('Algen und kleine Muscheln haften am Fund.'), _t('Zwischen nassen Steinen am Ufer glänzt der Fund.')],
  sturm: [_t('Der Sturm hat den Fund freigelegt.'), _t('Zwischen umgestürzten Steinen, vom Wind blank gefegt, liegt der Fund.'), _t('Der Wind zerrt an dir, als wolle er dir den Fund nicht gönnen.')],
  ruine: [_t('Zwischen zerbrochenen Säulen liegt der Fund.'), _t('Unter einer eingestürzten Mauer wartet der Fund.'), _t('Auf einem umgestürzten Altar, wie für dich bereitgelegt, liegt der Fund.')],
  wald: [_t('Zwischen Wurzeln versteckt, von Laub bedeckt, liegt der Fund.'), _t('Ein Eichhörnchen hat den Fund offenbar für eine Nuss gehalten und vergraben.'), _t('Unter einem umgestürzten Baumstamm, trocken und sicher, liegt der Fund.')],
  fels: [_t('In einer Felsspalte, geschützt vor Wind und Regen, liegt der Fund.'), _t('Unter einem Steinhaufen, aufgeschichtet wie ein kleines Grab, liegt der Fund.'), _t('Auf einem flachen Stein, als hätte jemand ihn für dich hingelegt, liegt der Fund.')],
  wiese: [_t('Im hohen Gras glitzert etwas – der Fund.'), _t('Wildblumen wachsen um den Fund herum, als wollten sie ihn bewachen.'), _t('Ein Kaninchenbau hat den Fund wieder ans Licht gebracht.')],
  x: [_t('Zwischen Steinen und Wurzeln, fast übersehen, liegt der Fund.'), _t('Jemand hat den Fund sorgfältig versteckt – aber nicht sorgfältig genug.'), _t('Ein schwaches Glimmen hat dich hergeführt.'), _t('Unter einer Schicht aus Staub und Zeit wartet der Fund.'), _t('Fast wärst du daran vorbeigelaufen.'), _t('Ein Lichtstrahl fällt genau auf den Fund, als hätte jemand gewollt, dass du ihn siehst.')]
};
const ATCACHE = new Map();
// Gelände eines Chunks: { k: Art, b: Gebietsname, r: Regionsname, l: Wahrzeichen } – ohne Welt: Art 'x'
function aTerrain(cx, cy) {
  const key = cx * 20011 + cy; if (ATCACHE.has(key)) return ATCACHE.get(key);
  let o = { k: 'x', b: '', r: '', l: '' };
  try {
    if (typeof landeCtx === 'function') {
      const c = landeCtx(cx, cy) || {}, bk = c.biome != null ? String(c.biome) : '', B = typeof LANDE_BIOMES !== 'undefined' && LANDE_BIOMES ? LANDE_BIOMES[bk] : null;
      const nm = B ? String(B.n || B.name || '') : '';
      o.k = aCatOf(bk);
      o.b = nm; o.r = String(c.regionName || c.rname || (typeof landeRegionName === 'function' ? landeRegionName(c.region, c) || '' : '') || '');
      o.l = String(c.landmark || c.poiName || '');
    }
  } catch (_) { o = { k: 'x', b: '', r: '', l: '' }; }
  if (ATCACHE.size > 4000) ATCACHE.clear();
  ATCACHE.set(key, o); return o;
}

/* ---------- Arten von Artefakten: Name, Bild, wie man sie liest ---------- */
// w = geschrieben (Text steht direkt da), sonst eine Stimme/Vision (Text in Anführungszeichen)
const AKIND = {
  tagebuch: { n: _t('Tagebuchseite'), w: 1, nm: [_t('Tagebuchseite von {ich}'), _t('Eingerissene Tagebuchseite'), _t('Seite aus dem Tagebuch von {ich}')], fr: [_t('Die Schrift ist eng und hastig, als hätte jemand im Gehen geschrieben:'), _t('Die Seite ist fleckig, aber die Worte sind noch gut zu lesen:')] },
  brief: { n: _t('Brief'), w: 1, nm: [_t('Brief von {ich}'), _t('Versiegelter Brief'), _t('Brief an {du}')], fr: [_t('Das Siegel ist gebrochen, der Brief viele Male gelesen:'), _t('Ein Brief, oft gefaltet und wieder geglättet:')] },
  tafel: { n: _t('Steintafel'), w: 1, nm: [_t('Steintafel aus {ort}'), _t('Verwitterte Steintafel'), _t('Steintafel mit Runenrand')], fr: [_t('In den Stein gemeißelt, halb verwittert:'), _t('Die Buchstaben auf der Tafel sind tief eingeritzt, als sollten sie ewig halten:')] },
  rolle: { n: _t('Schriftrolle'), w: 1, nm: [_t('Schriftrolle von {ich}'), _t('Versiegelte Schriftrolle'), _t('Brüchige Schriftrolle')], fr: [_t('Die Rolle knistert, als du sie entrollst. Darauf steht:'), _t('Unter einem zerbrochenen Wachssiegel steht:')] },
  karte: { n: _t('Karte'), w: 1, nm: [_t('Kartenfetzen'), _t('Karte von {ich}'), _t('Karte mit roten Kreuzen')], fr: [_t('Auf der Rückseite der Karte, in winziger Schrift:'), _t('Am Rand der Karte, zwischen Linien und Kreuzen:')] },
  figur: { n: _t('Figur'), w: 1, nm: [_t('Geschnitzte Figur'), _t('Holzfigur von {ich}'), _t('Kleine Steinfigur')], fr: [_t('Um die Figur ist ein Zettel gewickelt:'), _t('In den Sockel der Figur ist eine Botschaft geritzt:')] },
  kompass: { n: _t('Kompass'), w: 1, nm: [_t('Kompass von {ich}'), _t('Messingkompass'), _t('Kompass ohne Norden')], fr: [_t('Die Nadel zittert. In den Deckel ist eingraviert:'), _t('Unter dem Glas des Kompasses steckt ein gefalteter Zettel:')] },
  feder: { n: _t('Feder'), w: 1, nm: [_t('Schreibfeder von {ich}'), _t('Silberne Feder'), _t('Rabenfeder')], fr: [_t('Kaum berührst du die Feder, schreibt sie von selbst in die Luft:'), _t('Die Feder ist noch feucht von Tinte. Neben ihr liegt ein Blatt:')] },
  amulett: { n: _t('Amulett'), nm: [_t('Amulett von {ich}'), _t('Mondsilber-Amulett'), _t('Amulett mit Rabenwappen')], fr: [_t('Als du das Amulett berührst, hörst du eine Stimme, ganz nah:'), _t('Das Amulett wird warm in deiner Hand, und jemand spricht zu dir:')] },
  ring: { n: _t('Siegelring'), nm: [_t('Siegelring von {ich}'), _t('Siegelring von {orden}'), _t('Schwerer Siegelring')], fr: [_t('Als du den Ring ansteckst, sprechen fremde Erinnerungen in deinem Kopf:'), _t('Der Ring ist eiskalt. Für einen Herzschlag hörst du:')] },
  muenze: { n: _t('Münze'), nm: [_t('Münze aus {ort}'), _t('Uralte Goldmünze'), _t('Münze von {orden}')], fr: [_t('Du drehst die Münze im Licht. Das geprägte Gesicht bewegt die Lippen:'), _t('Die Münze klingt, als du sie hochwirfst, und der Klang wird zu Worten:')] },
  schaedel: { n: _t('Kristallschädel'), nm: [_t('Kristallschädel'), _t('Flüsternder Kristallschädel'), _t('Kristallschädel aus {ort}')], fr: [_t('Der Kristallschädel glimmt auf, und eine hohle Stimme spricht:'), _t('In den Augenhöhlen des Schädels flackert Licht. Eine Stimme flüstert:')] },
  rune: { n: _t('Runenstein'), nm: [_t('Runenstein'), _t('Runenstein von {orden}'), _t('Glimmender Runenstein')], fr: [_t('Die Runen leuchten auf, eine nach der anderen, und formen Worte in deinem Kopf:'), _t('Der Stein summt, und die Zeichen werden zu einer Stimme:')] },
  spieluhr: { n: _t('Spieluhr'), nm: [_t('Spieluhr'), _t('Spieluhr von {ich}'), _t('Verbeulte Spieluhr')], fr: [_t('Die Spieluhr spielt eine wehmütige Melodie. Zwischen den Tönen hörst du:'), _t('Du ziehst die Spieluhr auf. Statt einer Melodie erklingt eine Stimme:')] },
  muschel: { n: _t('Muschel'), nm: [_t('Singende Muschel'), _t('Muschel von {du}'), _t('Perlmuttmuschel')], fr: [_t('Du hältst die Muschel ans Ohr. Statt Meeresrauschen hörst du:'), _t('Die Muschel singt leise, und aus dem Gesang wird eine Stimme:')] },
  scherbe: { n: _t('Spiegelscherbe'), nm: [_t('Spiegelscherbe'), _t('Scherbe aus {ort}'), _t('Dunkle Spiegelscherbe')], fr: [_t('In der Scherbe siehst du nicht dich, sondern ein fremdes Gesicht. Es spricht:'), _t('Die Scherbe zeigt einen fremden Ort, und eine Stimme erzählt:')] },
  floete: { n: _t('Knochenflöte'), nm: [_t('Knochenflöte'), _t('Knochenflöte von {ich}'), _t('Geschnitzte Flöte')], fr: [_t('Du bläst in die Flöte. Der Ton formt Worte:'), _t('Ein einziger Ton aus der Flöte – und er erzählt eine Geschichte:')] },
  laterne: { n: _t('Laterne'), nm: [_t('Laterne'), _t('Laterne von {ich}'), _t('Rußige Laterne')], fr: [_t('Die Laterne entzündet sich von selbst. In ihrem Licht hörst du eine Stimme:'), _t('Ein bleiches Licht flackert in der Laterne, und jemand sagt:')] }
};
const AKINDS = Object.keys(AKIND);

/* ---------- Hinweise auf den nächsten Fundort ---------- */
// geschrieben: in der Stimme der Erzählerin oder des Erzählers
const ACLUEW = [
  _t('Ich gehe weiter nach {richtung}. Nach etwa {schritte} Schritten, dort, {gelaende}, will ich rasten.'),
  _t('Den Rest meiner Aufzeichnungen habe ich {schritte} Schritte nach {richtung} von hier versteckt, dort, {gelaende}.'),
  _t('Wer mir folgen will: {schritte} Schritte nach {richtung}, dorthin, {gelaende}.'),
  _t('Morgen breche ich nach {richtung} auf. {schritte} Schritte, sagt die Karte, dann bin ich dort, {gelaende}.'),
  _t('Etwas ruft mich nach {richtung}. Ich schätze, {schritte} Schritte – dorthin, {gelaende}.'),
  _t('Das nächste Zeichen lasse ich {schritte} Schritte weiter im {richtung} zurück, dort, {gelaende}.'),
  _t('Mein Weg führt nach {richtung}. Zähl {schritte} Schritte, dann such dort, {gelaende}.'),
  _t('Falls ich nicht zurückkomme: Ich bin nach {richtung} gegangen, etwa {schritte} Schritte weit, dorthin, {gelaende}.')
];
// Stimmen und Visionen: der Erzähler (das Spiel) beschreibt, was du danach weißt
const ACLUEV = [
  _t('Dann verblasst die Stimme. Zurück bleibt ein Bild: ein Ort etwa {schritte} Schritte nach {richtung}, dort, {gelaende}.'),
  _t('Als es still wird, weißt du plötzlich, wohin du gehen musst: {schritte} Schritte nach {richtung}, dorthin, {gelaende}.'),
  _t('Ein Ziehen in deiner Brust weist nach {richtung}. Rund {schritte} Schritte, schätzt du – dorthin, {gelaende}.'),
  _t('Bevor die Stimme verstummt, flüstert sie noch: {schritte} Schritte nach {richtung}. Dort, {gelaende}.'),
  _t('Du siehst den Weg vor dir wie im Traum: nach {richtung}, gut {schritte} Schritte, bis dorthin, {gelaende}.')
];
const ATREASW = [
  _t('Der Schatz liegt {schritte} Schritte nach {richtung} von hier, dort, {gelaende}. Das Siegel bricht nur für alle, die die ganze Geschichte kennen.'),
  _t('Geh {schritte} Schritte nach {richtung}, dorthin, {gelaende}. Dort wartet, was ich versteckt habe – hinter einem Siegel, das nur die ganze Geschichte öffnet.'),
  _t('Ich habe alles unter ein Siegel gelegt, {schritte} Schritte nach {richtung}, dort, {gelaende}. Sammle jedes Stück dieser Geschichte, dann öffnet es sich.')
];
const ATREASV = [
  _t('Das letzte Bild brennt sich ein: eine versiegelte Truhe, {schritte} Schritte nach {richtung}, dort, {gelaende}. Das Siegel bricht erst, wenn du die ganze Geschichte kennst.'),
  _t('Die Stimme verklingt mit einem Versprechen: {schritte} Schritte nach {richtung}, dort, {gelaende}, wartet ein Schatz – versiegelt, bis du alles gefunden hast.')
];
// Zwischenspiele: passen in jede Geschichte, wenn eine Spur länger ist als ihr Thema
const AINTER = [
  _t('Heute nichts als Wind und Weg. Ich zähle meine Schritte, um nicht zu denken.'),
  _t('Ein Gewitter hat mich die halbe Nacht wachgehalten. Am Morgen war die Welt frisch gewaschen, als wäre nichts geschehen.'),
  _t('Ich habe einen alten Wegstein gefunden. Jemand hat einen Pfeil hineingeritzt und darunter ein einziges Wort: Weiter.'),
  _t('Seit gestern folgt mir ein Rabe. Er sagt nichts. Aber er scheint auf etwas zu warten.'),
  _t('Mein Proviant wird knapp. Ich habe Beeren gegessen, von denen ich hoffe, dass sie nicht giftig waren. Bis jetzt geht es mir gut. Glaube ich.'),
  _t('Ich habe von {ort} geträumt. Vom Brot, vom Lachen, von Fenstern mit Licht dahinter. Dann bin ich aufgewacht, und um mich war nur die Wildnis.'),
  _t('Heute Nacht leuchteten die Sterne so hell, dass ich ohne Fackel lesen konnte. Ich habe meine eigenen Zeilen gelesen und sie kaum wiedererkannt.'),
  _t('Ich habe Spuren gefunden, die meinen ähneln. Jemand ist vor mir diesen Weg gegangen. Vielleicht sogar ich selbst, in einem anderen Leben.'),
  _t('Monster haben das Lager umkreist, die ganze Nacht. Ich habe das Feuer brennen lassen und laut gesungen. Sie mögen meinen Gesang nicht. Niemand mag ihn.'),
  _t('Ein Händler kam vorbei und wollte mir eine Karte verkaufen. Sie zeigte genau den Ort, an dem wir standen. Er fand das sehr nützlich.'),
  _t('Ich bin müde, aber nicht mutlos. Noch nicht. Der Weg ist weit, und jeder Schritt bringt mich näher.'),
  _t('An einer Quelle habe ich mein Gesicht gesehen. Es ist älter geworden. Die Endlosen Lande nehmen sich ihren Preis.')
];
/* ---------- Geschichten: Thema → Titel, Anfang (s), Mitte in Reihenfolge (m), Ende (e) ----------
   Platzhalter sind nur Eigennamen und Zahlen: {ich} Erzähler, {du} Gefährte, {feind} Gegner, {ort} Heimat, {ziel} Ziel,
   {schatz} der Schatz, {bestie} ein Wesen, {orden} ein Bund, {gott} eine Gottheit, {n} viele, {m} wenige.
   Nie ein Artikel oder ein Fürwort, das am Geschlecht eines Namens hängt. */
const ATH = [
  { k: 'expedition', kinds: ['tagebuch', 'karte', 'kompass', 'laterne', 'brief'],
    t: [_t('Die verlorene Expedition von {ort}'), _t('Der letzte Marsch nach {ziel}')],
    s: [_t('Heute brechen wir auf: {n} Leute aus {ort}, drei Maultiere und ein Kompass, der nie ganz stillhält. Unser Ziel ist {ziel}, die Stadt, die auf keiner Karte steht. Man sagt, dort liege {schatz}.'),
      _t('Die Gilde von {ort} hat uns ausgelacht. Aus den Endlosen Landen kehre niemand zurück, sagen sie. Wir werden die Ersten sein. Wir suchen {ziel} – und das, was man dort {schatz} nennt.')],
    m: [[_t('Der dritte Tag. Unser Wasser schmeckt nach Eisen, und nachts schleicht etwas um das Lager. {du} sagt, es seien nur Füchse. {du} lügt schlecht.'), _t('Wir haben die erste Spur der Alten gefunden: einen Wegstein mit Zeichen, die keiner von uns lesen kann. Nur {du} lächelt, als würde der Stein flüstern.')],
      [_t('Wir haben das erste Maultier verloren. Es ist einfach im Boden versunken, ohne einen Laut. Seitdem gehen wir hintereinander, jeder genau in den Spuren des anderen.')],
      [_t('Heute Nacht haben wir es gesehen: groß wie ein Haus, Augen wie Laternen. Die Alten nennen es {bestie}. Es hat uns nicht angegriffen. Es hat nur zugesehen. Das war schlimmer.')],
      [_t('Streit im Lager. Die Hälfte will umkehren. Ich habe allen die Karte gezeigt, die Linien, die in dieselbe Richtung führen. {ziel} ist nah. Ich spüre es.'), _t('Zwei sind heute Nacht mit dem letzten Maultier verschwunden. Ich kann es ihnen nicht verdenken. Aber ich kehre nicht um.')],
      [_t('Wir haben Mauern gefunden, älter als jede Stadt, die ich kenne. In den Stein sind Gesichter gemeißelt, und alle blicken in dieselbe Richtung. Wir folgen ihrem Blick.')],
      [_t('Nur noch {m} von uns. Ich schreibe das für den Fall, dass niemand zurückkehrt. Wer diese Zeilen findet: Unsere Namen sollen nicht vergessen werden.')],
      [_t('{du} ist heute Nacht verschwunden. Nur die Fußspuren führen weiter – genau dorthin, wohin auch die Karte zeigt.')]],
    e: [_t('Wir haben {ziel} gefunden. Es ist keine Stadt. Es ist ein Grab, und wir sind nicht die ersten Gäste. Ich habe {schatz} an mich genommen und an einem sicheren Ort verborgen. Wer das liest: Nimm es. Und geh nach Hause, solange du noch kannst.'),
      _t('{schatz} ist echt. Ich halte es in den Händen, während ich schreibe, und es ist warm wie ein lebendes Herz. Mit dem, was uns folgt, kann ich es nicht mitnehmen. Also verstecke ich es. Für dich, wer immer du bist.')] },

  { k: 'liebe', kinds: ['brief', 'feder', 'spieluhr', 'amulett', 'muschel', 'ring'],
    t: [_t('Briefe zwischen {ich} und {du}'), _t('Die verbotene Liebe von {ort}')],
    s: [_t('Mein Herz, {du}. Wenn mein Vater wüsste, dass ich dir schreibe, würde er mich in den Turm von {ort} sperren. Aber ich muss dir schreiben. Seit dem Fest am See denke ich an nichts anderes.'),
      _t('An {du}: Unsere Familien hassen sich seit drei Generationen. Ich weiß nicht einmal mehr, warum. Ich weiß nur, dass ich dich wiedersehen will. Morgen, wenn der Mond aufgeht.')],
    m: [[_t('Ich habe dir eine Nachricht in der hohlen Eiche hinterlassen. Wenn du sie findest, weißt du, wo ich warte. Bring nichts mit außer dir selbst.'), _t('Gestern am Brunnen hast du mich angesehen, nur einen Atemzug lang. Ich habe den ganzen Abend gelächelt, und meine Mutter hat gefragt, ob ich Fieber habe.')],
      [_t('Sie wissen es. {feind} hat uns gesehen und alles erzählt. Mein Vater hat getobt. Morgen soll ich fortgeschickt werden, weit weg von {ort}.')],
      [_t('Ich habe dir ein Zeichen versprochen. Hier ist es. Trag es bei dir, und wenn wir uns verlieren, folge den Liedern der Vögel nach {ziel}. Dort finden wir uns wieder.')],
      [_t('Ich bin geflohen. Drei Nächte lang bin ich gelaufen. Meine Füße bluten, aber mein Herz ist leicht. Warte auf mich, {du}.')],
      [_t('{feind} folgt mir. Ich höre die Hunde. Ich nehme einen Umweg und verwische meine Spuren. Vertrau mir.'), _t('Ein Fährmann hat mich umsonst übergesetzt. Er sagte, er sehe es in meinem Gesicht: Ich sei auf dem Weg zu jemandem, nicht weg von jemandem.')],
      [_t('Was, wenn du nicht kommst? Was, wenn alles nur ein Traum war, den wir am See geträumt haben? Nein. Ich glaube an dich. Ich muss.')]],
    e: [_t('Wir haben es geschafft, {du} und ich. In {ziel} hat niemand nach unseren Namen gefragt. Unseren Familien hinterlassen wir nur {schatz}, das Erbstück, um das sie sich so lange gestritten haben. Es soll allen gehören, die Liebe höher achten als Gold.'),
      _t('Du bist nicht gekommen. Ich habe gewartet, bis der Winter kam. Ich lasse {schatz} nicht weit von hier zurück, das Geschenk, das ich dir geben wollte. Vielleicht findet es jemand, der weiß, wie es ist, auf einen geliebten Menschen zu warten.')] },

  { k: 'orden', kinds: ['ring', 'tafel', 'rolle', 'muenze', 'tagebuch'],
    t: [_t('Der Fall des Ordens von {orden}'), _t('Die letzten Ritter von {orden}')],
    s: [_t('Ich, {ich}, vom Orden von {orden}, beginne diese Chronik an dem Tag, an dem unser Banner zum letzten Mal über der Feste weht. {feind} steht vor den Toren. Wir werden halten. Wir müssen.'),
      _t('Dies ist die Chronik von {orden}, aufgeschrieben von {ich}. Dreihundert Jahre lang haben wir die Straße nach {ort} beschützt. Heute zählen wir die Tage, die uns noch bleiben.')],
    m: [[_t('Der Großmeister hat uns versammelt. {schatz}, das Herz unseres Ordens, darf nicht in die Hände von {feind} fallen. Ich gehöre zu den {m}, die es fortbringen sollen.')],
      [_t('Verrat. Jemand hat {feind} das geheime Tor gezeigt. Wir haben die halbe Wache verloren, bevor wir begriffen, was geschah.')],
      [_t('Wir fliehen durch die Wildnis. Bei Tag verstecken wir uns, bei Nacht laufen wir. {du} trägt {schatz} in einem Bündel aus Leinen, und niemand spricht darüber.')],
      [_t('Am Feuer haben wir den alten Eid erneuert: Wir kämpfen nicht, um zu herrschen. Wir kämpfen, damit niemand herrschen muss. Ich hatte vergessen, wie schön diese Worte sind.')],
      [_t('{du} ist gefallen, an einer Brücke, die wir halten mussten. Ich konnte den Leichnam nicht bergen. Ich habe nur das Schwert mitgenommen.'), _t('Wir haben ein Dorf vor Plünderern gerettet. Die Leute haben uns Brot gegeben und Blumen auf unsere zerbeulten Schilde gelegt. Für einen Abend waren wir wieder Ritter.')],
      [_t('{feind} ist uns dicht auf den Fersen. Von uns ist niemand mehr übrig außer mir. Ich werde {schatz} verstecken, wo es nur ein würdiges Herz findet.')]],
    e: [_t('Hier endet die Chronik von {orden}. {schatz} ruht an einem Ort, den {feind} niemals finden wird. Wer diese Worte liest und reinen Herzens ist: Nimm es und trag es, wie wir es trugen. Mit Ehre.'),
      _t('Ich habe {schatz} versteckt und den Ort mit dem Zeichen des Ordens versiegelt. Mein Schild hängt darüber. Wenn du es findest, bist du der Orden von {orden}. Wir waren nie mehr als die, die nicht weggelaufen sind.')] },

  { k: 'kult', kinds: ['schaedel', 'rune', 'tafel', 'rolle', 'amulett', 'floete'],
    t: [_t('Die Jünger von {bestie}'), _t('Das Erwachen von {bestie}')],
    s: [_t('Sie nennen uns Narren. Aber wir haben das Feuer gesehen. Der Drache {bestie} schläft unter dem Land, und wenn wir die {m} Siegel brechen, wird er erwachen und uns zu Herren der Welt machen.'),
      _t('Mein erster Tag im Kult von {bestie}. Sie haben mir eine rote Maske gegeben und einen neuen Namen. Den alten, {ich}, schreibe ich nur noch hier auf, damit ich ihn nicht vergesse.')],
    m: [[_t('Das erste Siegel ist gebrochen. Die Erde hat gebebt, und der Hohepriester hat gelacht wie ein Kind. Ich habe auch gelacht. Warum habe ich auch gelacht?')],
      [_t('Wir opfern jetzt jede Nacht. Erst Gold, dann Blut. Der Hohepriester sagt, der Drache habe Hunger. Ich glaube, der Hohepriester hat Hunger.')],
      [_t('Ich hatte einen Traum. Ich stand vor dem Drachen, und er sprach mit meiner eigenen Stimme: Ich bin nicht dein Gott. Ich bin dein Ende.')],
      [_t('Ich habe {schatz} gestohlen, den Schlüssel zum letzten Siegel. Ohne ihn bleibt der Drache gefangen. Sie werden mich jagen.')],
      [_t('Die Maskierten sind überall. In jedem Dorf fragen sie nach mir. {du} hat mich versteckt, für eine Nacht. Das werde ich nie vergessen.'), _t('Ich habe die rote Maske im Fluss versenkt. Sie ist nicht untergegangen. Sie ist flussaufwärts geschwommen, gegen den Strom.')],
      [_t('Ich höre den Drachen, wenn ich schlafe. Er ruft nach {schatz}. Er ruft nach mir.')]],
    e: [_t('Ich habe {schatz} dort verborgen, wo selbst der Drache nicht hinsieht. Sollen sie suchen. Wer das findet: Zerstören kann man es nicht. Aber trag es weit fort von hier. Und hör nicht hin, wenn es flüstert.'),
      _t('Der Kult ist zerfallen, der Hohepriester verschwunden. {bestie} schläft weiter. {schatz} liegt versiegelt an einem Ort, den ich niemandem verraten habe – außer dir, wer immer diese Zeilen liest.')] },

  { k: 'stern', kinds: ['karte', 'rolle', 'kompass', 'feder', 'schaedel'],
    t: [_t('Die Sternenkarte von {ich}'), _t('Der Stern über {ziel}')],
    s: [_t('Seit {n} Jahren zeichne ich den Himmel. Und seit {n} Jahren gibt es dort einen Stern, der wandert, als suche er etwas. Heute Nacht ist er herabgefallen. Irgendwo in den Endlosen Landen.'),
      _t('Die Akademie von {ort} hält mich für verrückt. Ich habe berechnet, wo der Wanderstern landen wird, und ich werde dort sein, um ihn zu begrüßen.')],
    m: [[_t('Ich folge der Spur aus verbranntem Gras. Wo der Stern über das Land flog, blühen nachts weiße Blumen. Ich habe eine gepflückt. Sie leuchtet noch immer.')],
      [_t('Ein Bauer sagt, er habe ein Licht gesehen, das wie eine Glocke klang. Ich habe ihm meine letzte Münze gegeben, damit er mir die Richtung zeigt.')],
      [_t('Rivalen. {feind} von der Akademie ist ebenfalls hinter dem Stern her. Wir haben uns an einer Quelle getroffen und so getan, als wären wir Freunde.')],
      [_t('Ich habe die Sterne neu berechnet. Wenn ich recht habe, ist der Stern nicht gefallen. Er ist gelandet. Und er hat ein Ziel.')],
      [_t('Heute Nacht hat mir jemand im Traum den Weg gezeigt. Eine Stimme aus Licht. Sie nannte sich {schatz}.'), _t('Mein Fernrohr ist zerbrochen. Ich sehe die Sterne jetzt mit bloßen Augen – und zum ersten Mal sehe ich, dass einer zurückblickt.')]],
    e: [_t('Ich habe ihn gefunden, den Stern. Er ist nicht größer als eine Faust, und er singt. {schatz} nennt er sich. Behalten darf ich ihn nicht – er gehört dem Himmel. Ich verwahre ihn, bis jemand kommt, der ihn tragen kann.'),
      _t('Der Stern hat mich erwählt und dann wieder losgelassen. Er ist jetzt {schatz}, und er wartet. Nicht auf mich. Vielleicht auf dich.')] },

  { k: 'seuche', kinds: ['tagebuch', 'rolle', 'brief', 'feder', 'laterne'],
    t: [_t('Das Heilmittel von {ort}'), _t('Das graue Fieber von {ort}')],
    s: [_t('In {ort} sterben sie wie die Fliegen. Das graue Fieber nimmt Alte und Kinder. Ich bin {ich}, ich kenne mich mit Kräutern aus, und ich habe von einer Blüte gehört, die in {ziel} wächst. Die Alten nennen sie {schatz}.'),
      _t('Tag eins meiner Suche. Ich habe meiner Schwester versprochen, mit einem Heilmittel zurückzukehren. Ihr Husten klang heute schlimmer als gestern. Ich muss mich beeilen.')],
    m: [[_t('Ich habe die ersten Kräuter gesammelt: Mondwurz, Bitterklee und einen Pilz, der nach Honig riecht. Nichts davon reicht.')],
      [_t('Heute habe ich {du} begraben. Das Fieber war schneller als ich. Ich darf nicht aufgeben.'), _t('Ein Bote aus {ort} hat mich eingeholt. Er brachte keine guten Nachrichten. Ich habe ihn umarmt und bin weitergelaufen.')],
      [_t('{feind} verkauft in {ort} falsche Heiltränke für teures Gold. Die Leute trinken sie und sterben trotzdem.')],
      [_t('Ein alter Einsiedler hat mir den Weg beschrieben. Er hat gelacht, als ich nach der Blüte fragte. Niemand, sagt er, pflücke sie zweimal.')],
      [_t('Das Fieber hat mich gefunden. Meine Hände zittern beim Schreiben. Aber ich bin nah, so nah.')]],
    e: [_t('Ich habe {schatz} gefunden. Ein einziges Blatt hat mich geheilt. Ich bringe die Samen nach {ort} – den Rest verstecke ich, damit niemand ihn ausreißt. Wer ihn findet: Teile seine Kraft.'),
      _t('Die Blüte wuchs im Schatten eines toten Baumes, genau wie die Alten sagten. Ich habe genug für {ort} genommen. Was übrig ist, liegt versiegelt an einem sicheren Ort: {schatz}, für die nächste Not.')] },

  { k: 'dieb', kinds: ['brief', 'muenze', 'karte', 'figur', 'ring'],
    t: [_t('Der große Coup von {ich}'), _t('Die Schatzkammer von {feind}')],
    s: [_t('Man nennt mich {ich}, und ich habe noch nie etwas gestohlen, das nicht gestohlen werden wollte. Diesmal ist es {schatz}, aus der Schatzkammer von {feind}. Der Plan ist einfach. Die Pläne sind immer einfach.'),
      _t('Ein Auftrag, wie man ihn nur einmal im Leben bekommt: {schatz}, bewacht von {n} Söldnern, drei Schlössern und einem sehr schlecht gelaunten Hund. Ich habe sofort zugesagt.')],
    m: [[_t('Ich habe die Wachen beobachtet. Sie wechseln alle {m} Stunden, und einer von ihnen schläft immer. Ich mag ihn jetzt schon.')],
      [_t('Der Coup ist gelungen. Fast. {du} hat beim Hinausrennen eine Vase umgestoßen, und jetzt sucht uns die halbe Stadtwache.')],
      [_t('Wir haben uns getrennt. {du} lockt die Verfolger in die falsche Richtung, ich nehme den langen Weg. Wenn alles gut geht, treffen wir uns am verabredeten Ort.')],
      [_t('{feind} hat ein Kopfgeld ausgesetzt. Mein Gesicht hängt an jedem Baum. Ich muss sagen, sie haben meine Nase nicht gut getroffen.')],
      [_t('{du} ist nicht gekommen. Gefangen – oder klüger als ich. Ich warte nicht länger.')],
      [_t('Etwas stimmt nicht mit {schatz}. Nachts glüht es, und ich träume Erinnerungen, die nicht meine sind.')]],
    e: [_t('Ich verstecke {schatz}. Nicht für {feind}, nicht für mich. Es gehört niemandem, das habe ich jetzt verstanden. Wer es findet, hat es sich verdient. Und wer es stiehlt – nun ja. Respekt.'),
      _t('Ich gebe auf. Nicht das Stehlen – nur {schatz}. Es liegt versiegelt an einem Ort, den {feind} nie finden wird. Ich gehe mit leeren Taschen und leichtem Herzen. Ein ganz neues Gefühl.')] },

  { k: 'hexe', mg: ['feind'], kinds: ['feder', 'amulett', 'schaedel', 'tagebuch', 'laterne', 'floete'],
    t: [_t('Die Hexe vom Moor bei {ort}'), _t('Das Vermächtnis der Krähenmutter')],
    s: [_t('Die Leute in {ort} sagen, ich sei eine Hexe. Sie haben recht – aber nicht so, wie sie glauben. Ich heile, ich lausche, und ich hüte {schatz}, das mir das Moor anvertraut hat.'),
      _t('Meine Großmutter hütete das Moor, und ihre Großmutter davor. Jetzt bin ich an der Reihe. Die Krähen haben es mir heute Morgen gesagt.')],
    m: [[_t('Heute kam ein Junge zu mir, krank vor Angst. Ich habe ihm Tee gegeben und eine Geschichte erzählt. Manchmal ist das alles, was Magie ist.')],
      [_t('Der Vogt {feind} will das Moor trockenlegen. Er weiß nicht, was darunter schläft. Ich habe ihn gewarnt. Er hat gelacht.')],
      [_t('Sie haben mein Haus angezündet. Ich bin mit den Krähen geflohen. {schatz} trage ich bei mir, ganz nah am Herzen.')],
      [_t('Das Moor ist wütend. Nachts steigen die Irrlichter, und die Toten tanzen. Ich muss es beruhigen, bevor es {ort} verschlingt.')],
      [_t('{du}, das Kind aus dem Dorf, ist mir gefolgt. Es will lernen. Ich habe ja gesagt. Jemand muss sich erinnern, wenn ich gehe.'), _t('Ich habe einen Kessel voller Regen gesammelt und darin den Mond gesehen. Er war voll, obwohl Neumond ist. Die Zeichen werden lauter.')]],
    e: [_t('Ich gebe {schatz} dem Land zurück. Ich habe es dort versenkt, wo das Wasser am tiefsten ist und die Erde am ältesten. Wer es findet, hört das Moor atmen. Hab keine Angst. Hör einfach zu.'),
      _t('Das Moor schläft wieder, und {feind} ist mit den Füßen voran darin versunken – nur bis zu den Knien, aber das hat gereicht. {schatz} habe ich versiegelt. Gute Hände werden es finden.')] },

  { k: 'zwerge', kinds: ['rune', 'tafel', 'muenze', 'figur', 'laterne'],
    t: [_t('Die Schmiede von {ort}'), _t('Das letzte Lied der Binge von {ort}')],
    s: [_t('Wir Zwerge von {ort} haben {n} Generationen lang geschmiedet, tief unter dem Stein. Heute ist der letzte Hammer verstummt. Ich bin {ich}, und ich schreibe auf, was geschah.'),
      _t('Ein Zwerg schreibt keine Bücher. Ein Zwerg schmiedet. Aber es ist niemand mehr da, für den ich schmieden könnte. Also schreibe ich.')],
    m: [[_t('Es begann mit einem Riss in der tiefsten Halle. Kalt, schwarz, ohne Boden. Die Ältesten sagten, wir sollen ihn zumauern. Wir haben nicht auf sie gehört.')],
      [_t('Aus dem Riss kam etwas. Kein Tier, kein Geist – eine Leere, die Licht frisst. Unsere Fackeln brannten blau und dann gar nicht mehr.')],
      [_t('{du}, die beste Hand an unserer Esse, hat {schatz} vollendet, das Werk, das selbst die Leere zerschneidet. Wir haben drei Tage gefeiert. Dann kam der vierte Tag.')],
      [_t('Wir haben die Tore geschlossen und sind nach oben geflohen. Ich habe noch nie den Himmel gesehen. Er ist zu groß.')],
      [_t('Die Menschen hier oben halten uns für Bettler. Ich habe ihnen gezeigt, wie man Eisen faltet. Jetzt halten sie uns für Zauberer.'), _t('Ein Kind fragte mich, warum Zwerge nie lächeln. Ich habe gelächelt. Es ist schreiend davongelaufen. Ich übe noch.')],
      [_t('Ich träume von der Binge, von Hallen voller Licht und Gesang. Ich kehre zurück, auch wenn es mein Ende ist.')]],
    e: [_t('Ich habe {schatz} nicht zurück in die Tiefe getragen. Die Leere soll es nie bekommen. Ich habe es ganz in der Nähe verborgen, unter Stein, wie es sich gehört. Wer es findet: Schmiede weiter. Hör nie auf zu schmieden.'),
      _t('Das Tor der Binge ist versiegelt, und {schatz} liegt sicher, wo nur geduldige Hände es finden. Sing ein Lied, wenn du es aufhebst. Es kennt nur Zwergenlieder, aber es freut sich über jedes.')] },

  { k: 'wolf', kinds: ['figur', 'floete', 'tagebuch', 'feder', 'amulett'],
    t: [_t('{ich} und der Wolf {bestie}'), _t('Das Lied von {bestie}')],
    s: [_t('Ich war {m} Jahre alt, als ich mich in den Wäldern bei {ort} verlief. Ein Wolf fand mich, größer als ein Pferd, mit Augen wie Bernstein. {bestie} hat mich nicht gefressen. Der Wolf hat mich nach Hause gebracht.'),
      _t('Niemand in {ort} glaubt mir, dass ich mit einem Wolf befreundet bin. Gut so. Wer es glaubt, würde ihn jagen.')],
    m: [[_t('Seitdem gehe ich jeden Abend zum Waldrand. Manchmal wartet {bestie} dort. Manchmal finde ich nur Spuren im Schnee.')],
      [_t('Die Jäger von {ort} haben den großen Wolf gesehen. {feind} hat geschworen, sein Fell an die Wand zu nageln.')],
      [_t('Ich habe {bestie} gewarnt. Der Wolf hat mich lange angesehen und ist dann gegangen. Ich glaube, er hat mich verstanden.')],
      [_t('Die Jagd hat begonnen. Ich folge den Jägern heimlich. Ich weiß nicht, was ich tun werde, wenn sie ihn finden.'), _t('Ich habe die Fallen der Jäger zugeschüttet, eine nach der anderen. Meine Hände sind wund. Es waren sehr viele Fallen.')],
      [_t('{bestie} ist verletzt. Ich habe die Wunde mit Moos verbunden. Der Wolf hat es zugelassen. Er hat mir vertraut.')]],
    e: [_t('Der Wolf ist fort, über die Berge, wo ihn keiner findet. Zum Abschied ließ er mir etwas zurück: {schatz}, das er in seiner Höhle gehütet hatte wie einen Welpen. Ich habe es dort gelassen. Es gehört allen, die den Wald lieben.'),
      _t('Ich bin alt geworden, und {bestie} ist nie zurückgekommen. Aber jedes Jahr am selben Tag liegt etwas vor meiner Tür. Das Schönste davon, {schatz}, habe ich für dich versteckt.')] },

  { k: 'golem', mg: ['feind'], kinds: ['figur', 'kompass', 'tagebuch', 'rune', 'spieluhr'],
    t: [_t('Die Werkstatt von {ich}'), _t('Der eiserne Freund {bestie}')],
    s: [_t('Ich habe einen Freund gebaut. Aus Eisen, Ton und einem Herzen aus {schatz}. Er heißt {bestie}, ist so groß wie ein Turm und hat heute zum ersten Mal die Augen geöffnet.'),
      _t('Notizbuch, Seite eins: Ziel – ein Golem, der nicht kämpft, sondern hilft. Alle in {ort} halten das für Unsinn. Das ist meistens ein gutes Zeichen.')],
    m: [[_t('{bestie} lernt schnell. Der Golem kann tragen, graben und sogar summen. Gestern hat er einen Schmetterling vor dem Regen beschützt.')],
      [_t('Der Fürst {feind} will {bestie} kaufen. Für den Krieg. Ich habe abgelehnt. Der Fürst hat gelächelt, und das Lächeln gefiel mir nicht.')],
      [_t('Sie kamen nachts und wollten {bestie} in Ketten legen. Der Golem hat niemanden verletzt – er ist einfach gegangen, mitten durch die Wand.')],
      [_t('Ich suche {bestie}. Die Spuren sind tief und leicht zu finden, aber sie führen immer weiter weg. Als suche der Golem etwas.')],
      [_t('Ein Hirte hat ihn gesehen, oben auf dem Hügel, wie er den Sonnenuntergang betrachtete. Stundenlang.'), _t('Ich habe eine verbeulte Spieluhr gefunden, die {bestie} am Wegrand abgestellt hat. Ich hatte sie ihm zum ersten Geburtstag geschenkt.')]],
    e: [_t('Ich habe {bestie} gefunden. Der Golem hat sich hingesetzt und ist eingeschlafen, für immer. Sein Herz, {schatz}, hat er mir in die Hand gelegt. Ich habe es versteckt, bis jemand kommt, der einen Freund braucht.'),
      _t('{bestie} steht jetzt still auf einem Hügel und bewacht das Tal. Er wollte nie etwas anderes. Sein Herz, {schatz}, hat er mir zurückgegeben. Es liegt versiegelt, und es schlägt noch.')] },

  { k: 'leere', kinds: ['scherbe', 'schaedel', 'rune', 'tagebuch', 'laterne'],
    t: [_t('Der Pakt von {ich}'), _t('Was die Leere versprach')],
    s: [_t('Die Leere hat mit mir gesprochen. Nicht mit Worten, sondern mit Hunger. Sie versprach mir alles, was ich verloren habe. Ich habe ja gesagt. Ich weiß, ich hätte es nicht tun sollen.'),
      _t('Wenn du das liest, bin ich vielleicht nicht mehr ich. Mein Name war {ich}. Ich habe einen Pakt geschlossen, und jetzt bezahle ich.')],
    m: [[_t('Der erste Preis war klein: meine Erinnerung an den Geschmack von Äpfeln. Dafür bekam ich {du} zurück, für einen einzigen Abend.')],
      [_t('Der zweite Preis: mein Schatten. Er ging einfach weg, ohne sich umzudrehen. Seitdem friere ich auch in der Sonne.')],
      [_t('In {ort} habe ich einen Gelehrten gefunden, der von solchen Pakten weiß. Es gebe nur einen Weg zurück, sagt er: {schatz}, das Licht, das die Leere nicht verschlucken kann.')],
      [_t('Die Leere weiß, was ich vorhabe. Die Nächte werden länger. Manchmal sehe ich Dinge am Rand meines Blicks, die nicht da sind.')],
      [_t('Ich habe meinen Namen vergessen. Ich musste ihn auf meine Hand schreiben: {ich}. Ich darf ihn nicht noch einmal verlieren.')]],
    e: [_t('Mit {schatz} in den Händen habe ich der Leere ihren Pakt zurückgegeben. Sie hat geschrien wie ein Sturm. Ich habe überlebt, fast ganz. Das Licht habe ich versteckt. Es wird noch gebraucht werden. Die Leere vergisst nie.'),
      _t('Ich bin frei. {schatz} hat die Leere zurückgedrängt, und mein Schatten ist wiedergekommen, ein wenig verlegen. Das Licht lasse ich versiegelt zurück, nicht weit von hier. Hüte es gut. Die Leere frisst sich durch die Welt, und wir brauchen jedes Licht.')] },

  { k: 'belagerung', kinds: ['tagebuch', 'brief', 'muenze', 'ring', 'tafel'],
    t: [_t('Die Belagerung von {ort}'), _t('Die Mauern von {ort}')],
    s: [_t('Tag eins der Belagerung. {feind} hat {ort} umstellt, mit mehr Zelten, als ich zählen kann. Wir haben Brot für {n} Tage. Die Kinder spielen noch auf den Mauern.'),
      _t('Die Glocken von {ort} läuten seit dem Morgengrauen. {feind} ist gekommen, wie die Späher es vorhergesagt haben. Ich schreibe auf, was geschieht, damit es jemand weiß.')],
    m: [[_t('Sie haben den Brunnen vergiftet. Wir trinken jetzt Regenwasser, wenn es regnet. Es regnet nicht oft.')],
      [_t('Heute haben wir einen Ausfall gewagt. {du} hat das große Katapult angezündet. Ein guter Tag. Es gibt nicht viele davon.')],
      [_t('Der Rat hat beschlossen, {schatz} aus der Stadt zu schmuggeln, bevor {feind} es bekommt. Ich wurde ausgewählt. Ich weiß nicht, ob das eine Ehre ist.')],
      [_t('Ich bin durch den alten Abwasserkanal geflohen. Ich rieche nach allem, was eine Stadt wegwirft. Aber ich bin frei.')],
      [_t('Von einem Hügel aus habe ich {ort} brennen sehen. Ich habe nicht geweint. Das kommt später, sagt man.'), _t('Flüchtlinge aus {ort} haben mich erkannt. Sie fragten nicht, was ich trage. Sie gaben mir nur ihr letztes Brot und sagten: Lauf.')]],
    e: [_t('{ort} ist gefallen, aber nicht vergessen. {schatz} habe ich in diese Gegend gebracht und vergraben, wie der Rat es befahl. Wenn die Stadt eines Tages neu erbaut wird, soll es zurückkehren. Bis dahin: Hüte es gut, Fremder.'),
      _t('{feind} hat die Mauern genommen, aber nicht das Herz der Stadt. {schatz} liegt versiegelt, nicht weit von hier. Wer es findet, soll wissen: Die Menschen von {ort} haben nicht aufgegeben. Nie.')] },

  { k: 'lied', kinds: ['spieluhr', 'floete', 'feder', 'muschel', 'brief'],
    t: [_t('Das Lied von {ziel}'), _t('Die Ballade von {ich}')],
    s: [_t('Es gibt ein Lied, das man nur einmal singen kann. Man sagt, wer es ganz singt, öffnet das Tor von {ziel}. Die erste Strophe habe ich gefunden, eingeritzt in einen Baum.'),
      _t('Ich bin {ich}, und ich singe in Schenken für Brot und Bier. Aber heute hat mir ein alter Mann eine Melodie vorgesummt, die mich nicht mehr loslässt.')],
    m: [[_t('Die zweite Strophe kannte eine alte Frau in einer Schenke. Sie sang sie mir vor und weinte dabei. Dann hat sie mir die Tür gewiesen.')],
      [_t('Ich habe mit {feind} um eine Strophe gewürfelt und verloren. Dann habe ich gegen {feind} gesungen und gewonnen. Musik ist ehrlicher als Würfel.')],
      [_t('Die Melodie geht mir nicht mehr aus dem Kopf. Vögel singen sie mir nach. Gestern hat ein Bach sie gerauscht.')],
      [_t('Die vierte Strophe ist traurig. Sie erzählt von einer Stadt, die sich vor der Welt versteckt hat, weil die Welt zu laut wurde.')],
      [_t('{du} sagt, ich solle aufhören. Das Lied verändere mich. Vielleicht. Aber ich will das Ende hören.')]],
    e: [_t('Ich habe das Lied gesungen, bis zum Ende. Das Tor hat sich geöffnet – nur einen Spalt, nur für einen Atemzug. Darin fand ich {schatz}. Ich habe es nicht weit von hier zurückgelassen, zusammen mit der letzten Strophe. Sing sie leise.'),
      _t('Das Lied ist zu Ende, und {ziel} hat mich eingelassen. Ich bleibe hier. Aber {schatz} schicke ich hinaus in die Welt, versiegelt mit dem letzten Ton. Wer es findet, soll weitersingen.')] },

  { k: 'elixier', kinds: ['rolle', 'tagebuch', 'feder', 'schaedel', 'brief'],
    t: [_t('Das Elixier von {ich}'), _t('Die Formel von {ort}')],
    s: [_t('Ich habe es beinahe geschafft: das Elixier, das den Tod um hundert Jahre verschiebt. Es fehlt nur noch eine Zutat. Die Alten nannten sie {schatz}.'),
      _t('Laborbuch von {ich}, Alchemie und angewandte Explosionen, {ort}. Neues Ziel: das Ewige Elixier. Ich bin zuversichtlich. Die Augenbrauen wachsen nach.')],
    m: [[_t('Versuch Nummer {n}. Die Ratte lebt noch. Die Ratte singt jetzt. Ich weiß nicht, ob das ein Erfolg ist.')],
      [_t('Mein Lehrling {du} hat mich verlassen. Ich hätte nicht an mir selbst experimentieren sollen, steht in dem Brief. Ich habe ihn dreimal gelesen. Mit meinem neuen dritten Auge.')],
      [_t('{feind} hat mein Labor durchsucht. Die Gilde will meine Formel. Sie bekommt sie nicht. Ich habe sie in einem Kinderlied versteckt.')],
      [_t('Die Spur führt in die Wildnis. Ich habe Proviant für eine Woche, Zutaten für drei Tränke und keine Ahnung, wie man ein Zelt aufbaut.')],
      [_t('Ich werde älter. Schneller als sonst. Der Preis für meine Versuche, nehme ich an.'), _t('Heute bin ich für eine Stunde unsichtbar gewesen. Nicht absichtlich. Ein Eichhörnchen ist auf mich gefallen und war sehr überrascht.')]],
    e: [_t('Ich habe {schatz} gefunden und das Elixier gebraut. Getrunken habe ich es nicht. Hundert Jahre allein sind kein Leben. Das Fläschchen verstecke ich ganz in der Nähe. Vielleicht weißt du es besser als ich.'),
      _t('Das Elixier ist fertig, und es schmeckt nach Erdbeeren. Damit hatte niemand gerechnet. Ich habe es mit {schatz} versiegelt. Wer es findet, soll gut überlegen, was ein langes Leben wert ist.')] },

  { k: 'pilger', mg: ['du'], kinds: ['laterne', 'muenze', 'figur', 'tagebuch', 'amulett'],
    t: [_t('Der Pilgerweg nach {ziel}'), _t('Die Pilgerschaft von {ich}')],
    s: [_t('Ich habe {gott} geschworen, zu Fuß nach {ziel} zu gehen, zum Schrein am Ende der Welt. Ich habe nichts dabei als einen Stab, einen Laib Brot und meine Schuld.'),
      _t('Am Weltentor hängt eine Tafel: Wer bis {ziel} geht, dem verzeiht {gott}. Ich habe sie dreimal gelesen. Dann bin ich losgegangen.')],
    m: [[_t('Am ersten Wegschrein habe ich eine Kerze entzündet. Die Flamme brannte grün. Der Mönch dort sagte, das sei ein gutes Zeichen. Er sah nicht so aus, als glaube er es selbst.')],
      [_t('Ich habe einen Räuber getroffen. Er wollte mein Brot. Ich habe es ihm gegeben, und wir haben es geteilt. Er heißt {du}. Er geht jetzt mit mir.')],
      [_t('Das Land ändert sich. Selbst die Vögel klingen fremd. {du} sagt, wir seien schon weiter als jeder Pilger vor uns.')],
      [_t('Ich habe von meiner Schuld erzählt. {du} hat nur genickt. Manche Dinge werden leichter, wenn man sie ausspricht. Nicht viel leichter. Aber ein wenig.')],
      [_t('Der Weg ist kaum noch zu sehen. Die alten Steine, die ihn markieren, sind umgestürzt oder versunken. Wir folgen dem Klang einer fernen Glocke.')]],
    e: [_t('Ich habe den Schrein von {ziel} erreicht. Er ist leer bis auf {schatz}, das Geschenk von {gott} an alle, die den ganzen Weg gehen. Ich habe es nicht genommen. Ich brauche es nicht mehr. Aber du vielleicht.'),
      _t('Am Ende des Weges war kein Schrein, nur ein Baum und eine Bank. Ich habe mich gesetzt und zum ersten Mal seit Jahren geschlafen, ohne zu träumen. {schatz} lag unter der Bank. Ich lasse es dir.')] },

  { k: 'soeldner', kinds: ['muenze', 'ring', 'brief', 'tagebuch', 'figur'],
    t: [_t('Das Bekenntnis von {ich}'), _t('Der Sold von {feind}')],
    s: [_t('Ich habe für {feind} gekämpft. Für Gold, nicht für Ehre. In {ort} habe ich etwas getan, das ich nicht aufschreiben kann. Ich schreibe trotzdem. Vielleicht hilft es.'),
      _t('Zwanzig Jahre Söldnerdienst, {n} Narben, null Freunde. Heute habe ich mein Schwert in den Fluss geworfen. Dann bin ich hinterhergesprungen und habe es wieder rausgeholt. Man weiß ja nie.')],
    m: [[_t('Ich habe die Kompanie verlassen. Nachts, ohne Abschied. Mitgenommen habe ich nur meinen Anteil – und {schatz}, das in {ort} gestohlen wurde.')],
      [_t('{feind} hat Kopfgeldjäger geschickt. Zwei habe ich abgehängt. Den dritten habe ich zum Essen eingeladen. Er hat angenommen und ist danach umgekehrt.')],
      [_t('Ich will {schatz} zurückbringen. Den Menschen von {ort} gehört es. Sie werden mich hassen. Das ist in Ordnung.')],
      [_t('Mein Schwert rostet. Ich putze es nicht mehr. Ich will nicht mehr kämpfen.')],
      [_t('Heute habe ich ein Kind vor Wölfen gerettet. Zum ersten Mal seit Jahren hat mein Schwert etwas Gutes getan.')]],
    e: [_t('Bis {ort} komme ich nicht mehr. Meine Beine tragen mich nicht so weit. Ich lege {schatz} an einem stillen Ort ab, nicht weit von hier. Wer es findet: Bring es dorthin, wo es hingehört. Oder behalte es. Aber sei besser als ich.'),
      _t('Ich habe {schatz} versiegelt und meinen Namen daneben in den Stein geritzt: {ich}. Nicht als Söldner. Als jemand, der es am Ende richtig machen wollte.')] },

  { k: 'baum', kinds: ['figur', 'feder', 'amulett', 'tagebuch', 'muschel'],
    t: [_t('Der Samen von {ziel}'), _t('Der Garten von {ich}')],
    s: [_t('Ich ziehe Pflanzen, seit ich denken kann. Ein Reisender gab mir einen Samen, schwarz wie die Nacht und schwer wie Stein. Daraus wachse ein Baum, der die Welt heilt, sagte er: {schatz}.'),
      _t('In {ort} wächst nichts mehr. Die Felder sind grau, die Bäume tot. Ich habe den letzten Samen aus dem Tempel genommen und bin losgezogen, um einen Ort zu finden, an dem er keimt.')],
    m: [[_t('Der Samen will nicht keimen. Nicht in Erde, nicht in Wasser, nicht in Asche. Vielleicht braucht er einen bestimmten Ort.')],
      [_t('Heute Nacht habe ich den Samen flüstern hören. Er nannte einen Namen: {ziel}. Ich packe meine Sachen.')],
      [_t('Unterwegs wachsen Blumen, wo ich geschlafen habe. Ich trage den Samen in der Brusttasche. Er ist warm.')],
      [_t('{feind} will den Samen. Land und Gold bietet {feind} mir dafür. Ich habe gefragt, was gepflanzt werden soll. Ich bekam keine Antwort.')],
      [_t('Ich bin sehr müde. Der Samen nimmt sich jeden Tag ein wenig von mir. Ich glaube, das ist der Preis.')]],
    e: [_t('Ich habe den Samen gepflanzt, nicht weit von hier, wo die Erde mich gerufen hat. Der Baum ist noch klein, aber zwischen seinen Wurzeln liegt {schatz}, was er mir zum Dank gab. Wer es findet: Gieß den Baum. Er wird sich erinnern.'),
      _t('Der Baum wächst. Schneller, als es möglich sein sollte. Ich habe {schatz} unter seinen Wurzeln versiegelt, damit es ihn schützt. Wenn du es nimmst, pflanz etwas Neues dafür.')] },

  { k: 'spiegel', mg: ['feind'], kinds: ['scherbe', 'brief', 'tagebuch', 'schaedel', 'spieluhr'],
    t: [_t('Der Spiegel von {ort}'), _t('Das Gesicht im Glas')],
    s: [_t('Im Spiegel meiner Großmutter lebt jemand. Nicht mein Spiegelbild – jemand anderes. Heute hat die Gestalt zum ersten Mal gesprochen und einen Namen genannt: {du}.'),
      _t('Ich habe einen alten Spiegel auf dem Markt von {ort} gekauft. Billig. Zu billig. Heute Nacht hat er geklopft. Von innen.')],
    m: [[_t('{du} wurde vor {n} Jahren in das Glas gezogen, von einem Zauberer namens {feind}. Seitdem wartet {du} auf jemanden, der zuhört.')],
      [_t('Ich habe den Spiegel zerbrochen. Aus Versehen. {du} lebt jetzt in {m} Scherben. Ich trage sie alle bei mir und spreche mit jeder einzelnen.')],
      [_t('Eine Scherbe zeigt einen Ort, den ich nicht kenne: Felsen, Wasser, ein Turm. {du} sagt, dort liege der Schlüssel: {schatz}.')],
      [_t('Die Scherben werden kälter. {du} spricht leiser. Ich muss mich beeilen.')],
      [_t('Ich habe {feind} gefunden – oder was von dem Zauberer übrig ist: ein Schatten in einem leeren Turm, der vor dem eigenen Spiegelbild flieht.')]],
    e: [_t('Mit {schatz} habe ich die Scherben zusammengefügt. {du} ist frei. Wir haben uns angesehen, zum ersten Mal ohne Glas dazwischen. Den Schlüssel verstecken wir in der Nähe. Kein Spiegel soll je wieder ein Gefängnis sein.'),
      _t('{du} ist frei und hat als Erstes gefragt, was eine Erdbeere ist. Wir haben drei Körbe gegessen. {schatz} habe ich versiegelt, damit nie wieder jemand in einem Spiegel verschwindet.')] },

  { k: 'see', kinds: ['muschel', 'laterne', 'tagebuch', 'figur', 'kompass'],
    t: [_t('Der Fährmann von {ort}'), _t('Was im See von {ort} schläft')],
    s: [_t('Seit {n} Jahren rudere ich Menschen über den See von {ort}. Nie ist jemand ertrunken. Das liegt nicht an mir. Das liegt an dem, was unter dem Boot schwimmt und mich duldet: {bestie}.'),
      _t('Mein Großvater sagte immer: Der See gibt, der See nimmt, und wer ihn beleidigt, schwimmt nach Hause. Heute habe ich verstanden, was er meinte.')],
    m: [[_t('Heute hat {bestie} mich angesehen. Ein Auge, groß wie ein Mühlrad, direkt neben dem Boot. Ich habe Brot ins Wasser geworfen. Das Auge hat geblinzelt.')],
      [_t('{feind} will den See leer fischen lassen, mit Netzen aus Eisen. Für den Garten, heißt es, wolle {feind} das Ungeheuer haben.')],
      [_t('Die Netze sind gerissen, eins nach dem anderen. Die Fischer erzählen von einem Rücken, so lang wie das Dorf.')],
      [_t('Ich habe {bestie} gebeten zu fliehen. Ich weiß nicht, ob das Wesen mich versteht. Aber in dieser Nacht sang der See.')],
      [_t('Der See wird stiller, das Wasser sinkt. {bestie} ist fort, flussabwärts, dorthin, wo niemand rudert.')]],
    e: [_t('Bevor es ging, legte {bestie} etwas ans Ufer, direkt vor meine Hütte: {schatz}, glatt und kühl wie Wasser. Ich habe es versteckt. Vielleicht kommt das Wesen eines Tages zurück, um es zu holen. Bis dahin: Hüte es.'),
      _t('Ich bin {bestie} gefolgt, bis zum Ende des Flusses. Dort, wo das Wasser in die Erde fließt, lag {schatz}. Ein Geschenk, glaube ich. Ich habe es versiegelt – für jemanden, der Ungeheuer nicht fürchtet.')] },

  { k: 'karawane', kinds: ['muenze', 'karte', 'kompass', 'brief', 'figur'],
    t: [_t('Die Karawane von {ich}'), _t('Der letzte Handelszug nach {ziel}')],
    s: [_t('{n} Wagen, Seide, Salz und Gewürze. Ich führe die größte Karawane, die {ort} je verlassen hat, nach {ziel}. Und ganz unten in der letzten Kiste liegt {schatz}.'),
      _t('Handelsbuch der Karawane von {ich}. Ladung: Tuch, Öl, Glas – und eine Kiste, über die niemand spricht. Ziel: {ziel}. Reisedauer: zu lang.')],
    m: [[_t('Die erste Woche verlief ruhig. Zu ruhig. Die Wachen langweilen sich, und gelangweilte Wachen trinken.')],
      [_t('Überfall in der Nacht. Die Bande von {feind} hat drei Wagen genommen. Mein bester Kutscher ist verwundet.')],
      [_t('Wir haben einen Pfad durch die Wildnis genommen, um den Räubern auszuweichen. Ich bereue es jeden Tag.')],
      [_t('Ein Rad ist gebrochen, und der Fluss ist zu breit. {du} schwört, eine Furt zu kennen. Ich kenne {du} zu gut, um das zu glauben.')],
      [_t('Wir haben die Wagen zurückgelassen. Nur das Wertvollste tragen wir noch. Und das Wertvollste ist {schatz}.'), _t('Die Gewürze sind uns ausgegangen. Wir haben gelernt, wie fade die Welt ohne sie schmeckt. Morgen essen wir das Salz.')]],
    e: [_t('Die Karawane ist am Ende. Ich verstecke {schatz} ganz in der Nähe, wo {feind} es nicht findet. Die Kaufleute von {ziel} werden nie erfahren, was ihnen entgangen ist. Du aber schon.'),
      _t('Wir haben {ziel} erreicht – mit einem Wagen, zwei Kamelen und einer Menge Geschichten. Die Kiste mit {schatz} habe ich nicht verkauft. Sie liegt versiegelt am Wegrand, ein Geschenk an den nächsten Reisenden.')] },

  { k: 'tor', kinds: ['rune', 'tafel', 'ring', 'laterne', 'schaedel'],
    t: [_t('Die Wacht am Tor von {ziel}'), _t('Der Schlüssel von {ziel}')],
    s: [_t('Mein Volk hütete das Tor von {ziel}, seit es Tore gibt. Ich bin {ich}, die letzte Wache. Niemand kommt mehr, um mich abzulösen.'),
      _t('Siebenhundert Jahre Wache, und ich bin der jüngste Teil davon. Das Tor von {ziel} schweigt. Noch.')],
    m: [[_t('Heute kam ein Wanderer und fragte, was hinter dem Tor liege. Ich sagte: Nichts, das du sehen willst. Der Wanderer ging. Gut.')],
      [_t('Das Tor flüstert. Es will geöffnet werden. Ich habe gelernt, nicht hinzuhören, aber heute war es schwer.')],
      [_t('{feind} hat ein Heer gesammelt, um das Tor zu öffnen. Dahinter liege Macht, glaubt {feind}. Das stimmt. Genau das ist das Problem.')],
      [_t('Ich habe den Schlüssel, {schatz}, aus dem Tor gelöst. Ohne ihn öffnet es sich nie. Jetzt jagen sie mich statt das Tor.')],
      [_t('Ich bin müde. Hunderte Jahre Wache, und nun das. Aber ich renne weiter. Wer sonst?')]],
    e: [_t('Ich habe {schatz} versteckt, wo kein Heer marschiert. Das Tor bleibt verschlossen. Wenn du das liest, liegt die Wacht nun bei dir. Verzeih mir. Es ist eine schwere Last – und eine schöne.'),
      _t('{feind} hat aufgegeben, das Heer ist heimgezogen. {schatz} liegt versiegelt, und ich darf endlich schlafen. Weck mich nicht. Aber wenn du den Schlüssel findest, halte ihn fern von jedem Tor.')] },

  { k: 'fluegel', kinds: ['feder', 'kompass', 'karte', 'tagebuch', 'figur'],
    t: [_t('Die Flügel von {ich}'), _t('Der Himmel über {ort}')],
    s: [_t('Alle in {ort} lachen über meine Flügel aus Leinen und Weidenholz. Heute bin ich {n} Herzschläge lang geflogen. Niemand lacht mehr.'),
      _t('Notiz an mich selbst: Wenn Vögel fliegen können, kann ich es auch. Notiz an mich selbst, zwei Tage später: Vögel haben keine Knie. Das erklärt einiges.')],
    m: [[_t('Absturz Nummer {m}. Gebrochener Arm, gebrochener Flügel, ungebrochener Wille. Gut, der Wille ist etwas angeknackst.')],
      [_t('Ich brauche etwas, das leichter ist als Holz und stärker als Eisen. Man erzählt von den Federn eines Riesenvogels namens {bestie}.')],
      [_t('Ich habe das Nest von {bestie} gefunden. Leer. Nur eine einzige Feder, so lang wie ich.')],
      [_t('{feind} will meine Flügel für die Armee: fliegende Soldaten. Ich habe die Pläne verbrannt. Alle bis auf die in meinem Kopf.')],
      [_t('Ich bin über das Tal geflogen. Von oben sieht man Dinge, die man unten nie bemerkt: Wege, Muster, Narben im Land.')]],
    e: [_t('Von oben habe ich ihn gesehen: einen Kreis aus Steinen, den niemand vom Boden aus erkennt. Darin lag {schatz}. Ich bin gelandet, habe es geborgen und neu versteckt. Wer fliegen kann, findet es leichter. Wer nicht – nun, du bist trotzdem hier.'),
      _t('Ich fliege jetzt jeden Tag, und die Kinder von {ort} rennen unter mir her und winken. {schatz}, das ich auf meinen Flügen fand, habe ich versiegelt. Es soll jemandem gehören, der nach oben schaut.')] },

  { k: 'erbe', mg: ['du'], kinds: ['brief', 'ring', 'karte', 'muenze', 'spieluhr'],
    t: [_t('Das Erbe von {ort}'), _t('Die Erben von {ort}')],
    s: [_t('Unser Vater ist tot, und er hinterließ uns nur ein Rätsel: {schatz} liege irgendwo in den Endlosen Landen, und es gehöre dem, der es zuerst findet. Mein Bruder {du} ist schon losgeritten.'),
      _t('Vaters Testament war eine Karte und ein einziger Satz: Findet es zusammen oder gar nicht. Mein Bruder {du} hat die Karte zerrissen und mir die Hälfte gegeben.')],
    m: [[_t('Ich habe die erste Spur des Vaters gefunden. Eine Kerbe in einem Baum, wie früher, wenn wir Verstecken spielten. Er hat das hier für uns beide angelegt.')],
      [_t('{du} war vor mir hier. Die Asche des Lagerfeuers ist noch warm. Mein Bruder hat mir sogar etwas Brot dagelassen. Das passt nicht zu ihm.')],
      [_t('Wir haben uns getroffen und gestritten, wie früher. Dann haben wir zusammen gegessen, wie früher. Morgen gehen wir getrennte Wege. Wie früher.')],
      [_t('{feind}, der alte Gläubiger des Vaters, ist uns beiden auf den Fersen und will {schatz} als Bezahlung für Schulden, von denen keiner etwas weiß.')],
      [_t('{du} ist verletzt. Ich habe angehalten. Das Rennen kann warten.')]],
    e: [_t('Wir haben es zusammen gefunden. Neben {schatz} lag ein Brief des Vaters: Ich wusste, dass ihr es nur gemeinsam findet. Wir haben gelacht, bis wir weinten. Wir verstecken es wieder, nicht weit von hier, für alle, die jemanden wiederfinden müssen.'),
      _t('Mein Bruder und ich stehen vor dem Versteck und keiner will es öffnen. Wir haben gemerkt, dass wir es gar nicht mehr brauchen. {schatz} bleibt versiegelt in seinem Versteck. Wir gehen nach Hause. Zusammen.')] },

  { k: 'tote', kinds: ['laterne', 'schaedel', 'brief', 'floete', 'ring'],
    t: [_t('Die Toten von {ort}'), _t('Die Laterne der Toten')],
    s: [_t('Ich hebe seit {n} Jahren die Gräber in {ort} aus. Heute stand ein Grab offen, das ich gestern zugeschüttet hatte. Darin lag kein Toter, sondern ein Brief. Mit meinem Namen.'),
      _t('Die Toten von {ort} sind unruhig. Seit drei Nächten klopfen sie von unten gegen die Grabsteine. Ich habe beschlossen, sie zu fragen, was sie wollen.')],
    m: [[_t('Der Brief ist unterschrieben mit {du}. Ich habe {du} vor {m} Jahren begraben. Mit eigenen Händen.')],
      [_t('Die Toten von {ort} wandern. Nicht alle, nur die, die etwas vergessen haben. Sie zeigen alle in dieselbe Richtung.')],
      [_t('{feind} hat die Gruft geplündert. Die Toten sind wütend. Außer mir hört sie niemand.')],
      [_t('Ich habe {du} gesehen. Ganz kurz, im Nebel. Kein Wort, nur ein Nicken. Ich gehe weiter.')],
      [_t('Ich trage jetzt die Laterne der Toten. Ihr Licht zeigt Wege, die Lebende nicht sehen.')]],
    e: [_t('Die Toten haben bekommen, was sie wollten: {schatz}, gestohlen aus der Gruft, ruht wieder an einem geweihten Ort. Ich habe es ganz in der Nähe zur Ruhe gelegt. Wenn du es nimmst, frag die Toten vorher. Sie sind freundlicher, als man denkt.'),
      _t('{du} hat sich verabschiedet, diesmal richtig. Zurück blieb {schatz}, kalt wie Mondlicht. Ich habe es versiegelt. Die Toten von {ort} schlafen jetzt ruhig, und ich auch.')] },

  { k: 'lehrling', mg: ['feind'], kinds: ['feder', 'rolle', 'schaedel', 'figur', 'laterne'],
    t: [_t('Die Lehrjahre von {ich}'), _t('Der Turm von {feind}')],
    s: [_t('Mein Meister {feind} ist verschwunden. Nur der Hut ist noch da, und der Hut spricht. Ich solle {schatz} finden, bevor es jemand anders tut, sagt er. Ich bin erst im zweiten Lehrjahr.'),
      _t('Zauberlehrling im zweiten Jahr, und mein Meister lässt mich allein im Turm. Mit einem sprechenden Hut, einer Liste und einer Warnung: Fass {schatz} nicht ohne Handschuhe an.')],
    m: [[_t('Der Hut ist unhöflich. Er verbessert meine Zauber und schnarcht. Aber er kennt den Weg.')],
      [_t('Mein erster Feuerball. Er war klein und hat meinen Ärmel getroffen. Der Hut hat gelacht, bis er Schluckauf bekam.')],
      [_t('Wir sind nicht allein. Die anderen Schüler des Meisters suchen auch. {du} hat mir aufgelauert und dann gefragt, ob wir zusammen suchen. Ich habe ja gesagt. Der Hut nennt mich naiv.')],
      [_t('Der Meister ist nicht verschwunden. Er hat sich versteckt – vor etwas, das ihn jagt. Der Hut wusste es die ganze Zeit.')],
      [_t('Ich habe einen Zauber gewirkt, der funktioniert hat. Ganz ohne Hilfe. Der Hut hat geschwiegen. Ich glaube, er war stolz.')]],
    e: [_t('{schatz} ist das Vermächtnis meines Meisters, und es wartet auf neue Hände. Ich bin noch nicht bereit. Ich verstecke es ganz in der Nähe, und der Hut wacht darüber. Sei höflich zu ihm, wenn du kommst.'),
      _t('Der Meister ist zurück, beschämt und ohne Augenbrauen. {schatz} hat er mir geschenkt, zum Ende meiner Lehrzeit. Ich habe es versiegelt – für den nächsten Lehrling, der den Mut hat, weiterzusuchen.')] },

  { k: 'weltentor', kinds: ['tafel', 'rune', 'rolle', 'kompass', 'schaedel'],
    t: [_t('Die Erbauer des Weltentors'), _t('Das Geheimnis von {ziel}')],
    s: [_t('Wir haben das Tor nicht gebaut, um hindurchzugehen. Wir haben es gebaut, um etwas draußen zu halten. Ich, {ich}, war dabei, als der letzte Stein gesetzt wurde. Ich schreibe es auf, damit es jemand weiß.'),
      _t('Jeder in Klingenhort kennt das Weltentor. Niemand fragt, wer es gebaut hat. Ich habe gefragt. Die Antwort führte mich hierher, in die Endlosen Lande.')],
    m: [[_t('Die Zwerge lieferten den Stein, die Elfen das Lied, das ihn bindet. Wir Menschen lieferten das Einzige, was wir im Überfluss haben: Neugier. Ein Fehler, wie sich zeigte.')],
      [_t('Die ersten Kundschafter kamen mit Gold zurück. Die zweiten mit Geschichten. Die dritten kamen nicht zurück.')],
      [_t('Hinter dem Tor ist die Welt größer, als sie sein dürfte. Ich bin {n} Tage gewandert und habe keinen Rand gefunden. Nur mehr Land.')],
      [_t('{feind} hat herausgefunden, wozu {schatz} dient: Es kann das Tor für immer schließen. Oder für immer öffnen.')],
      [_t('Ich habe {schatz} an mich genommen und bin geflohen, tiefer in die Lande hinein. Wohin sonst?')]],
    e: [_t('Das Tor steht noch, und das ist gut so. {schatz} habe ich vergraben, weit draußen, wo nur die Mutigsten hinkommen. Wenn du es findest, entscheide klug. Wir haben es nicht getan.'),
      _t('Am Ende habe ich verstanden: Das Weltentor hält nichts draußen. Es hält die Endlosen Lande zusammen. {schatz} ist der Grundstein. Ich habe ihn versiegelt. Pass gut auf ihn auf – die Welt hängt daran, ein bisschen.')] },

  { k: 'archiv', kinds: ['rolle', 'feder', 'tagebuch', 'brief', 'tafel'],
    t: [_t('Die verschollene Abschrift'), _t('Das Archiv von {ort}')],
    s: [_t('Archivar Ulmo war mein Schüler, lange bevor sein Bart grau wurde. Ich, {ich}, ging in die Endlosen Lande, um das Buch zu finden, das alle anderen Bücher erklärt: {schatz}.'),
      _t('Liebe Bibliothek von Klingenhort, falls dieser Brief je ankommt: Ich habe eine Spur gefunden. {schatz} existiert. Sagt Ulmo, er soll aufhören, Tee mit Salz zu kochen.')],
    m: [[_t('Hier draußen schreibt jeder Stein Geschichte. Ich habe drei Notizbücher gefüllt und bin noch keine Woche unterwegs.')],
      [_t('In einer Ruine fand ich eine Bibliothek ohne Dach. Die Bücher waren zu Stein geworden. Ich konnte sie trotzdem lesen, mit den Fingern.')],
      [_t('Ich vermisse den Geruch von Pergament und Ulmos furchtbaren Tee. Den Tee am meisten. Sag ihm das nicht.')],
      [_t('Jemand folgt mir: {feind}, aus der Gilde der Bücherverbrenner. Wissen sei gefährlich, sagen sie dort. Das stimmt. Aber Unwissen ist gefährlicher.')],
      [_t('Ich lese jetzt in den Sternen, im Wind, im Flug der Krähen. Die Lande sind ein Buch, und ich habe erst das Inhaltsverzeichnis gelesen.')]],
    e: [_t('Ich habe {schatz} gefunden. Es ist kein Buch. Es ist ein Spiegel für Gedanken. Ich verstecke es ganz in der Nähe und gehe weiter, denn das letzte Kapitel will ich selbst schreiben. Wenn du nach Klingenhort zurückkehrst: Grüß Ulmo von mir.'),
      _t('{schatz} liegt versiegelt ganz in der Nähe, und mit ihm das Ende meiner Abschrift. Bring sie nach Klingenhort. Ulmo wird weinen, schimpfen und dann Tee kochen. Trink ihn trotzdem.')] }
];
const ADAY = _t('Tag {tag}.');

/* ---------- Lage aller Spuren in der Welt (fest, beim Laden in wenigen Millisekunden berechnet) ----------
   Spur c liegt umso weiter draußen, je größer c ist (die ersten drei als Einstieg direkt am Tor);
   von Fundort zu Fundort geht es eher quer zur Tiefe weiter, damit eine Spur in ihrem Gefahrengebiet bleibt. */
function aKey(cx, cy) { return (cx + 10000) * 20011 + (cy + 10000); }
function aBuild() {
  const ch = [], idx = new Map(); let off = 0;
  for (let c = 0; c < ARTE_NC; c++) {
    const R = mulberry(aH(1, c)), u = (c + .5) / ARTE_NC;
    const D = c < 3 ? 4 + c * 1.6 + R() : 5 + (AWR - 260) * Math.pow(u, 1.75);   // Abstand zum Tor in Chunks
    const dep = Math.min(1, D / AWR);
    const L = dep < .004 ? 3 + (R() < .5 ? 0 : 1) : dep < .03 ? 3 + Math.floor(R() * 3) : Math.min(9, 4 + Math.floor(R() * 3 + R() * 3.2));
    const th = c * 2.39996323 + (R() - .5) * .6, hop = 3 + 34 * Math.pow(dep, .75), S = [];
    let x = Math.cos(th) * D, y = Math.sin(th) * D, hd = th + (R() < .5 ? 1 : -1) * Math.PI / 2 + (R() - .5) * .9;
    for (let i = 0; i <= L; i++) {   // L Artefakte, dann der Schatz
      if (i) {
        hd += (R() - .5) * 1.2;
        let dx = Math.cos(hd), dy = Math.sin(hd);
        const r = Math.hypot(x, y) || 1, ux = x / r, uy = y / r, rc = dx * ux + dy * uy, lo = Math.max(2.5, D * .8 - 3), hi = Math.min(AWR - 8, D * 1.2 + 4);
        if ((r > hi && rc > 0) || (r < lo && rc < 0)) { dx -= 2 * rc * ux; dy -= 2 * rc * uy; hd = Math.atan2(dy, dx); }   // an der Tiefe spiegeln
        const h = hop * (.75 + R() * .5) * (i === L ? 1.2 : 1);
        x += dx * h; y += dy * h;
        const r2 = Math.hypot(x, y) || 1; if (r2 < 2.2) { x *= 2.2 / r2; y *= 2.2 / r2; } else if (r2 > AWR - 6) { x *= (AWR - 6) / r2; y *= (AWR - 6) / r2; }
      }
      const X = Math.round((AGATE + x) * ACK), Y = Math.round((AGATE + y) * ACK), cx = Math.floor(X / ACK), cy = Math.floor(Y / ACK);
      const s = { c, i, cx, cy, x: cx * ACK + clamp(X - cx * ACK, 96, ACK - 96), y: cy * ACK + clamp(Y - cy * ACK, 96, ACK - 96), t: i === L, id: i === L ? -1 : off + i };
      S.push(s); const k = aKey(cx, cy); let l = idx.get(k); if (!l) idx.set(k, l = []); l.push(s);
    }
    ch.push({ c, L, off, dep, D, hop, sites: S }); off += L;
  }
  const cOf = new Uint16Array(off); for (const C of ch) for (let i = 0; i < C.L; i++) cOf[C.off + i] = C.c;
  return { ch, idx, N: off, cOf };
}
const ALAY = aBuild(), ARTE_N = ALAY.N;

/* ---------- Eine Spur: Thema, Figuren, Reihenfolge der Geschichte, Arten, Belohnung ---------- */
const ACHC = [];
function aChain(c) {
  if (ACHC[c]) return ACHC[c];
  const S = ALAY.ch[c], R = mulberry(aH(2, c)), th = ATH[(c * 9 + Math.floor(c / ATH.length) * 5) % ATH.length];
  const cu = aH(3, c) % 4, cu2 = R() < .3 ? Math.floor(R() * 4) : cu;
  const mg = th.mg || [], V = { ich: aPerson(R, cu, R() < .6), du: aPerson(R, cu2, false, mg.includes('du')), feind: aPerson(R, (cu + 2) % 4, R() < .5, mg.includes('feind')), ort: aPlace(R, cu), ziel: aPlace(R, cu2), schatz: aWord(R, ATRS), bestie: aWord(R, ABST), orden: aPlace(R, (cu + 1) % 4), gott: aPk(R, AGOD), n: 7 + Math.floor(R() * 9), m: 2 + Math.floor(R() * 4) };
  for (let k = 0; k < 4 && V.du.split(' ')[0] === V.ich.split(' ')[0]; k++) V.du = aPerson(R, (cu2 + k + 1) % 4, false, mg.includes('du'));
  if (V.ziel === V.ort) V.ziel = aPlace(R, (cu + 3) % 4);
  const L = S.L, need = L - 2, M = th.m.length, beats = [th.s];
  // Mitte: gleichmäßig aus dem Thema, in Reihenfolge; ist die Spur länger, kommen Zwischenspiele dazu
  if (need <= M) for (let k = 0; k < need; k++) beats.push(th.m[Math.floor((k + .5) * M / need)]);
  else { const mid = th.m.slice(); while (mid.length < need) mid.splice(1 + Math.floor(R() * mid.length), 0, [aPk(R, AINTER)]); beats.push(...mid); }
  beats.push(th.e);
  const kinds = [], col = [], days = [], names = []; let day = 1 + Math.floor(R() * 3), pref = [];
  for (let i = 0; i < L; i++) {
    if (!pref.length) pref = aShuf(R, th.kinds.slice());
    let k = R() < .72 ? pref.shift() : aPk(R, AKINDS); for (let t = 0; t < 4 && kinds.includes(k); t++) k = aPk(R, AKINDS);
    kinds.push(k); col.push(Math.floor(R() * 6)); days.push(day); day += 1 + Math.floor(R() * 5);
    const nm = AKIND[k].nm.map(x => aFill(x, V)), o = Math.floor(R() * nm.length); let n = nm[o];
    for (let t = 1; t < nm.length && names.includes(n); t++) n = nm[(o + t) % nm.length];
    names.push(names.includes(n) ? n + ' · ' + (i + 1) : n);
  }
  const dep = S.dep, rw = { egg: R() < .28 + dep * .3, mod: R() < .35 + dep * .3, tool: c % 11 === 5 && dep > .015, guard: c >= 3 && R() < .1 + dep * .3, fate: 1 + (dep > .3 ? 1 : 0) + (L >= 8 ? 1 : 0), slot: Math.floor(R() * 3), base: Math.floor(R() * 8) };
  return ACHC[c] = { c, th, V, L, off: S.off, sites: S.sites, dep, D: S.D, hop: S.hop, title: aFill(aPk(R, th.t), V), beats, kinds, col, days, names, rw };
}
function arteChainInfo(c) { return c >= 0 && c < ARTE_NC ? aChain(c) : null; }

/* ---------- Ein Artefakt ---------- */
const ADEF = new Map();
function arteDef(id) {
  id = Math.floor(+id); if (!(id >= 0 && id < ARTE_N)) return null;
  const hit = ADEF.get(id); if (hit) return hit;
  const c = ALAY.cOf[id], C = aChain(c), i = id - C.off, s = C.sites[i], nx = C.sites[i + 1], last = i === C.L - 1, R = mulberry(aH(4, c, i));
  const kind = C.kinds[i], K = AKIND[kind], V = C.V;
  let body = aFill(aPk(R, C.beats[i]), V); if (kind === 'tagebuch' && R() < .55) body = aFill(ADAY, { tag: C.days[i] }) + ' ' + body;
  const T0 = aTerrain(s.cx, s.cy), T1 = aTerrain(nx.cx, nx.cy), FL = R() < .8 && T0.k !== 'x' ? AFUND[T0.k] : AFUND.x, fund = FL[(aH(12, c) + i) % FL.length], frame = aFill(aPk(R, K.fr), V);
  const dist = Math.hypot(nx.x - s.x, nx.y - s.y), dir = aDirIdx(nx.x - s.x, nx.y - s.y), steps = aSteps(dist);
  // Hinweis und Gelände reihum statt zufällig: zwei Funde hintereinander klingen nie gleich
  const CL = last ? (K.w ? ATREASW : ATREASV) : (K.w ? ACLUEW : ACLUEV), WO = AWO[T1.k] || AWO.x;
  const clue = aFill(CL[(aH(13, c) + i) % CL.length], { richtung: ADIR[dir], schritte: aNum(steps), gelaende: WO[(aH(14, c) + i) % WO.length] });
  const sig = kind === 'brief' || kind === 'tagebuch' || kind === 'rolle' ? '– ' + V.ich : '';
  const d = { id, chain: c, idx: i, n: C.L, kind, kindName: K.n, name: C.names[i], icon: arteIconURL(kind, C.col[i]), last, w: !!K.w, title: C.title, steps, dir, x: s.x, y: s.y, parts: { fund, frame, body, sig, clue } };
  d.text = [fund, frame, K.w ? body : '„' + body + '“', clue, sig].filter(Boolean).join(' ');
  if (ADEF.size > 600) ADEF.clear();
  ADEF.set(id, d); return d;
}

/* ---------- Spielstand: Bits statt Listen (5000 Funde ≈ 850 Zeichen) ---------- */
const AB64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
function aDec(s, n) { const a = new Uint8Array(n); s = typeof s === 'string' ? s : ''; for (let i = 0; i < s.length && i * 6 < n; i++) { const v = AB64.indexOf(s[i]); if (v < 0) continue; for (let b = 0; b < 6; b++) if (v >> b & 1 && i * 6 + b < n) a[i * 6 + b] = 1; } return a; }
function aEnc(a) { let s = '', last = 0; for (let i = 0; i < a.length; i += 6) { let v = 0; for (let b = 0; b < 6; b++) if (a[i + b]) v |= 1 << b; s += AB64[v]; if (v) last = s.length; } return s.slice(0, last); }
function aMetaFix(d) {
  d = d && typeof d === 'object' ? d : {};
  const num = v => Math.max(0, Math.floor(+v) || 0), str = v => typeof v === 'string' && /^[A-Za-z0-9_-]*$/.test(v) ? v.slice(0, 2000) : '';
  const enc = {}; if (d.enc && typeof d.enc === 'object') for (const k in d.enc) if (/^[a-z]{2,16}$/.test(k)) enc[k] = Math.min(9999, num(d.enc[k]));
  const ids = (a, n, max) => (Array.isArray(a) ? a : []).map(x => Math.floor(+x)).filter(x => x >= 0 && x < n).slice(0, max);
  const tr = Math.floor(+d.tr); return { v: 1, f: str(d.f), t: str(d.t), c: str(d.c), tr: tr >= 0 && tr < ARTE_NC ? tr : -1, ru: ids(d.ru, ARTE_NC, 8), enc, ms: Math.min(99, num(d.ms)), nw: ids(d.nw, ARTE_N, 12), g: ids(d.g, ARTE_NC, 200), last: Math.floor(+d.last) >= 0 ? Math.floor(+d.last) : -1 };
}
// Wirft hier etwas, würde loadAll einen leeren Spielstand anlegen – deshalb nie werfen
HOOK.meta.push(m => { try { m.arte = aMetaFix(m.arte); } catch (e) { console.error('Artefakte (meta):', e); m.arte = aMetaFix(null); } AB.src = null; });
// Entschlüsselte Bits im Speicher, neu gelesen, sobald ein anderer Spielstand geladen ist
const AB = { src: null, f: null, t: null, c: null, cnt: null, n: 0 };
function aBits() {
  const M = aLocal(); if (!M) return null;
  if (AB.src !== M) {
    AB.src = M; AB.f = aDec(M.f, ARTE_N); AB.t = aDec(M.t, ARTE_NC); AB.c = aDec(M.c, ARTE_NC); AB.cnt = new Uint8Array(ARTE_NC); AB.n = 0;
    for (let i = 0; i < ARTE_N; i++) if (AB.f[i]) { AB.cnt[ALAY.cOf[i]]++; AB.n++; }
  }
  return AB;
}
function aHas(id) { const B = aBits(); return !!B && !!B.f[id]; }
function aDone(c) { const B = aBits(); return !!B && B.cnt[c] >= ALAY.ch[c].L; }
function aOpened(c) { const B = aBits(); return !!B && !!B.t[c]; }
function aClaimed(c) { const B = aBits(); return !!B && !!B.c[c]; }
function aSetBit(k, i) { const B = aBits(), M = aLocal(); if (!B || B[k][i]) return false; B[k][i] = 1; M[k] = aEnc(B[k]); if (k === 'f') { B.cnt[ALAY.cOf[i]]++; B.n++; } return true; }
function arteFound() { const B = aBits(); return B ? B.n : 0; }
function aComplete() { const B = aBits(); let n = 0; if (B) for (let c = 0; c < ARTE_NC; c++) if (B.t[c] && B.cnt[c] >= ALAY.ch[c].L) n++; return n; }
function aStarted() { const B = aBits(), l = []; if (B) for (let c = 0; c < ARTE_NC; c++) if (B.cnt[c]) l.push(c); return l; }

/* ---------- Wo ist der Held? (landePos() der Welt, sonst die zuletzt erzeugten Chunks) ---------- */
const ASEEN = [];
function aSeen(ctx) { if (!ctx || !isFinite(ctx.cx)) return; ASEEN.push([ctx.cx | 0, ctx.cy | 0]); if (ASEEN.length > 9) ASEEN.shift(); }
function aHere() {
  try { if (typeof landePos === 'function') { const p = landePos(); if (p && isFinite(p.wx)) return { x: p.wx, y: p.wy }; if (p && isFinite(p.x)) return { x: p.x, y: p.y }; } } catch (_) { }
  if (!ASEEN.length || !(typeof landeActive === 'function' && landeActive())) return null;
  let x = 0, y = 0; for (const [cx, cy] of ASEEN) { x += cx; y += cy; } return { x: (x / ASEEN.length + .5) * ACK, y: (y / ASEEN.length + .5) * ACK };
}
function aDepth() { try { if (typeof landeDepth === 'function') { const d = +landeDepth(); if (isFinite(d)) return clamp(d, 0, 1); } } catch (_) { } const h = aHere(); return h ? clamp(Math.hypot(h.x / ACK - AGATE, h.y / ACK - AGATE) / AWR, 0, 1) : 0; }
function aStageAt(dep) { try { if (typeof worldStage === 'function') { const s = +worldStage(dep); if (isFinite(s) && s > 0) return Math.round(s); } } catch (_) { } return 6 + Math.round(Math.pow(clamp(dep, 0, 1), .6) * 110); }
function aStage() { try { if (G && G.type) return Math.max(1, stageNum()); } catch (_) { } return aStageAt(aDepth()); }

/* ---------- Schnittstelle für die Welt ---------- */
function arteInChunk(ctx) {
  try {
    if (!ctx) return []; aSeen(ctx);
    const l = ALAY.idx.get(aKey(ctx.cx | 0, ctx.cy | 0)); if (!l) return [];
    const out = [];
    for (const s of l) if (!s.t && !aHas(s.id)) { const d = arteDef(s.id); out.push({ id: s.id, x: s.x, y: s.y, chain: s.c, idx: s.i, kind: d.kind, name: d.name, icon: d.icon, next: s.i === 0 || aHas(s.id - 1), take: () => artePickup(s.id), open: () => artePickup(s.id) }); }
    return out;
  } catch (e) { console.error('Artefakte (Chunk):', e); return []; }
}
function arteTreasureInChunk(ctx) {
  try {
    if (!ctx) return []; aSeen(ctx);
    const l = ALAY.idx.get(aKey(ctx.cx | 0, ctx.cy | 0)); if (!l) return [];
    const out = [];
    for (const s of l) if (s.t && !aOpened(s.c)) { const C = aChain(s.c); out.push({ id: 'T' + s.c, chain: s.c, x: s.x, y: s.y, ready: aDone(s.c), name: C.title, guard: !!C.rw.guard, open: () => arteTreasureOpen(s.c) }); }
    return out;
  } catch (e) { console.error('Artefakte (Schatz):', e); return []; }
}
// Suchkreis um einen Fundort: der Ort liegt sicher im Kreis, aber nicht in der Mitte
function aCircle(C, i, big) {
  const s = C.sites[i], r = clamp(.3 * C.hop, .45, 4) * ACK * (big ? 2.2 : 1), a = aH(6, C.c, i) / 4294967296 * Math.PI * 2, k = (aH(7, C.c, i) % 1000) / 1000 * (big ? .7 : .55);
  return { x: Math.round(s.x + Math.cos(a) * r * k), y: Math.round(s.y + Math.sin(a) * r * k), r: Math.round(r) };
}
function arteHints() {
  const out = [];
  try {
    const B = aBits(), M = aLocal(); if (!B) return out;
    for (const c of aStarted()) {
      const C = aChain(c), tr = M.tr === c;
      for (let i = 0; i < C.L; i++) {
        const s = C.sites[i];
        if (!B.f[s.id] && (i === 0 ? false : B.f[s.id - 1])) out.push(Object.assign(aCircle(C, i), { label: _t('{t} · {n}/{m}', { t: C.title, n: B.cnt[c], m: C.L }), c: tr ? '#ffd24a' : '#e8dcc0', k: 'arte', chain: c, idx: i, track: tr }));
      }
      if (!B.f[C.off]) out.push(Object.assign(aCircle(C, 0, true), { label: _t('Anfang der Spur: {t}', { t: C.title }), c: '#c8b48a', k: 'start', chain: c, idx: 0, track: tr }));
      if (B.cnt[c] >= C.L && !B.t[c]) out.push(Object.assign(aCircle(C, C.L), { label: _t('Schatz: {t}', { t: C.title }), c: '#ffb03a', k: 'treasure', chain: c, idx: C.L, track: tr }));
      if (out.length > 60) break;
    }
    // Gerüchte und verfolgte Spur, solange noch nichts davon gefunden ist: großer Kreis um den Anfang
    for (const c of [M.tr].concat(M.ru)) if (c >= 0 && !B.cnt[c] && !out.some(o => o.chain === c)) { const C = aChain(c); out.push(Object.assign(aCircle(C, 0, true), { label: _t('Gerücht: {t}', { t: C.title }), c: '#b892f4', k: 'rumor', chain: c, idx: 0, track: M.tr === c })); }
  } catch (e) { console.error('Artefakte (Hinweise):', e); }
  return out;
}
// Gerücht über die nächste Spur ohne Fund (von einem Ort aus, sonst vom Tor): für Händler, Kundschafter, die Chronik
function arteRumor(cx, cy, skip) {
  const B = aBits(); if (!B) return null;
  const h = isFinite(cx) ? { x: (cx + .5) * ACK, y: (cy + .5) * ACK } : aHere() || { x: AGATE * ACK, y: AGATE * ACK };
  let best = null, bd = 1e18; const no = new Set(skip || []);
  for (let c = 0; c < ARTE_NC; c++) { if (B.cnt[c] || no.has(c)) continue; const s = ALAY.ch[c].sites[0], d = (s.x - h.x) ** 2 + (s.y - h.y) ** 2; if (d < bd) { bd = d; best = c; } }
  if (best == null) return null;
  const C = aChain(best), s = C.sites[0], dir = aDirIdx(s.x - h.x, s.y - h.y), steps = aSteps(Math.sqrt(bd)), T = aTerrain(s.cx, s.cy);
  const V = { t: C.title, schritte: aNum(steps), richtung: ADIR[dir], gelaende: aPk(mulberry(aH(9, best)), AWO[T.k] || AWO.x) }, from = isFinite(cx) ? 'hier' : aHere() ? 'du' : 'tor';
  return { chain: best, x: s.x, y: s.y, steps, dir, text: _t('Man erzählt von „{t}“. Der Anfang der Spur liegt etwa {schritte} Schritte nach {richtung}, dort, {gelaende}.', V),
    hint: from === 'tor' ? _t('Der Anfang liegt etwa {schritte} Schritte nach {richtung} vom Weltentor, dort, {gelaende}.', V) : from === 'du' ? _t('Der Anfang liegt etwa {schritte} Schritte nach {richtung} von dir, dort, {gelaende}.', V) : _t('Der Anfang liegt etwa {schritte} Schritte nach {richtung} von hier, dort, {gelaende}.', V) };
}
function aRumorAdd(c) { const M = aLocal(); if (!M || c == null || c < 0) return false; if (!M.ru.includes(c)) { M.ru.unshift(c); M.ru = M.ru.slice(0, 8); } persist(); return true; }

/* ---------- Auflesen ---------- */
const AMS = [5, 15, 30, 50, 100, 200, 350, 500, 750, 1000, 1500, 2000, 3000, 4000, 5000];
function artePickup(id, o) {
  o = o || {};
  try {
    const d = arteDef(id), M = aLocal(); if (!d || !M) return false;
    if (aHas(id)) { if (!o.quiet) arteRead(id, o.back); return false; }
    aSetBit('f', id); M.nw = [id].concat(M.nw.filter(x => x !== id)).slice(0, 12); M.last = id; M.ru = M.ru.filter(c => c !== d.chain);
    if (M.tr < 0 || aDone(M.tr) && aOpened(M.tr)) M.tr = d.chain;   // die neue Spur gleich verfolgen, wenn keine andere läuft
    stat('arte'); statMax('arteMax', arteFound());
    const ms = []; while (M.ms < AMS.length && arteFound() >= AMS[M.ms]) { const g = AMS[M.ms] >= 1000 ? 5 : AMS[M.ms] >= 200 ? 3 : AMS[M.ms] >= 50 ? 2 : 1; ms.push([AMS[M.ms], g]); if (P) gainFate(g); M.ms++; }
    if (P && SAVE.active >= 0) saveChar(); persist(); if (P && P.gear) computeStats();
    if (!o.quiet) arteRead(id, o.back || (state === 'play' ? 'play' : 'none'), { fresh: true, ms });
    else for (const [n, g] of ms) toast(_t('{n} Artefakte gefunden! +{g} Glücksmünzen', { n, g }), '#ffd24a');
    return true;
  } catch (e) { console.error('Artefakte (Auflesen):', e); return false; }
}
function arteTake(id) { return artePickup(id); }

/* ---------- Pixel-Bilder: Artefakte, Belohnungen, Kompass ---------- */
const AGEM = ['#57c7e6', '#e8463c', '#79c24e', '#b892f4', '#ffd24a', '#ff8a3a'];
const AICO = {};
function aErase(b, x, y) { if (x >= 0 && y >= 0 && x < b.w && y < b.h) b.a[y * b.w + x] = null; }
function aIconCanvas(kind, v) {
  const b = PB(16, 16), g = AGEM[(v | 0) % AGEM.length], gl = mixC(g, '#ffffff', .55), P1 = '#e8dcc0', P2 = '#c8b48a', INK = '#7a6a4a';
  switch (kind) {
    case 'tagebuch': b.rect(3, 2, 9, 12, P1); b.rect(3, 2, 9, 1, '#fff3dc'); for (let y = 2; y < 14; y += 2) b.set(12, y, P1); for (const y of [5, 7, 9, 11]) b.rect(5, y, 5, 1, INK); b.rect(10, 1, 1, 5, g); b.set(4, 13, P2); break;
    case 'brief': b.rect(2, 4, 12, 9, '#efe2bf'); b.line(2, 4, 8, 9, P2); b.line(13, 4, 8, 9, P2); b.rect(2, 12, 12, 1, P2); b.disc(8, 9, 1.9, '#c8342c'); b.set(8, 9, '#ff6a5a'); b.set(7, 8, '#ff8a7a'); break;
    case 'tafel': b.rect(3, 2, 10, 12, '#7a7682'); b.rect(3, 2, 10, 1, '#9a96a2'); b.rect(12, 3, 1, 11, '#5a5662'); for (const [y, w] of [[5, 6], [8, 5], [11, 6]]) b.rect(5, y, w, 1, '#4a4652'); b.set(10, 8, g); b.set(6, 11, g); break;
    case 'rolle': b.rect(4, 3, 8, 10, P1); b.rect(3, 2, 10, 2, '#c8a87a'); b.rect(3, 12, 10, 2, '#c8a87a'); b.set(2, 3, '#8a5a32'); b.set(13, 3, '#8a5a32'); b.set(2, 12, '#8a5a32'); b.set(13, 12, '#8a5a32'); for (const y of [6, 8, 10]) b.rect(5, y, 6, 1, INK); b.rect(7, 4, 2, 9, g); break;
    case 'karte': b.rect(2, 3, 12, 10, P1); b.rect(6, 3, 1, 10, P2); b.rect(10, 3, 1, 10, P2); for (const [x, y] of [[3, 11], [4, 10], [5, 10], [7, 9], [8, 8], [9, 7]]) b.set(x, y, '#8a5a32'); b.line(11, 4, 13, 6, '#c8342c'); b.line(13, 4, 11, 6, '#c8342c'); b.set(4, 5, g); break;
    case 'figur': b.disc(8, 4, 2.2, '#b07a48'); b.set(7, 3, '#e8b07a'); b.rect(6, 6, 4, 6, '#8a5a32'); b.rect(5, 7, 1, 3, '#8a5a32'); b.rect(10, 7, 1, 3, '#8a5a32'); b.rect(6, 8, 4, 1, g); b.rect(5, 12, 6, 2, '#5e3a1e'); b.rect(6, 6, 1, 6, '#a8743e'); break;
    case 'kompass': b.disc(8, 8.5, 6, '#9c6a24'); b.disc(8, 8.5, 5, '#efe2bf'); b.line(8, 8, 11, 5, '#c8342c'); b.line(8, 8, 5, 11, '#3a3440'); b.set(8, 8, '#1a1420'); b.rect(7, 1, 2, 2, '#e8b04a'); b.set(8, 4, g); break;
    case 'feder': { const f = mixC(g, '#ffffff', .7); b.line(3, 13, 12, 2, '#a89a82'); for (let k = 2; k < 9; k++) { b.line(3 + k, 13 - k - 1, 3 + k + 2, 13 - k - 3 + (k > 6 ? 1 : 0), k % 2 ? f : '#ffffff'); b.set(3 + k - 1, 13 - k - 1, f); } b.set(3, 13, '#5a4a3a'); break; }
    case 'amulett': b.line(4, 2, 8, 7, '#e8b04a'); b.line(12, 2, 8, 7, '#e8b04a'); b.disc(8, 10, 3.6, '#e8b04a'); b.disc(8, 10, 2.3, g); b.set(7, 9, '#ffffff'); b.set(8, 13, '#9c6a24'); break;
    case 'ring': for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) { const d = Math.hypot(x - 8, y - 10); if (d <= 4.3 && d >= 2.5) b.set(x, y, d > 3.6 ? '#9c6a24' : '#e8b04a'); } b.disc(8, 5, 2.4, g); b.set(7, 4, '#ffffff'); break;
    case 'muenze': b.disc(8, 8, 6, '#9c6a24'); b.disc(8, 8, 5, '#e8b04a'); b.disc(8, 8, 2.6, '#c8902a'); b.set(7, 7, '#ffe08a'); b.set(5, 4, '#ffe08a'); b.rect(7, 9, 2, 1, '#9c6a24'); b.set(8, 7, g); break;
    case 'schaedel': b.disc(8, 7, 5, gl); b.rect(5, 10, 6, 3, gl); b.rect(5, 6, 2, 2, '#1a1420'); b.rect(9, 6, 2, 2, '#1a1420'); b.set(8, 9, '#1a1420'); for (const x of [6, 8, 10]) b.set(x, 12, mixC(g, '#000000', .3)); b.set(6, 3, '#ffffff'); b.set(5, 4, '#ffffff'); b.set(6, 6, g); b.set(10, 6, g); break;
    case 'rune': b.disc(8, 9, 5.6, '#5a5662'); b.disc(7, 8, 4.6, '#7a7682'); b.line(8, 5, 8, 12, g); b.line(8, 7, 10, 5, g); b.line(8, 9, 6, 7, g); b.set(9, 6, gl); break;
    case 'spieluhr': b.rect(3, 6, 10, 7, '#8a5a32'); b.rect(3, 4, 10, 2, '#b07a48'); b.rect(3, 9, 10, 1, '#e8b04a'); b.rect(13, 8, 2, 1, '#9aa2ae'); b.rect(14, 7, 1, 3, '#9aa2ae'); b.rect(7, 1, 1, 3, g); b.set(6, 3, g); b.rect(9, 1, 1, 2, g); b.set(8, 1, g); b.set(7, 10, '#ffe08a'); break;
    case 'muschel': b.disc(8, 9, 5.2, '#f0d8c8'); for (const [x, y] of [[4, 6], [6, 4], [8, 4], [10, 4], [12, 6]]) b.line(8, 13, x, y, '#c8a898'); b.rect(6, 13, 4, 1, '#c8a898'); b.set(8, 11, g); b.set(7, 6, '#ffffff'); break;
    case 'scherbe': for (let y = 2; y <= 13; y++) for (let x = Math.ceil(9 - (y - 2) * .55); x <= Math.floor(9 + (y - 2) * .3); x++) b.set(x, y, y < 6 ? '#c8d6e2' : '#aab8c6'); b.line(7, 7, 9, 5, '#ffffff'); b.set(8, 11, g); b.set(9, 10, gl); break;
    case 'floete': b.line(3, 12, 12, 3, '#e8e2cf'); b.line(4, 12, 12, 4, '#e8e2cf'); b.line(3, 11, 11, 3, '#d8d0bc'); for (const [x, y] of [[6, 9], [8, 7], [10, 5]]) b.set(x, y, '#5a4a3a'); b.disc(3, 12, 1.5, '#c8c0aa'); b.disc(12, 3, 1.5, '#c8c0aa'); b.set(5, 11, g); b.set(5, 12, g); break;
    case 'laterne': b.rect(5, 4, 6, 9, '#3a3440'); b.rect(6, 5, 4, 7, mixC(g, '#ffe08a', .6)); b.rect(7, 8, 2, 3, '#ffb03a'); b.set(7, 7, '#fff0a0'); b.rect(6, 2, 4, 2, '#3a3440'); b.rect(7, 1, 2, 1, '#5a5662'); b.rect(4, 13, 8, 1, '#3a3440'); break;
    case 'gold': for (const [x, y] of [[6, 10], [10, 10], [8, 7]]) { b.disc(x, y, 3.2, '#9c6a24'); b.disc(x, y, 2.4, '#e8b04a'); b.set(x - 1, y - 1, '#ffe08a'); } break;
    case 'fate': b.disc(8, 8, 5.5, '#c8902a'); b.disc(8, 8, 4.5, '#ffd24a'); b.disc(7, 7, 2, '#fff3c0'); b.set(6, 6, '#ffffff'); break;
    case 'ei': b.disc(8, 9.5, 4.6, '#efe2bf'); b.disc(8, 7.5, 3.6, '#efe2bf'); b.disc(7, 7, 2, '#fff8e8'); b.set(10, 10, g); b.set(6, 11, g); b.set(9, 5, g); b.set(6, 6, '#ffffff'); break;
    case 'werkzeug': b.disc(5, 5, 3, '#e8b04a'); aErase(b, 5, 5); b.line(7, 7, 13, 13, '#e8b04a'); b.line(8, 7, 13, 12, '#9c6a24'); b.rect(11, 12, 1, 2, '#e8b04a'); b.rect(12, 10, 2, 1, '#e8b04a'); b.set(4, 4, '#fff3c0'); break;
    case 'mod': b.disc(8, 8, 5, '#3a3047'); for (let k = 0; k < 6; k++) { const a = k / 6 * 6.283; b.set(8 + Math.cos(a) * 4, 8 + Math.sin(a) * 4, g); } b.disc(8, 8, 2, gl); break;
    case 'ep': b.rect(4, 3, 8, 10, '#3a5a8a'); b.rect(5, 4, 6, 8, '#57a7d6'); b.rect(7, 5, 2, 6, '#e8f8ff'); b.rect(6, 7, 4, 2, '#e8f8ff'); break;
    case 'trank': b.rect(7, 2, 2, 2, '#c8a87a'); b.rect(6, 4, 4, 2, '#aab8c6'); b.disc(8, 10, 4, '#aab8c6'); b.disc(8, 10.5, 3.2, '#c8342c'); b.set(7, 9, '#ff8a7a'); break;
    case 'truhe': b.rect(2, 6, 12, 8, '#8a5a32'); b.rect(2, 4, 12, 3, '#b07a48'); b.rect(2, 9, 12, 1, '#e8b04a'); b.rect(7, 8, 2, 3, '#ffd24a'); b.rect(2, 13, 12, 1, '#5e3a1e'); b.set(4, 5, '#e8b07a'); break;
    case 'siegel': b.rect(2, 6, 12, 8, '#5e4a3a'); b.rect(2, 4, 12, 3, '#7a6250'); b.rect(2, 9, 12, 1, '#9aa2ae'); b.disc(8, 9, 2.8, '#c8342c'); b.set(8, 9, '#ff8a7a'); b.set(7, 8, '#ff6a5a'); b.rect(2, 13, 12, 1, '#3a2a1e'); break;
    case 'pfeil': b.rect(2, 7, 8, 2, '#ffd24a'); for (let k = 0; k < 5; k++) b.rect(9 + k, 3 + k, 1, 10 - 2 * k, '#ffd24a'); b.rect(2, 7, 8, 1, '#fff3c0'); break;
    default: b.rect(4, 4, 8, 8, g);
  }
  return pbCanvas(pbOutline(b));
}
function arteIconURL(kind, v) { const k = kind + ':' + (v | 0); if (AICO[k]) return AICO[k]; const c = aIconCanvas(kind, v); return AICO[k] = mk(18, 18, g => g.drawImage(c, 1, 1)).toDataURL(); }

/* ---------- Belohnungen geben: daheim (sicher) oder als Beute vor die Füße (Freiwelt: in den Rucksack) ---------- */
function aRow(icon, label, col, sub) { return `<div class="row arrow" style="cursor:default"><div class="ic" style="box-shadow:inset 0 0 0 2px ${col}"><img src="${icon}" alt=""></div><div><div class="nm" style="color:${col}">${esc(label)}</div>${sub ? `<div class="st">${esc(sub)}</div>` : ''}</div><span></span></div>`; }
function aItemHome(it) {
  if (P.bag.length < bagCap()) { addToBag(it); return _t('Im Beutel'); }
  const S = SAVE.meta.hide.stash, cap = typeof stashCap === 'function' ? stashCap() : 0;
  if (S.length < cap) { hook('pickup', it); S.push(it); return _t('Im Lager'); }
  const g = addToBag(it); return _t('Kein Platz: für {n} Gold verkauft', { n: fmt(g) });
}
function aToolPick(dep) {
  try {
    if (typeof landeToolGive !== 'function' || typeof LANDE_TOOLS === 'undefined' || !LANDE_TOOLS) return null;
    const list = Array.isArray(LANDE_TOOLS) ? LANDE_TOOLS.map((t, i) => Object.assign({ k: t.k || t.key || String(i), i }, t)) : Object.keys(LANDE_TOOLS).map((k, i) => Object.assign({ k, i }, LANDE_TOOLS[k]));
    // Tiefe eines Werkzeugs: Anfang seines Hort-Bandes (js/lande.js); t.d ist dort die Beschreibung, keine Tiefe
    const dd = t => typeof lToolBand === 'function' ? lToolBand(t.i)[0] / (typeof LWR === 'number' ? LWR : 9000) : +(t.depth != null ? t.depth : t.dep != null ? t.dep : 0) || 0;
    const has = t => { try { return typeof landeToolHas === 'function' && landeToolHas(t.k); } catch (_) { return false; } };
    const ok = list.filter(t => !has(t) && dd(t) <= dep + .15).sort((a, b) => dd(a) - dd(b));
    return ok.length ? ok[0] : null;
  } catch (_) { return null; }
}
// Einträge: { t: 'item', it } | { t: 'gold', n } | { t: 'mat', k, n } | { t: 'gem', k } | { t: 'egg', luck } | { t: 'mod', dep, luck }
//           | { t: 'fate', n } | { t: 'xp', n } | { t: 'pot', n } | { t: 'tool', dep }   → HTML-Zeilen
function aGiveAll(list, o) {
  o = o || {}; const drop = !!o.drop && G && G.type && P; let h = '';
  const dx = () => P.x + rnd(-14, 14), dy = () => P.y + rnd(-8, 10);
  for (const e of list) {
    try {
      switch (e.t) {
        case 'item': { const it = e.it; if (!it) break; const sub = RAR[it.rar].n + ' · ' + (it.slot === 'weapon' ? WT[it.base].label : AR[it.slot].label); if (drop) { dropItem(dx(), dy(), it); h += aRow(itemIconURL(it), itemName(it), itemColor(it), sub + ' · ' + _t('liegt vor dir')); } else h += aRow(itemIconURL(it), itemName(it), itemColor(it), sub + ' · ' + aItemHome(it)); break; }
        case 'gold': if (e.n <= 0) break; if (drop) dropCoins(P.x, P.y, e.n, true); else { P.gold += e.n; stat('goldTotal', e.n); } h += aRow(arteIconURL('gold', 0), _t('{n} Gold', { n: fmt(e.n) }), '#e8b04a', drop ? _t('liegt vor dir') : ''); break;
        case 'mat': if (!MATS[e.k]) break; if (drop) dropMat(dx(), dy(), e.k, e.n); else gainMat(e.k, e.n); h += aRow(iconURL(['mat', e.k]), MATS[e.k].n + ' ×' + e.n, MATS[e.k].c, drop ? _t('liegt vor dir') : ''); break;
        case 'gem': { const [id, gr] = String(e.k).split(':'); if (!GEMS[id]) break; if (drop) dropGem(dx(), dy(), e.k); else P.gems[e.k] = (P.gems[e.k] || 0) + 1; h += aRow(iconURL(['gem', id, +gr || 0]), _t('{grade} {gem}', { grade: GEMGRADE[+gr || 0], gem: GEMS[id].n }), GEMS[id].c, drop ? _t('liegt vor dir') : ''); break; }
        case 'egg': { let g = null; try { if (typeof eggGive === 'function') g = eggGive(null, true, { luck: clamp(e.luck || 1, 0, 10) }); } catch (_) { g = null; } if (g) { const T_ = typeof PET_TIERS !== 'undefined' && PET_TIERS[g.tier]; let ic = arteIconURL('ei', 4); try { if (typeof petIconURL === 'function') ic = petIconURL({ egg: 1, sp: g.sp }) || ic; } catch (_) { } h += aRow(ic, T_ ? T_.egg : _t('Begleiter-Ei'), T_ ? T_.c : '#ffd24a', _t('Im Brutnest')); } else { const n = Math.round(150 + aStage() * 20); P.gold += n; h += aRow(arteIconURL('ei', 1), _t('Begleiter-Ei'), '#a8997e', _t('Brutnest voll: für {n} Gold verkauft', { n: fmt(n) })); } break; }
        case 'mod': { if (typeof modRoll !== 'function' || typeof modGive !== 'function') { const n = Math.round(80 + aStage() * 12); P.gold += n; h += aRow(arteIconURL('gold', 0), _t('{n} Gold', { n: fmt(n) }), '#e8b04a', ''); break; } const k = modRoll(clamp(e.dep || 0, 0, 1), e.luck || 1 + (e.dep || 0) * 4); if (!k) break; modGive(k, 1); let nm = String(k), ic = arteIconURL('mod', 3); try { if (typeof modName === 'function') nm = modName(k) || nm; if (typeof modIconURL === 'function') ic = modIconURL(k) || ic; } catch (_) { } h += aRow(ic, nm, '#b892f4', _t('Mod')); break; }
        case 'fate': if (e.n > 0) { gainFate(e.n); h += aRow(arteIconURL('fate', 0), e.n > 1 ? _t('{n} Glücksmünzen', { n: e.n }) : _t('1 Glücksmünze'), '#ffd24a', ''); } break;
        case 'xp': if (e.n > 0) { gainXP(e.n); h += aRow(arteIconURL('ep', 0), _t('+{n} EP', { n: fmt(Math.round(e.n * (1 + mod('xp')))) }), '#57a7d6', ''); } break;
        case 'pot': { const n = Math.min(e.n, potMax() - P.potions); if (n > 0) { P.potions += n; h += aRow(arteIconURL('trank', 0), n > 1 ? _t('{n} Heiltränke', { n }) : _t('1 Heiltrank'), '#c8463c', ''); } break; }
        case 'tool': { const t = aToolPick(e.dep || 0); if (t) { let ok = false; try { ok = landeToolGive(t.k) !== false; } catch (_) { } if (ok) { h += aRow(t.icon || arteIconURL('werkzeug', 4), String(t.n || t.name || t.k), '#ffd24a', _t('Wegwerkzeug für immer: öffnet neue Wege')); break; } } const n = Math.round(200 + aStage() * 25); P.gold += n; h += aRow(arteIconURL('gold', 0), _t('{n} Gold', { n: fmt(n) }), '#e8b04a', ''); break; }
      }
    } catch (err) { console.error('Artefakte (Belohnung):', err); }
  }
  if (P && SAVE.active >= 0) saveChar(); persist();
  return h;
}

/* ---------- Bildschirme: Rückweg ---------- */
let ARB = 'none';   // wohin „Weiter“ führt: play, chron, map, lib, pause, title, ch:<Spur>, none
function aPauseGame() { if (state === 'play' || state === 'pause') { setState('menu'); showHud(false); } }
function aBack(to) {
  to = to || ARB;
  if (typeof to === 'function') { to(); return; }
  if (to === 'play') { hideOverlay(); if (G && G.type) { setState('play'); showHud(true); } return; }
  if (to === 'chron') { arteChronik(); return; }
  if (to === 'map' && P) { showMapMore(); return; }
  if (to === 'lib') { openStation('bibliothek'); return; }
  if (to === 'pause' && G && G.type) { setState('play'); showPause(); return; }
  if (to === 'title') { showTitle(); return; }
  if (typeof to === 'string' && to.startsWith('ch:')) { aChainScreen(+to.slice(3)); return; }
  hideOverlay(); if (G && G.type && state === 'menu') { setState('play'); showHud(true); }
}
const ABAND = [[.01, _t('Nahe dem Weltentor')], [.05, _t('Grenzland')], [.15, _t('Wildnis')], [.3, _t('Ferne Lande')], [.5, _t('Tiefe Lande')], [.75, _t('Uralte Lande')], [2, _t('Rand der Welt')]];
function aBand(dep) { for (const [d, n] of ABAND) if (dep < d) return n; return ABAND[ABAND.length - 1][1]; }
function aPips(c, cur) {
  const C = aChain(c), B = aBits(); let h = '';
  for (let i = 0; i < C.L; i++) h += `<i class="${B.f[C.off + i] ? 'on' : ''}${C.off + i === cur ? ' cur' : ''}"></i>`;
  return h + `<b class="${B.t[c] ? 'on' : B.cnt[c] >= C.L ? 'rdy' : ''}" title="${_t('Schatz')}"></b>`;
}
// Die Spur zum nächsten Ort: Kompass, Hinweis, Gebiet, Region, Entfernung von dir
function aSpurHTML(d) {
  const C = aChain(d.chain), B = aBits(), nx = C.sites[d.idx + 1], s = C.sites[d.idx], here = aHere(), from = here || s;
  const dx = nx.x - from.x, dy = nx.y - from.y, deg = Math.round(Math.atan2(dy, dx) * 180 / Math.PI), T = aTerrain(nx.cx, nx.cy), kv = [];
  let state_ = '';
  if (d.last) {
    if (B.t[d.chain]) state_ = _t('Diesen Schatz hast du schon geborgen.');
    else if (B.cnt[d.chain] >= C.L) { state_ = _t('Das Siegel ist gebrochen – der Schatz wartet auf dich!'); kv.push(_t('Goldener Kreis auf der Karte')); }
    else state_ = _t('Noch {n} Teile fehlen, dann bricht das Siegel.', { n: C.L - B.cnt[d.chain] });
  } else if (B.f[nx.id]) state_ = _t('Das nächste Teil dieser Spur hast du schon gefunden.');
  else { state_ = _t('Ein Suchkreis für das nächste Teil ist jetzt auf deiner Karte.'); kv.push(_t('{r} · etwa {n} Schritte vom Fundort', { r: ADIR[d.dir], n: aNum(d.steps) })); }
  if (T.b) kv.push(_t('Gebiet: {n}', { n: T.b })); if (T.r) kv.push(_t('Region: {n}', { n: T.r })); if (T.l) kv.push(_t('Wahrzeichen: {n}', { n: T.l }));
  if (here) kv.push(_t('{n} Schritte von dir, Richtung {r}', { n: aNum(aSteps(Math.hypot(dx, dy))), r: ADIR[aDirIdx(dx, dy)] }));
  return `<div class="arclue${d.last ? ' last' : ''}"><div class="arcomp"><img src="${arteIconURL('pfeil', 0)}" alt="" style="transform:rotate(${deg}deg)"></div><div><b class="arsp">${d.last ? _t('DER SCHATZ') : _t('DIE SPUR')}</b>${state_ ? `<p>${esc(state_)}</p>` : ''}${kv.length ? `<div class="arkv">${kv.map(x => `<span>${esc(x)}</span>`).join('')}</div>` : ''}</div></div>`;
}
/* ---------- Lesebildschirm (Pergament) ---------- */
function arteRead(id, back, o) {
  const d = arteDef(id), B = aBits(); if (!d || !B) return false; o = o || {};
  ARB = back != null ? back : state === 'play' ? 'play' : 'none'; aPauseGame();
  const C = aChain(d.chain), M = aLocal(), P_ = d.parts, done = B.cnt[d.chain] >= C.L, opened = !!B.t[d.chain], known = !!B.f[id];
  const top = (o.fresh ? `<div class="arnew">${_t('NEUES ARTEFAKT')} · ${_t('{n} von {m}', { n: aNum(arteFound()), m: aNum(ARTE_N) })}</div>` : '')
    + (o.ms || []).map(([n, g]) => `<div class="arms">${_t('Meilenstein: {n} Artefakte gefunden! +{g} Glücksmünzen', { n, g })}</div>`).join('')
    + (o.fresh && done && !opened ? `<div class="arms">${_t('Alle {n} Teile gefunden – das Siegel des Schatzes ist gebrochen!', { n: C.L })}</div>` : '');
  const seal = d.kind === 'brief' || d.kind === 'rolle' ? '<i class="arseal"></i>' : '';
  showOverlay(`<div class="head"><h2>${esc(d.kindName.toLocaleUpperCase(LOCALE))}</h2><div class="hbtns"><span class="pill dim">${_t('FUND {n}/{m}', { n: d.idx + 1, m: d.n })}</span></div></div>${top}
  <div class="arw"><div class="arside"><div class="aric"><img src="${d.icon}" alt=""></div><div class="armeta"><div class="arnm">${esc(d.name)}</div><div class="arch">„${esc(d.title)}“</div><div class="arpips">${aPips(d.chain, id)}</div></div></div>
  <div class="arp${d.w ? ' w' : ''}${known ? '' : ' unk'}">${P_.fund ? `<p class="arfund">${esc(P_.fund)}</p>` : ''}<p class="arframe">${esc(P_.frame)}</p><p class="arbody">${esc(d.w ? P_.body : '„' + P_.body + '“')}</p><p class="arhint${d.w ? '' : ' v'}">${esc(P_.clue)}</p>${P_.sig ? `<p class="arsig">${esc(P_.sig)}</p>` : ''}${seal}</div>${aSpurHTML(d)}</div>
  <div class="menu foot arfoot"><button class="btn wide" data-act="arte_back">${_t('Weiter')}</button><button class="btn alt" data-act="arte_chain" data-i="${d.chain}">${_t('Zur Spur')}</button>${M.tr !== d.chain ? `<button class="btn alt" data-act="arte_track" data-i="${d.chain}">${_t('Verfolgen')}</button>` : ''}</div>`, true);
  sfx('page');
  return true;
}
/* ---------- Schatz: versiegelt, Wächter, geborgen ---------- */
function aCanFight() { return !!(G && G.type && P && (state === 'play' || state === 'menu') && typeof spawnEnemy === 'function'); }
function aSealed(c, back) {
  ARB = back != null ? back : state === 'play' ? 'play' : 'none'; aPauseGame();
  const C = aChain(c), B = aBits(), M = aLocal(), have = B.cnt[c];
  const msg = have ? _t('Dir fehlen noch {n} von {m} Teilen dieser Geschichte.', { n: C.L - have, m: C.L }) : _t('Du kennst noch kein einziges Teil dieser Geschichte. Irgendwo in der Nähe beginnt sie.');
  showOverlay(`<div class="center artr"><div class="artrc seal"><img src="${arteIconURL('siegel', 0)}" alt=""></div><h2>${_t('VERSIEGELTER SCHATZ')}</h2><p class="arch">„${esc(C.title)}“</p>
  <p class="sub">${esc(_t('Ein uraltes Siegel hält diese Truhe verschlossen. Erst wer alle {m} Teile der Geschichte kennt, kann es brechen.', { m: C.L }))} ${esc(msg)}</p><div class="arpips" style="justify-content:center">${aPips(c, -1)}</div></div>
  <div class="menu foot arfoot"><button class="btn wide" data-act="arte_back">${_t('Weiter')}</button>${M.tr !== c ? `<button class="btn alt" data-act="arte_track" data-i="${c}">${_t('Spur verfolgen')}</button>` : `<button class="btn alt" data-act="arte_chain" data-i="${c}">${_t('Zur Spur')}</button>`}</div>`);
  sfx('deny');
}
// Wächter: ein Boss aus js/bosses.js (falls da), sonst ein Ungeheuer der Kampagne
const ATAG = { v: null };   // markiert Gegner, die während eines Aufrufs erscheinen (HOOK.spawn)
function aBossFallback(dep, x, y, name) {
  const B = BOSSES[clamp(Math.floor(dep * 7 + Math.random() * 2), 0, BOSSES.length - 1)];
  const e = aSpawn(EN[B.type] ? B.type : 'ogre', { x, y, boss: true, sc: B.sc * .8, hpMul: B.hpMul * .55, name, tint: B.tint, instant: false });
  if (e) { $('bossName').textContent = name.toLocaleUpperCase(LOCALE); $('bossbar').hidden = false; }
  return e;
}
function aSpawn(type, o) {
  if (!G || !G.type || !EN[type] || typeof spawnEnemy !== 'function') return null;
  o = Object.assign({ instant: false }, o || {}); o.x = clamp(o.x != null ? o.x : P.x + 40, BD.x0 + 10, BD.x1 - 10); o.y = clamp(o.y != null ? o.y : P.y, BD.y0 + 10, BD.y1 - 10);
  const e = spawnEnemy(type, o);
  // Freiwelt: feste Gefahrenstufen – die Qual-Verstärkung der Kampagne gilt dort nicht (wie in js/lande.js)
  if (e && typeof landeActive === 'function' && landeActive() && typeof qualOf === 'function') { const q = Math.pow(1.3, qualOf(P.act)); if (q > 1) { e.hp = e.maxHp = Math.max(1, Math.round(e.maxHp / q)); e.atk /= Math.pow(q, .8); } }
  return e;
}
function aGuard(c) {
  const C = aChain(c), s = C.sites[C.L], x = P.x + 70, y = P.y - 30, name = aFill(_t('Hüter von {schatz}'), C.V);
  hideOverlay(); setState('play'); showHud(true);
  ATAG.v = { guard: c }; let ok = false;
  try {
    if (typeof bossForLair === 'function' && typeof bossSpawn === 'function') {
      const ctx = { cx: s.cx, cy: s.cy, depth: C.dep, stage: aStageAt(C.dep), biome: '', region: 0, R: mulberry(aH(10, c)) };
      try { if (typeof landeCtx === 'function') Object.assign(ctx, landeCtx(s.cx, s.cy) || {}); } catch (_) { }
      const id = bossForLair('arte' + c, ctx), n0 = enemies.length; if (id != null) { bossSpawn(id, x, y, { arte: c }); ok = enemies.slice(n0).some(e => e.arteGuard === c); }
    }
  } catch (e) { console.error('Artefakte (Wächter):', e); }
  if (!ok) aBossFallback(C.dep, x, y, name);
  ATAG.v = null;
  banner(_t('DER WÄCHTER ERWACHT'), _t('Besiege ihn – dann gehört der Schatz dir.')); sfx('boom'); shake(6);
}
function aTreasureLoot(c) {
  const C = aChain(c), rw = C.rw, dep = C.dep, st = aStageAt(dep), Cl = CLASSES[P.cls], slot = ['weapon', 'armor', 'helm'][rw.slot];
  const tier = clamp(Math.floor((st - 1) / 6) + 1, 0, TIERS - 1); let it;
  if (dep > .25 && Math.random() < .06 + dep * .1) { const ks = Object.keys(MYTHIC).filter(k => MYTHIC[k].slot === slot); it = makeMythic(ks.length ? slot : undefined); }
  else { it = makeItem({ slot, base: slot === 'weapon' ? Cl.weapons[rw.base % Cl.weapons.length] : slot, tier, rar: dep < .02 && aH(11, c) % 3 ? 3 : 4 }); it.name = C.V.schatz; }
  it.arte = c;
  const list = [{ t: 'item', it }, { t: 'gold', n: Math.round((40 + st * 14) * (2 + C.L * .5)) }, { t: 'fate', n: rw.fate }, { t: 'xp', n: Math.round((60 + st * 30) * (1 + C.L * .25)) }];
  if (rw.egg) list.push({ t: 'egg', luck: 1 + dep * 8 });
  if (rw.mod) { if (typeof modRoll === 'function' && typeof modGive === 'function') list.push({ t: 'mod', dep, luck: 2 + dep * 6 }); else list[1].n += Math.round(80 + st * 12); }
  if (rw.tool) { if (aToolPick(dep)) list.push({ t: 'tool', dep }); else list[1].n += Math.round(200 + st * 25); }
  return aGiveAll(list);
}
function arteTreasureOpen(c, o) {
  o = o || {};
  try {
    if (c && typeof c === 'object') c = c.chain; if (typeof c === 'string' && c[0] === 'T') c = c.slice(1);
    c = Math.floor(+c); if (!(c >= 0 && c < ARTE_NC) || !P) return false;
    const C = aChain(c), M = aLocal(); if (!M) return false;
    if (aOpened(c)) { toast(_t('Die Truhe ist leer – diesen Schatz hast du schon geborgen.'), '#a8997e'); return false; }
    if (!aDone(c)) { aSealed(c, o.back); return false; }
    if (C.rw.guard && !M.g.includes(c) && !o.noGuard && aCanFight()) { aGuard(c); return 'guard'; }
    aSetBit('t', c); if (M.tr === c) M.tr = -1; stat('arteSchatz');
    const rows = aTreasureLoot(c); computeStats();
    ARB = o.back != null ? o.back : G && G.type ? 'play' : 'none'; aPauseGame();
    showOverlay(`<div class="center artr"><div class="artrc"><img src="${arteIconURL('truhe', 0)}" alt=""></div><h2>${_t('SCHATZ GEBORGEN!')}</h2><p class="arch">„${esc(C.title)}“</p>
    <p class="sub">${esc(aFill(_t('Das Siegel bricht. In der Truhe liegt, was {ich} vor langer Zeit versteckt hat: {schatz}.'), C.V))}</p></div>
    <h3>${_t('DEIN FUND')}</h3>${rows}<p class="sub">${_t('Der Schatz ist sicher: Ein Rabe der Bibliothek trägt alles heim ins Versteck.')}</p>
    <p class="sub" style="color:var(--rune)">${_t('Archivar Ulmo zahlt dir für die vollständige Abschrift dieser Geschichte noch eine Belohnung – in der Chronik.')}</p>
    <div class="menu foot arfoot"><button class="btn wide" data-act="arte_back">${_t('Weiter')}</button><button class="btn alt" data-act="arte_chain" data-i="${c}">${_t('Chronik')}</button></div>`);
    sfx('myth'); if (G && G.type) { flash = { a: .35, c: '255,210,120' }; for (let i = 0; i < 26; i++) part(P.x, P.y, rnd(0, 16), rnd(-40, 40), rnd(-20, 20), rnd(40, 110), pick(['#ffd24a', '#fff3c0', '#e8b04a']), rnd(.5, 1), 1, 100, 1); }
    return true;
  } catch (e) { console.error('Artefakte (Schatz öffnen):', e); return false; }
}
// Abschrift für Ulmo: Belohnung, wenn alle Artefakte gefunden und der Schatz geborgen ist
function aClaimGold(c) { const C = aChain(c); return Math.round((50 + aStageAt(C.dep) * 8) * C.L); }
function arteClaim(c) {
  if (!aDone(c) || !aOpened(c) || aClaimed(c) || !P) return false;
  const g = aClaimGold(c), f = 1 + (aChain(c).dep > .2 ? 1 : 0); aSetBit('c', c); P.gold += g; gainFate(f); computeStats(); saveChar(); persist();
  sfx('loot'); toast(_t('Ulmo dankt dir: +{g} Gold, +{f} Glücksmünzen', { g: fmt(g), f }), '#ffd24a'); return true;
}
function aBonus() { return Math.min(.25, aComplete() * .0025); }

/* ---------- Chronik der Artefakte ---------- */
const ACU = { from: 'none', tab: 'spuren', more: 30 };
function aChainState(c) {
  const B = aBits(), C = aChain(c), done = B.cnt[c] >= C.L;
  if (done && B.t[c] && !B.c[c]) return [0, _t('Abschrift abgeben!'), '#ffd24a'];
  if (done && !B.t[c]) return [1, _t('Siegel gebrochen – Schatz wartet!'), '#ffb03a'];
  if (!done) return [2, _t('{n} von {m} gefunden', { n: B.cnt[c], m: C.L }), '#e8dcc0'];
  return [3, _t('Vollendet'), '#79c24e'];
}
function arteChronik(from, tab) {
  const B = aBits(), M = aLocal(); if (!B) return false;
  if (from != null) ACU.from = from; if (tab) ACU.tab = tab;
  aPauseGame();
  const t_ = (k, l) => `<button class="tab" role="tab" aria-selected="${ACU.tab === k}" data-act="arte_ctab" data-id="${k}">${l}</button>`;
  const encN = Object.keys(ENCD).filter(k => M.enc[k]).length;
  let body = `<div class="tabs" role="tablist">${t_('spuren', _t('SPUREN'))}${t_('begegnung', _t('BEGEGNUNGEN {n}/{m}', { n: encN, m: Object.keys(ENCD).length }))}${t_('geruecht', _t('GERÜCHTE'))}</div>`;
  if (ACU.tab === 'begegnung') body += aChronEnc();
  else if (ACU.tab === 'geruecht') body += aChronRumor();
  else body += aChronTrails();
  showOverlay(`<div class="head"><h2>${_t('CHRONIK DER ARTEFAKTE')}</h2><div class="hbtns"><span class="pill" style="background:var(--gold)">${aNum(B.n)} / ${aNum(ARTE_N)}</span><button class="btn alt sm" data-act="arte_cback">${_t('Zurück')}</button></div></div>${body}`, true);
  return true;
}
function aChronTrails() {
  const B = aBits(), M = aLocal(), st = aStarted(), comp = aComplete(), bon = aBonus(), next = AMS[M.ms];
  let h = `<div class="arsum"><div class="arbar"><i style="width:${(100 * B.n / ARTE_N).toFixed(2)}%"></i></div>
  <div class="arkv"><span>${_t('Vollendet: {n}', { n: comp })}</span><span>${_t('Begonnen: {n}', { n: st.length - comp })}</span><span>${_t('Unentdeckt: {n}', { n: aNum(ARTE_NC - st.length) })}</span></div>
  <p class="arsm">${bon > 0 ? _t('Wissen der Chronik: +{n} % Erfahrung und Gold', { n: (bon * 100).toFixed(2).replace(/\.?0+$/, '') }) : _t('Jede vollendete Spur schenkt dir für immer +0,25 % Erfahrung und Gold (bis +25 %).')}${next ? ' · ' + _t('Nächster Meilenstein: {n} Artefakte', { n: aNum(next) }) : ''}</p></div>`;
  if (!st.length) return h + `<div class="arempty"><img src="${arteIconURL('tagebuch', 0)}" alt=""><p>${_t('Noch hast du keine Spur entdeckt. Artefakte liegen überall in den Endlosen Landen – an stillen Orten, und manchmal tragen Monster sie bei sich.')}</p><button class="btn" data-act="arte_ctab" data-id="geruecht">${_t('Gerüchte anhören')}</button></div>`;
  const list = st.map(c => [c, aChainState(c)]).sort((a, b) => (a[0] === M.tr ? -1 : 0) - (b[0] === M.tr ? -1 : 0) || a[1][0] - b[1][0] || (B.cnt[b[0]] / ALAY.ch[b[0]].L) - (B.cnt[a[0]] / ALAY.ch[a[0]].L) || a[0] - b[0]);
  h += list.slice(0, ACU.more).map(([c, S]) => { const C = aChain(c), f = C.sites.find(s => !s.t && B.f[s.id]), ic = f ? arteDef(f.id).icon : arteIconURL('tagebuch', 0); return `<button class="row archr${M.tr === c ? ' sel' : ''}" data-act="arte_chain" data-i="${c}"><div class="ic"><img src="${ic}" alt=""></div><div><div class="nm">${esc(C.title)}</div><div class="st" style="color:${S[2]}">${M.tr === c ? '◆ ' : ''}${esc(S[1])} · ${esc(aBand(C.dep))}</div><div class="arpips">${aPips(c, -1)}</div></div><span></span></button>`; }).join('');
  if (list.length > ACU.more) h += `<button class="btn alt" data-act="arte_more" style="width:100%">${_t('Mehr zeigen ({n})', { n: list.length - ACU.more })}</button>`;
  return h;
}
function aRumors(n) { const out = [], skip = []; for (let k = 0; k < n; k++) { const r = arteRumor(NaN, NaN, skip); if (!r) break; skip.push(r.chain); out.push(r); } return out; }
function aChronRumor() {
  const M = aLocal(), B = aBits();
  let h = `<p class="sub">${_t('Wanderer, Händler und alte Tafeln erzählen von Geschichten, die noch niemand zu Ende gelesen hat. Verfolge ein Gerücht – ein großer Suchkreis erscheint auf der Karte.')}</p>`;
  const extra = M.ru.filter(c => !B.cnt[c]).map(c => ({ chain: c, hint: _t('Ein Gerücht aus einer Begegnung – der große Kreis auf der Karte zeigt, wo die Spur beginnt.') }));
  for (const r of extra.concat(aRumors(4)).filter((r, i, a) => a.findIndex(x => x.chain === r.chain) === i).slice(0, 6)) {
    const C = aChain(r.chain), on = M.tr === r.chain;
    h += `<div class="arrum${on ? ' on' : ''}"><img src="${arteIconURL(C.kinds[0], C.col[0])}" alt=""><div><b>${esc(C.title)}</b><p>${esc(r.hint)}</p><small>${esc(aBand(C.dep))}</small></div>${on ? `<span class="pill">${_t('VERFOLGT')}</span>` : `<button class="btn sm" data-act="arte_track" data-i="${r.chain}">${_t('Verfolgen')}</button>`}</div>`;
  }
  return h;
}
function aChronEnc() {
  const M = aLocal();
  return `<p class="sub">${_t('Mystische Begegnungen sind selten. Jede trifft man in den Endlosen Landen – manche nur an bestimmten Orten.')}</p><div class="arenc">` + Object.keys(ENCD).map(k => { const D = ENCD[k], n = M.enc[k] || 0; return `<div class="arec${n ? '' : ' unk'}" style="--c:${D.c}"><img src="${encPicURL(k)}" alt=""><b>${n ? esc(D.n) : '???'}</b><small>${n ? esc(_t('{n}× begegnet', { n })) + ' · ' : ''}${esc(D.hint)}</small></div>`; }).join('') + '</div>';
}
function aChainScreen(c) {
  const B = aBits(), M = aLocal(); if (!B || !(c >= 0 && c < ARTE_NC)) return;
  aPauseGame();
  const C = aChain(c), S = aChainState(c), rw = C.rw, gate = aSteps(C.D * ACK);
  let rows = '';
  for (let i = 0; i < C.L; i++) {
    const id = C.off + i;
    if (B.f[id]) { const d = arteDef(id); rows += `<button class="row" data-act="arte_read" data-i="${id}"><div class="ic"><img src="${d.icon}" alt=""></div><div><div class="nm">${i + 1}. ${esc(d.name)}</div><div class="st">${esc(d.parts.body.slice(0, 80))}${d.parts.body.length > 80 ? '…' : ''}</div></div><span></span></button>`; }
    else rows += `<div class="row arunk" style="cursor:default"><div class="ic"><img src="${arteIconURL(C.kinds[i], C.col[i])}" alt=""></div><div><div class="nm">${i + 1}. ???</div><div class="st">${i && B.f[id - 1] ? _t('Suchkreis auf der Karte – lies den Hinweis davor') : i ? _t('Noch verborgen') : _t('Der Anfang der Spur – großer Kreis auf der Karte')}</div></div><span></span></div>`;
  }
  const rew = [_t('Einzigartiger Gegenstand'), _t('Gold'), rw.fate > 1 ? _t('{n} Glücksmünzen', { n: rw.fate }) : _t('1 Glücksmünze')];
  if (rw.egg) rew.push(_t('Begleiter-Ei')); if (rw.mod) rew.push(_t('Mod')); if (rw.tool) rew.push(_t('Wegwerkzeug')); if (rw.guard) rew.push(_t('Wächter!'));
  const tr = B.t[c] ? _t('Geborgen') : B.cnt[c] >= C.L ? _t('Siegel gebrochen – der goldene Kreis auf der Karte zeigt den Weg') : _t('Versiegelt, bis alle {n} Teile gefunden sind', { n: C.L });
  const claim = B.cnt[c] >= C.L && B.t[c] && !B.c[c] ? `<button class="btn" data-act="arte_claim" data-i="${c}" style="width:100%;margin:6px 0">${_t('Abschrift an Ulmo geben: +{g} Gold, +{f} Glücksmünzen', { g: fmt(aClaimGold(c)), f: 1 + (C.dep > .2 ? 1 : 0) })}</button>` : B.c[c] ? `<p class="sub" style="color:var(--moss)">${_t('Ulmo hat deine Abschrift in die Bibliothek gestellt.')}</p>` : '';
  showOverlay(`<div class="head"><h2>${esc(C.title.toLocaleUpperCase(LOCALE))}</h2><div class="hbtns"><button class="btn alt sm" data-act="arte_chron">${_t('Zurück')}</button></div></div>
  <div class="arsum"><p style="color:${S[2]}">${esc(S[1])}</p><p class="arsm">${esc(aBand(C.dep))} · ${_t('etwa {n} Schritte vom Weltentor', { n: aNum(gate) })}</p><div class="arpips">${aPips(c, -1)}</div></div>
  ${rows}<div class="row artrr" style="cursor:default"><div class="ic"><img src="${arteIconURL(B.t[c] ? 'truhe' : 'siegel', 0)}" alt=""></div><div><div class="nm">${_t('Schatz')}</div><div class="st">${esc(tr)}</div><div class="st" style="color:var(--gold)">${esc(rew.join(' · '))}</div></div><span></span></div>${claim}
  <div class="menu foot arfoot"><button class="btn wide" data-act="arte_chron">${_t('Zur Chronik')}</button>${M.tr === c ? `<button class="btn alt" data-act="arte_untrack">${_t('Nicht mehr verfolgen')}</button>` : `<button class="btn alt" data-act="arte_track" data-i="${c}">${_t('Verfolgen')}</button>`}</div>`, true);
}
ON.arte_back = () => { sfx('click'); aBack(); };
ON.arte_chron = id => { sfx('click'); arteChronik(id && id !== 'undefined' ? id : null); };
ON.arte_cback = () => { sfx('click'); aBack(ACU.from); };
ON.arte_ctab = id => { ACU.tab = id; ACU.more = 30; sfx('click'); arteChronik(); };
ON.arte_more = () => { ACU.more += 40; arteChronik(); };
ON.arte_chain = (id, b, i) => { sfx('click'); if (ARB === 'play' || ARB === 'pause' || ARB === 'none') ACU.from = ARB; aChainScreen(i); };
ON.arte_read = (id, b, i) => { const d = arteDef(i); if (d) arteRead(i, 'ch:' + d.chain); };
ON.arte_track = (id, b, i) => {
  const M = aLocal(); if (!M || !(i >= 0 && i < ARTE_NC)) return; M.tr = i; persist(); sfx('ach');
  toast(aBits().cnt[i] ? _t('Du verfolgst jetzt „{t}“ – ihr Kreis leuchtet golden auf der Karte.', { t: aChain(i).title }) : _t('Gerücht verfolgt: Ein großer Suchkreis für den Anfang der Spur ist auf der Karte.'), '#ffd24a');
  if (!ov.hidden && panel.querySelector('.arw')) { const d = panel.querySelector('[data-act="arte_track"]'); if (d) d.remove(); } else if (!ov.hidden && panel.querySelector('.artr')) { /* versiegelt: bleibt offen */ } else if (ACU.tab === 'geruecht' && panel.querySelector('.arrum')) arteChronik(); else aChainScreen(i);
};
ON.arte_untrack = () => { const M = aLocal(), c = M.tr; M.tr = -1; persist(); sfx('click'); if (c >= 0) aChainScreen(c); };
ON.arte_claim = (id, b, i) => { if (arteClaim(i)) aChainScreen(i); else sfx('deny'); };

/* =========================================================
   Mystische Begegnungen: selten, mit Bild, Wahl und Folgen
   ========================================================= */
// Segen und Flüche auf Zeit (laufen nur, solange gespielt wird; verfallen beim Verlassen der Lande)
const AFX = [];
function aFx(k, v, sec, n, bad) { const f = AFX.find(x => x.k === k && x.n === n); if (f) { f.t = Math.max(f.t, sec); f.v = v; } else AFX.push({ k, v, t: sec, max: sec, n, bad: !!bad }); if (P && P.gear) { computeStats(); P.hp = Math.min(P.hp, P.st.hp); } }
function aFxClear() { if (!AFX.length) return; AFX.length = 0; if (P && P.gear) computeStats(); }
// Rätsel (Geist, Sphinx): Frage, richtige Antwort, zwei falsche
const ARID = [
  [_t('Ich habe Städte, aber keine Häuser, Wälder, aber keine Bäume, Wasser, aber keine Fische. Was bin ich?'), _t('Eine Karte'), _t('Ein Traum'), _t('Ein Spiegel')],
  [_t('Je mehr man davon wegnimmt, desto größer wird es. Was ist es?'), _t('Ein Loch'), _t('Ein Schatten'), _t('Ein Berg')],
  [_t('Es hat ein Bett und schläft nie, es hat einen Mund und spricht nie. Was ist es?'), _t('Ein Fluss'), _t('Ein Brunnen'), _t('Ein Grab')],
  [_t('Was gehört dir, wird aber von anderen viel öfter benutzt als von dir?'), _t('Dein Name'), _t('Dein Schwert'), _t('Dein Gold')],
  [_t('Ich bin leichter als eine Feder, doch selbst der Stärkste kann mich nicht lange halten. Was bin ich?'), _t('Der Atem'), _t('Ein Gedanke'), _t('Ein Schatten')],
  [_t('Was kann man brechen, ohne es je zu berühren?'), _t('Ein Versprechen'), _t('Einen Spiegel'), _t('Eine Klinge')],
  [_t('Ich komme nachts, ohne gerufen zu werden, und verschwinde am Tag, ohne gestohlen zu werden. Was bin ich?'), _t('Die Sterne'), _t('Die Eulen'), _t('Die Kälte')],
  [_t('Was wird nasser, je mehr es trocknet?'), _t('Ein Handtuch'), _t('Ein Fluss'), _t('Ein Brot')],
  [_t('Ich habe Zähne, doch ich beiße nie. Was bin ich?'), _t('Ein Kamm'), _t('Ein Wolf'), _t('Ein Drache')],
  [_t('Was steigt immer, aber kommt nie wieder herunter?'), _t('Das Alter'), _t('Ein Vogel'), _t('Ein Stein')],
  [_t('Ich spreche ohne Mund und höre ohne Ohren. Der Wind erweckt mich. Was bin ich?'), _t('Ein Echo'), _t('Ein Geist'), _t('Ein Lied')],
  [_t('Wer mich macht, verkauft mich. Wer mich kauft, braucht mich nicht. Wer mich braucht, weiß es nicht. Was bin ich?'), _t('Ein Sarg'), _t('Ein Schwert'), _t('Ein Trank')],
  [_t('Was hat einen Hals, aber keinen Kopf?'), _t('Eine Flasche'), _t('Ein Schwan'), _t('Ein Turm')],
  [_t('Je mehr davon da ist, desto weniger siehst du. Was ist es?'), _t('Die Dunkelheit'), _t('Das Gold'), _t('Das Licht')]
];
const ENCD = {};
const AMIRROR = 'Spiegelzorn'; _t('Spiegelzorn');   // Name bleibt deutsch im Spielstand, itemName() übersetzt ihn
function eDef(k, o) { o.k = k; ENCD[k] = o; }
const eGold = (E, k) => Math.max(5, Math.round((25 + E.st * 9) * k));
function eItem(E, min, up) { return { t: 'item', it: randomItem(Math.max(1, E.st + (up || 0)), min || 0) }; }
function eMat(E, hi) { const a = MONMATS.slice(0, clamp(5 + Math.floor(E.st / 5) + (hi ? 2 : 0), 5, MONMATS.length)); return a[Math.max(0, a.length - 1 - Math.floor(Math.random() * Math.random() * a.length))]; }
function eFx(E, k, v, sec, n, bad) { aFx(k, v, sec, n, bad); E.fx.push({ n, bad: !!bad, sec }); }
const eLater = (E, fn) => E.after.push(fn);
function eHurt(pct) { P.hp = Math.max(1, Math.round(P.hp - P.st.hp * pct)); }
function eRing(types, o, grp) {
  if (!aCanFight()) return 0; let n = 0; ATAG.v = grp ? { grp } : null;
  try { types.forEach((t, i) => { const a = i / types.length * 6.283 + Math.random() * .4, d = 46 + Math.random() * 26; if (aSpawn(t, Object.assign({ x: P.x + Math.cos(a) * d, y: P.y + Math.sin(a) * d * .7 }, o || {}))) n++; }); } finally { ATAG.v = null; }
  return n;
}
// Gegnergruppe: wenn alle besiegt sind, fällt die Belohnung (Freiwelt: Beute am Boden → Rucksack)
function eFight(E, types, o, reward, msg) {
  eLater(E, () => {
    const grp = { n: 0, done: e => { const list = reward(); for (const r of list) { if (r.t === 'item') dropItem(e.x, e.y, r.it); else if (r.t === 'gold') dropCoins(e.x, e.y, r.n, true); else if (r.t === 'mat') dropMat(e.x, e.y, r.k, r.n); else if (r.t === 'gem') dropGem(e.x, e.y, r.k); else aGiveAll([r]); } banner(_t('GESCHAFFT'), msg || _t('Die Belohnung liegt bereit.')); sfx('clear'); } };
    if (!eRing(types, o, grp)) { const list = reward(); aGiveAll(list); }
  });
}
function eBoss(E, name, reward) {
  eLater(E, () => {
    if (!aCanFight()) return; const x = P.x + 64, y = P.y - 24; let ok = false;
    const grp = { n: 0, done: e => { const list = reward(); for (const r of list) { if (r.t === 'item') dropItem(e.x, e.y, r.it); else if (r.t === 'gold') dropCoins(e.x, e.y, r.n, true); else aGiveAll([r]); } banner(_t('BEZWUNGEN'), name); sfx('clear'); } };
    ATAG.v = { grp };
    try { if (typeof bossForLair === 'function' && typeof bossSpawn === 'function') { const id = bossForLair('enc' + E.k + Math.floor(E.dep * 1000), { cx: 0, cy: 0, depth: E.dep, stage: E.st, biome: '', region: 0, R: mulberry(aH(30, E.dep * 1e4)) }), n0 = enemies.length; if (id != null) { bossSpawn(id, x, y, {}); ok = enemies.length > n0; } } } catch (_) { }
    if (!ok) aBossFallback(E.dep, x, y, name);
    ATAG.v = null; shake(5); sfx('boom');
  });
}
function eTele(E) {
  eLater(E, () => {
    // Ziel: 2–5 Chunks von dir entfernt (Welt-px); ohne Position der Welt vom Ort der Begegnung aus
    const t = E.enc && E.enc.teleport, a = Math.random() * 6.283, d = (2 + Math.random() * 3) * ACK, h = aHere() || (isFinite(E.enc && E.enc.x) ? { x: E.enc.x, y: E.enc.y } : null);
    if (typeof t === 'function' && h) { try { const r = Math.hypot(h.x / ACK - AGATE, h.y / ACK - AGATE), out = r > AWR - 8 ? -1 : 1; t(Math.round(h.x + Math.cos(a) * d * out), Math.round(h.y + Math.sin(a) * d * out)); return; } catch (e) { console.error('Begegnung (Teleport):', e); } }
    if (G && G.type && BD) { P.x = clamp(P.x + Math.cos(a) * 180, BD.x0 + 20, BD.x1 - 20); P.y = clamp(P.y + Math.sin(a) * 120, BD.y0 + 20, BD.y1 - 20); P.inv = Math.max(P.inv || 0, 1); fxAnim('ring', P.x, P.y - 6, { sc: .7, dur: .5, add: true }); }
  });
}
// Hinweis aus einer Begegnung: Gerücht über eine Spur oder ein Suchkreis für ein fehlendes Artefakt
function eReveal(E) {
  const B = aBits(), M = aLocal();
  for (const c of aStarted()) { const C = aChain(c); if (B.cnt[c] < C.L && c !== M.tr) { M.tr = c; persist(); return _t('Ein Suchkreis für „{t}“ leuchtet jetzt golden auf deiner Karte.', { t: C.title }); } }
  const r = arteRumor(NaN, NaN, M.ru); if (!r) return _t('Doch alle Geschichten, die es kennt, hast du schon gelesen.');
  aRumorAdd(r.chain); return _t('Neues Gerücht: „{t}“ – ein großer Suchkreis ist auf deiner Karte.', { t: aChain(r.chain).title });
}
function eRiddle(E, done) {
  const used = E.rid || (E.rid = []), pool = ARID.map((_, i) => i).filter(i => !used.includes(i)), q = ARID[pick(pool.length ? pool : [0])]; used.push(ARID.indexOf(q));
  const ans = [[q[1], true], [q[2], false], [q[3], false]].sort(() => Math.random() - .5);
  encShow(E, [q[0]], ans.map(([t, ok]) => ({ t, go: () => done(ok) })));
}

/* ---------- Die Begegnungen ---------- */
eDef('geist', { n: _t('Der Wandernde Geist'), pic: ['sp', 'wizard', 'rgba(170,220,255,.55)'], c: '#9ad8ee', bio: ['ruine', 'schatten', 'kalt', 'x'], hint: _t('Man sagt, er wandert dort, wo es still ist.'),
  intro: () => [_t('Ein bleicher Geist schwebt über dem Weg. Er hat vergessen, wer er war – nur ein Rätsel ist ihm geblieben.'), _t('„Löse es, und ich schenke dir, was ich bei mir trage. Irre dich, und meine Kälte folgt dir.“')],
  ch: E => [{ t: _t('Das Rätsel hören'), go: () => eRiddle(E, ok => ok ? encRes(E, _t('Der Geist lächelt zum ersten Mal seit hundert Jahren und zerfällt zu Licht. Zurück bleibt, was er hütete.'), [eItem(E, 2, 1), { t: 'xp', n: 40 + E.st * 22 }]) : (eFx(E, 'spd', -.15, 120, _t('Geisterkälte'), 1), encRes(E, _t('„Falsch“, haucht der Geist. Eisige Kälte kriecht in deine Glieder.')))) },
    { t: _t('Ihm einen Namen geben'), s: _t('Vielleicht erinnert er sich'), go: () => Math.random() < .5 ? (eFx(E, 'regen', Math.max(1, P.st.hp * .01), 150, _t('Dank des Geistes')), encRes(E, _t('Der Geist wiederholt den Namen leise. Dann nickt er, als hätte er ihn wiedergefunden, und segnet dich.'))) : encRes(E, _t('Der Geist schüttelt den Kopf. „Nein. So hieß ich nicht.“ Er verblasst – ohne Groll.')) },
    { t: _t('Weitergehen'), go: () => encRes(E, _t('Du lässt den Geist allein. Er sieht dir lange nach.')) }] });

eDef('spiegelhexe', { n: _t('Die Spiegelhexe'), pic: ['sp', 'wizf', 'rgba(190,150,250,.38)'], c: '#b892f4', bio: ['schatten', 'kristall', 'sumpf'], hint: _t('Sie zeigt sich nur denen, die Stärke wollen.'),
  intro: () => [_t('Eine Frau mit Augen aus Quecksilber hält dir einen Handspiegel hin. Darin siehst du deine Waffe – schöner, stärker, gefährlicher.'), _t('„Tausch mit mir“, flüstert sie. „Deine Klinge gegen ihr Spiegelbild. Der Preis? Nur ein kleiner Fluch.“')],
  ch: E => { const w = P.gear.weapon; return [
    { t: _t('Waffe tauschen'), s: _t('stärker, aber verflucht: −15 % Leben'), ok: w && !w.myth ? true : _t('Mythische Waffen lassen sich nicht spiegeln'), go: () => { const old = P.gear.weapon, it = makeItem({ slot: 'weapon', base: old.base, tier: clamp(old.tier + 1, 0, TIERS - 1), rar: clamp(Math.max(3, old.rar + 1), 3, 4) }); it.ac = 1; it.name = AMIRROR; P.gear.weapon = it; computeStats(); P.hp = Math.min(P.hp, P.st.hp); updWeaponUI(); encRes(E, _t('Das Glas zerspringt. In deiner Hand liegt Spiegelzorn – kalt, schwer und hungrig. Deine alte Waffe ist fort.'), []); } },
    { t: _t('Den Spiegel zerschlagen'), s: _t('Kampf'), go: () => { eFight(E, ['mage', 'skelmage', 'mage'].slice(0, 2 + (E.dep > .1 ? 1 : 0)), { elite: false, name: _t('Spiegelbild'), tint: 'rgba(200,210,230,.6)' }, () => [{ t: 'gold', n: eGold(E, 3) }, { t: 'gem', k: randomGem(E.st + 4) }], _t('Die Spiegelbilder sind zersprungen.')); eFx(E, 'gold', -.1, 240, _t('Sieben Jahre Pech'), 1); encRes(E, _t('Splitter regnen herab – und aus jedem Splitter steigt ein Spiegelbild der Hexe. Sieben Jahre Pech sind dir sicher. Mindestens.')); } },
    { t: _t('Ablehnen'), go: () => encRes(E, _t('„Wie du willst“, sagt die Hexe und tritt rückwärts in ihren Spiegel. Der Spiegel fällt ins Gras und ist nur noch Glas.')) }]; } });

eDef('sternenfall', { n: _t('Sternenfall'), art: 'meteor', c: '#c8b8ff', bio: ['wiese', 'wueste', 'fels', 'x'], hint: _t('Er fällt, wo der Himmel weit ist.'),
  intro: () => [_t('Ein Heulen zerreißt den Himmel. Ein Stern stürzt herab und schlägt nur einen Steinwurf entfernt ein.'), _t('Im Krater glüht etwas, das summt wie eine Glocke.')],
  ch: E => [{ t: _t('In den Krater steigen'), s: _t('Sternenerz – vielleicht ein Wächter'), go: () => { const list = [{ t: 'mat', k: E.dep > .15 ? 'aether' : 'stern', n: 1 + Math.floor(Math.random() * 2) }, { t: 'mat', k: eMat(E, 1), n: 3 }]; if (Math.random() < .45) { eFight(E, [E.dep > .05 ? 'golem' : 'skeleton'], { elite: true, name: _t('Sternenwächter'), tint: 'rgba(170,150,255,.5)' }, () => [eItem(E, 3, 2)], _t('Der Sternenwächter zerfällt zu glitzerndem Staub.')); encRes(E, _t('Du greifst in die Glut – und aus dem Gestein erhebt sich ein Wächter aus Sternenlicht!'), list); } else encRes(E, _t('Das Gestein ist noch warm. Du brichst so viel Sternenerz heraus, wie du tragen kannst.'), list); } },
    { t: _t('Einen Wunsch an den Stern richten'), go: () => { const r = Math.random(); if (r < .4) { eFx(E, 'dmg', .2, 240, _t('Sternenkraft')); encRes(E, _t('Das Summen wird zu einem Lied, und das Lied fließt in deine Arme. Du fühlst dich stark wie nie.')); } else if (r < .75) { eFx(E, 'loot', .3, 300, _t('Sternenglück')); encRes(E, _t('Ein Funke springt auf dich über. Das Glück wird dich eine Weile begleiten.')); } else encRes(E, _t('Der Stern erlischt. Vielleicht war dein Wunsch zu groß – oder zu klein.')); } },
    { t: _t('Abstand halten'), go: () => encRes(E, _t('Du wartest, bis das Glühen erlischt. Am Kraterrand findest du ein paar abgesprengte Brocken.'), [{ t: 'gold', n: eGold(E, 1) }]) }] });

eDef('zeithaendler', { n: _t('Händler aus einer anderen Zeit'), pic: ['sp', 'doc'], c: '#e8b04a', hint: _t('Er taucht auf, wann er will. Und wo.'),
  intro: () => [_t('Ein Händler mit Schnabelmaske sitzt auf einer Truhe, die es eigentlich noch nicht geben dürfte. Seine Sanduhr läuft rückwärts.'), _t('„Gold aus jeder Zeit nehme ich gern“, sagt er. „Auch das in deiner Truhe daheim.“')],
  ch: E => { const p1 = eGold(E, 9), p2 = eGold(E, 22), p3 = eGold(E, 3); return [
    { t: _t('Kiste aus der Zukunft – {n} Gold', { n: fmt(p1) }), s: _t('Selten oder besser'), ok: P.gold >= p1 ? true : _t('Zu wenig Gold'), go: () => { P.gold -= p1; encRes(E, _t('Die Kiste ist leichter, als sie aussieht. Darin: etwas, das erst in hundert Jahren geschmiedet wird.'), [eItem(E, 2, 3)]); } },
    { t: _t('Relikt der Vorzeit – {n} Gold', { n: fmt(p2) }), s: _t('Legendär, mit etwas Glück Mythisch'), ok: P.gold >= p2 ? true : _t('Zu wenig Gold'), go: () => { P.gold -= p2; encRes(E, _t('Er wickelt es in Tuch, das zu Staub zerfällt. „Gute Wahl. Die beste, die du je treffen wirst – oder die schlechteste.“'), [{ t: 'item', it: Math.random() < .12 + E.dep * .2 ? makeMythic() : randomItem(E.st + 2, 4) }]); } },
    { t: _t('Sanduhr – {n} Gold', { n: fmt(p3) }), s: _t('Für 3 Minuten +25 % Tempo'), ok: P.gold >= p3 ? true : _t('Zu wenig Gold'), go: () => { P.gold -= p3; eFx(E, 'spd', .25, 180, _t('Geliehene Zeit')); encRes(E, _t('Du drehst die Sanduhr um. Die Welt wird ein wenig langsamer – du nicht.')); } },
    { t: _t('Nichts kaufen'), go: () => encRes(E, _t('„Dann ein andermal“, sagt er. „Oder ein früheres Mal.“ Er ist fort, bevor du blinzeln kannst.')) }]; } });

eDef('drache', { n: _t('Der Schlafende Uralte'), art: 'drache', pet: 'drache', c: '#ff6a5a', bio: ['fels', 'heiss', 'ruine'], d0: .008, hint: _t('Wo der Boden warm ist und die Felsen hoch.'),
  intro: () => [_t('Ein Drache, so alt, dass Moos auf seinen Schuppen wächst, schläft auf einem Berg aus Gold. Jeder Atemzug ist ein warmer Sturm.'), _t('Ein Auge ist nicht ganz geschlossen.')],
  ch: E => [{ t: _t('Anschleichen und Gold stehlen'), s: _t('Gelingt es nicht, erwacht er'), go: () => { const ch = .55 + (P.st.dodge || 0) + (P.cls === 'rogue' ? .15 : 0); if (Math.random() < ch) encRes(E, _t('Du hältst den Atem an, greifst zu – und schleichst davon, die Taschen voller Gold. Der Drache schnarcht.'), [{ t: 'gold', n: eGold(E, 8) }, eItem(E, 2, 2)]); else { eBoss(E, _t('Der Uralte Schläfer'), () => [{ t: 'gold', n: eGold(E, 16) }, eItem(E, 3, 3), eItem(E, 2, 2)]); encRes(E, _t('Eine Münze klirrt. Das Auge öffnet sich. „DIEB“, donnert eine Stimme, die die Erde beben lässt.')); } } },
    { t: _t('Den Drachen wecken und kämpfen'), s: _t('Boss – großer Hort'), go: () => { eBoss(E, _t('Der Uralte Schläfer'), () => [{ t: 'gold', n: eGold(E, 20) }, eItem(E, 3, 3), eItem(E, 3, 2), { t: 'egg', luck: 2 + E.dep * 8 }]); encRes(E, _t('Du rufst ihn bei seinem Namen, den du nicht kennst. Er erhebt sich, und der Himmel wird dunkel.')); } },
    { t: _t('Leise umkehren'), go: () => encRes(E, _t('Manche Schätze sind es nicht wert. Du gehst – und spürst, wie das halb offene Auge dir folgt.'), [{ t: 'xp', n: 30 + E.st * 10 }]) }] });

eDef('brunnen', { n: _t('Brunnen der Wünsche'), art: 'brunnen', c: '#57c7e6', bio: ['wiese', 'wald', 'ruine', 'x'], hint: _t('Er steht dort, wo früher Menschen lebten.'),
  intro: () => [_t('Ein alter Brunnen, am Grund glitzern unzählige Münzen. Auf dem Rand steht: Wer gibt, dem wird gegeben. Manchmal.')],
  ch: E => { const big = Math.max(50, Math.round(P.gold * .1)); return [
    { t: _t('Eine Münze werfen – 10 Gold'), ok: P.gold >= 10 ? true : _t('Zu wenig Gold'), go: () => { P.gold -= 10; const r = Math.random(); if (r < .55) encRes(E, _t('Plopp. Sonst passiert nichts. Aber es war ein schönes Plopp.')); else if (r < .85) { eFx(E, 'gold', .2, 240, _t('Brunnenglück')); encRes(E, _t('Das Wasser kräuselt sich zu einem Lächeln. Gold wird dich eine Weile lieber finden.')); } else encRes(E, _t('Der Brunnen spuckt etwas aus – einen Edelstein, nass und funkelnd.'), [{ t: 'gem', k: randomGem(E.st + 6) }]); } },
    { t: _t('Eine Handvoll werfen – {n} Gold', { n: fmt(big) }), s: _t('größerer Wunsch'), ok: P.gold >= big ? true : _t('Zu wenig Gold'), go: () => { P.gold -= big; const r = Math.random(); if (r < .35) encRes(E, _t('Aus der Tiefe steigt ein Gegenstand, getragen von einer Wasserhand.'), [eItem(E, 2, 2)]); else if (r < .55) encRes(E, _t('Ein Ei treibt an die Oberfläche, warm und lebendig.'), [{ t: 'egg', luck: 1.5 + E.dep * 6 }]); else if (r < .75) encRes(E, _t('Das Wasser leuchtet golden.'), [{ t: 'fate', n: 1 }]); else if (r < .9) encRes(E, _t('Der Brunnen gluckst zufrieden und spuckt dein Gold wieder aus – doppelt.'), [{ t: 'gold', n: big * 2 }]); else encRes(E, _t('Nichts. Der Brunnen hat einfach Hunger gehabt.')); } },
    { t: _t('Einen Wunsch ohne Gold'), go: () => Math.random() < .5 ? (eFx(E, 'dmg', -.1, 120, _t('Geizfluch'), 1), encRes(E, _t('„Geizhals“, gluckert es aus der Tiefe. Deine Arme werden schwer.'))) : encRes(E, _t('Der Brunnen schweigt. Er hat schon Schlimmere gesehen.')) },
    { t: _t('Weitergehen'), go: () => encRes(E, _t('Du lässt den Brunnen zurück. Hinter dir plätschert es, beinahe enttäuscht.')) }]; } });

eDef('zwilling', { n: _t('Der Schattenzwilling'), pic: ['sp', 'knight', 'rgba(14,4,24,.86)'], c: '#8a6ab8', bio: ['schatten', 'x'], d0: .004, hint: _t('Er wartet, wo die Schatten länger sind als die Dinge.'),
  intro: () => [_t('Dein Schatten löst sich vom Boden und steht auf. Er hat dein Gesicht, deine Haltung – und dein Grinsen, nur breiter.'), _t('„Einer von uns ist zu viel“, sagt er mit deiner Stimme.')],
  ch: E => [{ t: _t('Gegen dich selbst kämpfen'), s: _t('Elite-Kampf'), go: () => { eFight(E, ['todesritter'], { elite: true, name: _t('Schattenzwilling'), tint: 'rgba(14,4,24,.8)', hpMul: 1.4 }, () => { aFx('dmg', .12, 300, _t('Selbsterkenntnis')); return [eItem(E, 3, 2)]; }, _t('Du hast dich selbst besiegt. Das macht dich stärker.')); encRes(E, _t('Der Zwilling zieht eine Klinge aus Dunkelheit. Er kennt jede deiner Bewegungen.')); } },
    { t: _t('Ihm die Hand reichen'), go: () => Math.random() < .5 ? (eFx(E, 'crit', .08, 300, _t('Einheit')), encRes(E, _t('Der Schatten zögert – dann ergreift er deine Hand und fließt in dich zurück. Du siehst plötzlich jede Schwäche deiner Feinde.'))) : (eFx(E, 'dr', -.1, 180, _t('Gestohlener Schatten'), 1), encRes(E, _t('Er nimmt deine Hand – und lässt nicht los. Als er verschwindet, nimmt er ein Stück deiner Härte mit.'))) },
    { t: _t('Fliehen'), go: () => { eFx(E, 'spd', -.08, 120, _t('Verfolgt'), 1); encRes(E, _t('Du rennst. Dein Schatten rennt hinter dir her, immer einen Schritt zu nah.')); } }] });

eDef('feenring', { n: _t('Der Feenring'), art: 'feenring', c: '#f786a0', bio: ['wald', 'wiese', 'pilz'], hint: _t('Pilze im Kreis, unter alten Bäumen.'),
  intro: () => [_t('Rote Pilze stehen in einem perfekten Kreis. In der Mitte flimmert die Luft, und von irgendwoher kichert es.')],
  ch: E => [{ t: _t('In den Ring treten'), s: _t('Wohin er dich wohl bringt?'), go: () => { eTele(E); eFx(E, 'spd', .2, 180, _t('Feenstaub')); P.hp = P.st.hp; encRes(E, _t('Die Welt dreht sich, Lachen umhüllt dich – und plötzlich stehst du ganz woanders, leicht wie eine Feder.')); } },
    { t: _t('Pilze sammeln'), go: () => { if (Math.random() < .6) encRes(E, _t('Die Pilze lassen sich willig pflücken. Feenpilze sind wertvoll – und ein wenig klebrig.'), [{ t: 'mat', k: 'schleim', n: 4 }, { t: 'mat', k: 'kristall', n: 1 }]); else { eFight(E, ['imp', 'imp', 'imp'], { name: _t('Feenkobold'), tint: 'rgba(247,134,160,.45)' }, () => [{ t: 'gold', n: eGold(E, 2) }], _t('Die Kobolde sind verjagt.')); eFx(E, 'spd', -.15, 60, _t('Feenschabernack'), 1); encRes(E, _t('„Diebe!“ Kleine Kobolde springen aus dem Gras und binden dir die Schnürsenkel zusammen.')); } } },
    { t: _t('Einen Wunsch flüstern'), go: () => Math.random() < .3 ? encRes(E, _t('Ein winziges Lachen antwortet. In deiner Tasche klimpert etwas.'), [{ t: 'fate', n: 1 }]) : (P.hp = P.st.hp, encRes(E, _t('Ein warmer Wind streicht über dich. Alle Wunden schließen sich.'))) }] });

eDef('schwert', { n: _t('Das sprechende Schwert'), art: 'schwert', c: '#ffd24a', once: 1, bio: ['fels', 'ruine', 'x'], hint: _t('Nur einmal in einem Leben. Es wartet im Stein.'),
  intro: () => [_t('In einem Stein steckt ein Schwert. Als du näher kommst, öffnet sich ein Auge auf der Klinge.'), _t('„Endlich jemand“, sagt das Schwert. „Ich stecke hier seit dreihundert Jahren. Weißt du, wie langweilig Stein ist?“')],
  ch: E => [{ t: _t('Das Schwert herausziehen'), s: _t('Nur die Starken schaffen es'), go: () => { if (P.lv >= 12 || Math.random() < .25) { const Cl = CLASSES[P.cls], it = makeItem({ slot: 'weapon', base: Cl.weapons.includes('sword') ? 'sword' : Cl.start, tier: clamp(Math.floor((E.st - 1) / 6) + 1, 0, TIERS - 1), rar: 4 }); it.name = 'Raunezahn'; encRes(E, _t('Mit einem Ruck ziehst du die Klinge heraus. „Ha! Frische Luft!“, ruft Raunezahn. Von jetzt an kommentiert er jeden deiner Schläge.'), [{ t: 'item', it }]); } else { const M = aLocal(); M.enc.schwert = 0; encRes(E, _t('Es bewegt sich keinen Fingerbreit. „Komm wieder, wenn du ein paar Level mehr hast“, sagt das Schwert. „Ich warte. Ich bin gut im Warten.“')); } } },
    { t: _t('Ihm zuhören'), go: () => { const t = eReveal(E); encRes(E, _t('Das Schwert erzählt drei Stunden lang. Das meiste ist Prahlerei, aber eine Geschichte klingt wahr.') + ' ' + t, [{ t: 'xp', n: 30 + E.st * 12 }]); } }] });

eDef('pilger', { n: _t('Der Pilgerzug'), pic: ['sp', 'elf'], c: '#efe2bf', bio: ['wiese', 'wueste', 'x'], hint: _t('Sie ziehen über offenes Land zu einem fernen Schrein.'),
  intro: () => [_t('Eine Gruppe erschöpfter Pilger kreuzt deinen Weg. Ihre Füße sind wund, ihr Wasser ist knapp, aber ihre Lieder sind fröhlich.'), _t('„Fremder“, ruft die Älteste, „hast du etwas für uns übrig?“')],
  ch: E => [{ t: _t('Einen Heiltrank spenden'), ok: P.potions > 0 ? true : _t('Kein Heiltrank'), go: () => { P.potions--; eFx(E, 'regen', Math.max(1, P.st.hp * .012), 240, _t('Segen der Pilger')); encRes(E, _t('Die Pilger segnen dich in einer Sprache, die du nicht kennst. Wärme breitet sich in dir aus.'), Math.random() < .5 ? [{ t: 'fate', n: 1 }] : []); } },
    { t: _t('Sie ein Stück begleiten'), s: _t('Räuber lauern'), go: () => { eFx(E, 'dr', .1, 240, _t('Schutz der Pilger')); eFight(E, ['goblin', 'gobarcher', 'bomber', 'orc'].slice(0, 3 + (E.dep > .03 ? 1 : 0)), { name: _t('Pilgerjäger') }, () => [{ t: 'gold', n: eGold(E, 3) }, eItem(E, 1, 1)], _t('Die Pilger sind in Sicherheit und danken dir.')); encRes(E, _t('Kaum seid ihr unterwegs, springen Räuber aus dem Gebüsch. Die Pilger segnen dich – kämpfen musst du selbst.')); } },
    { t: _t('Weitergehen'), go: () => encRes(E, _t('Die Pilger ziehen singend weiter. Ihr Lied bleibt dir noch lange im Ohr.')) }] });

eDef('kind', { n: _t('Das verlorene Kind'), pic: ['sp', 'elff'], c: '#79c24e', bio: ['wald', 'wiese', 'sumpf'], hint: _t('Es weint am Waldrand.'),
  intro: () => [_t('Ein Kind sitzt weinend auf einem Stein. Es hat sich verlaufen, sagt es, und das Lager der Eltern sei irgendwo hinter den Hügeln.')],
  ch: E => [{ t: _t('Zum Lager der Eltern bringen'), go: () => { if (Math.random() < .8) { eFx(E, 'xp', .2, 300, _t('Dankbarkeit')); encRes(E, _t('Die Eltern weinen vor Glück und drücken dir ihren größten Schatz in die Hand. Das Kind winkt, bis du außer Sicht bist.'), [{ t: 'gold', n: eGold(E, 3) }, eItem(E, 2, 1)]); } else { eFight(E, ['schattenimp', 'imp', 'imp'], { name: _t('Wechselbalg') }, () => [{ t: 'gold', n: eGold(E, 2) }, { t: 'gem', k: randomGem(E.st + 2) }], _t('Der Wechselbalg ist vertrieben.')); eFx(E, 'dmg', -.08, 90, _t('Feenfluch'), 1); encRes(E, _t('Am Lager ist niemand. Das Kind dreht sich um – und grinst mit viel zu vielen Zähnen. Ein Wechselbalg!')); } } },
    { t: _t('Den Weg beschreiben'), go: () => encRes(E, _t('Das Kind nickt tapfer und läuft los. Hoffentlich hat es zugehört.'), [{ t: 'xp', n: 20 + E.st * 6 }]) }] });

eDef('sphinx', { n: _t('Die Sphinx'), art: 'sphinx', c: '#57c7e6', bio: ['wueste', 'ruine', 'fels'], hint: _t('Sie liebt Sand, Stein und kluge Antworten.'),
  intro: () => [_t('Eine Sphinx liegt quer über dem Weg und gähnt. „Drei Rätsel“, sagt sie. „Für jedes richtige bekommst du mehr. Für ein falsches – nichts mehr. Ganz einfach.“')],
  ch: E => [{ t: _t('Rätsel lösen'), go: () => { E.sw = 0; const step = () => eRiddle(E, ok => { if (!ok) { encRes(E, E.sw ? _t('„Schade“, sagt die Sphinx. „Aber was du gewonnen hast, gehört dir.“') : _t('Die Sphinx gähnt noch einmal und schläft ein. Du hast nichts gewonnen außer einer Geschichte.'), E.sw ? [{ t: 'gold', n: eGold(E, 2 * E.sw) }] : []); return; } E.sw++; if (E.sw >= 3) encRes(E, _t('„Beeindruckend“, schnurrt die Sphinx. „Seit dem Weltenfeuer hat das niemand geschafft.“'), [{ t: 'gem', k: randomGem(E.st + 10) }, eItem(E, 3, 2), { t: 'fate', n: 1 }]); else step(); }); step(); } },
    { t: _t('Ablehnen'), go: () => encRes(E, _t('„Feigling“, sagt die Sphinx freundlich und rückt zur Seite.')) }] });

eDef('ritter', { n: _t('Der verfluchte Ritter'), pic: ['sp', 'knight', 'rgba(60,10,40,.5)'], c: '#c8463c', bio: ['ruine', 'schatten', 'sumpf'], hint: _t('Er hält Wache an Orten, die längst vergessen sind.'),
  intro: () => [_t('Ein Ritter in rostiger Rüstung versperrt den Weg. Hinter seinem Visier glimmt rotes Licht.'), _t('„Ein Fluch bindet mich an diesen Ort“, krächzt er. „Besiege mich – oder bete für mich. Nur so finde ich Ruhe.“')],
  ch: E => [{ t: _t('Gegen ihn kämpfen'), s: _t('Elite-Kampf'), go: () => { eFight(E, ['todesritter'], { elite: true, name: _t('Verfluchter Ritter'), tint: 'rgba(60,10,40,.45)' }, () => { const t = eReveal(E); toast(t, '#ffd24a'); return [eItem(E, 3, 2), { t: 'xp', n: 50 + E.st * 20 }]; }, _t('Der Ritter findet Ruhe. In seinem Gürtel steckte eine Karte.')); encRes(E, _t('„Danke“, sagt er und zieht sein Schwert.')); } },
    { t: _t('Für ihn beten'), go: () => { eFx(E, 'dr', .1, 300, _t('Ritterlicher Dank')); encRes(E, _t('Deine Worte sind ungeschickt, aber ehrlich. Die Rüstung sinkt in sich zusammen, leer. Ein leises Danke weht davon.'), [{ t: 'xp', n: 40 + E.st * 15 }]); } },
    { t: _t('Einen Umweg nehmen'), go: () => encRes(E, _t('Der Ritter sieht dir nach. Er hat Zeit. Er hat nur noch Zeit.')) }] });

eDef('seherin', { n: _t('Die Seherin'), pic: ['sp', 'wizf'], c: '#b892f4', hint: _t('Sie findet dich, nicht umgekehrt.'),
  intro: () => [_t('Eine Frau mit verbundenen Augen sitzt an einem winzigen Feuer. „Ich habe dich erwartet“, sagt sie, bevor du etwas sagen kannst.')],
  ch: E => { const p = eGold(E, 2); return [
    { t: _t('Die Zukunft lesen lassen – {n} Gold', { n: fmt(p) }), ok: P.gold >= p ? true : _t('Zu wenig Gold'), go: () => { P.gold -= p; const r = Math.random(); if (r < .4) encRes(E, _t('„Du suchst Geschichten“, sagt sie. „Ich zeige dir eine.“') + ' ' + eReveal(E)); else if (r < .75) { eFx(E, 'loot', .25, 300, _t('Vorhergesagtes Glück')); encRes(E, _t('„Glück liegt auf deinem Weg. Bück dich danach.“')); } else { eFx(E, 'dr', .12, 240, _t('Vorwarnung')); encRes(E, _t('„Gefahr“, flüstert sie. „Aber du wirst sie kommen sehen.“')); } } },
    { t: _t('Fragen, woher sie dich kennt'), go: () => encRes(E, _t('„Aus einer Geschichte, die noch nicht geschrieben ist“, sagt sie und lächelt. Mehr verrät sie nicht.')) }]; } });

eDef('hirsch', { n: _t('Der Goldene Hirsch'), art: 'hirsch', c: '#ffd24a', bio: ['wald', 'wiese'], hint: _t('Er zeigt sich im Wald, im ersten Licht.'),
  intro: () => [_t('Zwischen den Bäumen steht ein Hirsch, dessen Fell wie Gold schimmert. Er sieht dich an, ohne Furcht, und wendet sich langsam ab – als sollst du ihm folgen.')],
  ch: E => [{ t: _t('Ihm folgen'), go: () => { if (Math.random() < .7) encRes(E, _t('Er führt dich zu einer Lichtung, auf der ein alter Schatz im Moos liegt. Dann ist er fort.'), [{ t: 'gold', n: eGold(E, 4) }, eItem(E, 2, 1)]); else { eTele(E); eFx(E, 'spd', .15, 180, _t('Hirschlauf')); encRes(E, _t('Du folgst ihm schneller und schneller, bis die Welt verschwimmt. Als du anhältst, ist alles fremd.')); } } },
    { t: _t('Ihn jagen'), go: () => { eFx(E, 'loot', -.25, 300, _t('Fluch des Waldes'), 1); encRes(E, _t('Dein Treffer streift ihn nur. Er verschwindet, und der Wald wird still und feindselig. Ein paar goldene Haare bleiben zurück.'), [{ t: 'mat', k: 'leder', n: 4 }, { t: 'mat', k: 'horn', n: 1 }]); } },
    { t: _t('Ihn ziehen lassen'), go: () => { eFx(E, 'regen', Math.max(1, P.st.hp * .01), 300, _t('Segen des Waldes')); encRes(E, _t('Der Hirsch neigt den Kopf, als bedanke er sich. Ein tiefer Friede erfüllt dich.')); } }] });

eDef('grab', { n: _t('Das Heldengrab'), art: 'grab', c: '#a8997e', bio: ['ruine', 'fels', 'x'], hint: _t('Ein Schwert im Hügel markiert es.'),
  intro: () => [_t('Ein Grabhügel, darauf ein verwittertes Schwert. Auf dem Stein steht nur: Er hielt die Brücke.')],
  ch: E => [{ t: _t('Grabbeigaben nehmen'), s: _t('Die Toten wachen'), go: () => { eFight(E, ['skeleton', 'skeleton', 'skelarcher'].concat(E.dep > .05 ? ['skelmage'] : []), { name: _t('Grabwächter') }, () => [{ t: 'gold', n: eGold(E, 2) }], _t('Die Grabwächter ruhen wieder.')); eFx(E, 'spd', -.1, 120, _t('Totenkälte'), 1); encRes(E, _t('Kaum berührst du die Grabbeigaben, rührt sich die Erde.'), [eItem(E, 2, 1), { t: 'gold', n: eGold(E, 2) }]); } },
    { t: _t('Ehre erweisen'), go: () => { eFx(E, 'dr', .12, 300, _t('Ehre des Helden')); encRes(E, _t('Du legst eine Hand auf den Stein. Für einen Moment spürst du, wie es war, eine Brücke allein zu halten.')); } },
    { t: _t('Ein Gebet sprechen'), go: () => { P.hp = P.st.hp; encRes(E, _t('Der Wind trägt deine Worte fort. Du fühlst dich leichter.'), [{ t: 'xp', n: 25 + E.st * 10 }]); } }] });

eDef('irrlichter', { n: _t('Die Irrlichter'), art: 'irrlicht', c: '#9ad8ee', bio: ['sumpf', 'schatten', 'gift'], hint: _t('Sie tanzen über dunklem Wasser.'),
  intro: () => [_t('Bläuliche Lichter tanzen über dem Boden und locken dich mit einem Klang wie feine Glöckchen.')],
  ch: E => [{ t: _t('Den Lichtern folgen'), s: _t('Schatz – oder Falle'), go: () => Math.random() < .5 ? encRes(E, _t('Die Lichter führen dich zu einem versunkenen Kästchen und verlöschen zufrieden.'), [{ t: 'gold', n: eGold(E, 3) }, { t: 'gem', k: randomGem(E.st + 4) }]) : (eFight(E, ['geist', 'geist', 'zombie'].slice(0, 2 + (E.dep > .04 ? 1 : 0)), { name: _t('Moorgeist') }, () => [{ t: 'gold', n: eGold(E, 2) }, eItem(E, 1, 1)], _t('Die Moorgeister sind fort.')), encRes(E, _t('Die Lichter verlöschen alle auf einmal. In der Dunkelheit steigen Gestalten aus dem Boden.'))) },
    { t: _t('Ein Licht einfangen'), go: () => Math.random() < .55 ? encRes(E, _t('Du schließt die Hände um ein Licht. Es wird zu einem kühlen, glimmenden Kristall.'), [{ t: 'mat', k: E.dep > .2 ? 'aether' : 'kristall', n: E.dep > .2 ? 1 : 2 }]) : (eFx(E, 'crit', -.05, 90, _t('Irrlichtblendung'), 1), encRes(E, _t('Das Licht platzt in deinen Händen wie eine Seifenblase. Für eine Weile siehst du nur bunte Flecken.'))) },
    { t: _t('Die Augen schließen und weitergehen'), go: () => encRes(E, _t('Die Glöckchen klingen enttäuscht. Du gehst weiter, Schritt für Schritt.')) }] });

eDef('alchemist', { n: _t('Der wandernde Alchemist'), pic: ['sp', 'wizard'], c: '#79c24e', hint: _t('Man riecht ihn, bevor man ihn sieht.'),
  intro: () => [_t('Ein Alchemist mit verbrannten Augenbrauen hält dir eine dampfende Phiole hin. „Ungetestet“, sagt er stolz. „Du wärst der Erste!“')],
  ch: E => { const p = eGold(E, 2.5); return [
    { t: _t('Den Trank probieren'), s: _t('Wer weiß …'), go: () => { const r = Math.random(); if (r < .35) { eFx(E, 'dmg', .25, 180, _t('Riesenkraft')); encRes(E, _t('Deine Muskeln schwellen an. Der Alchemist notiert begeistert: „Funktioniert!“')); } else if (r < .6) { eFx(E, 'spd', .3, 180, _t('Wieselflink')); encRes(E, _t('Deine Füße kribbeln. Du bist schneller, als dir lieb ist.')); } else if (r < .8) { P.hp = P.st.hp; eFx(E, 'regen', Math.max(1, P.st.hp * .015), 120, _t('Lebenselixier')); encRes(E, _t('Es schmeckt nach Minze und Morgenluft. Du fühlst dich wie neugeboren.')); } else { eHurt(.2); eFx(E, 'hp', -.15, 120, _t('Bauchgrimmen'), 1); encRes(E, _t('Es schmeckt nach Socken. Dir wird übel. Der Alchemist notiert: „Funktioniert nicht.“')); } } },
    { t: _t('Zwei Heiltränke kaufen – {n} Gold', { n: fmt(p) }), ok: P.gold >= p && P.potions < potMax() ? true : P.gold < p ? _t('Zu wenig Gold') : _t('Trankgürtel voll'), go: () => { P.gold -= p; encRes(E, _t('„Die sind getestet“, versichert er. „Fast alle.“'), [{ t: 'pot', n: 2 }]); } },
    { t: _t('Höflich ablehnen'), go: () => encRes(E, _t('„Feigling“, murmelt er und trinkt selbst. Er färbt sich blau. Er scheint zufrieden.')) }]; } });

eDef('zeitriss', { n: _t('Der Riss in der Zeit'), art: 'riss', c: '#c060ff', bio: ['schatten', 'kristall'], d0: .02, hint: _t('Er öffnet sich weit draußen, wo die Welt dünn ist.'),
  intro: () => [_t('Mitten in der Luft klafft ein Riss. Dahinter siehst du andere Zeiten: brennende Städte, Wälder ohne Menschen, ein Schwert, das gerade geschmiedet wird.')],
  ch: E => [{ t: _t('Hineingreifen'), s: _t('kostet ein Viertel deines Lebens'), go: () => { eHurt(.25); encRes(E, _t('Die Zeit beißt in deinen Arm. Aber als du ihn zurückziehst, hältst du etwas aus einem anderen Zeitalter.'), [{ t: 'item', it: Math.random() < .03 + E.dep * .12 ? makeMythic() : randomItem(E.st + 3, 3) }]); } },
    { t: _t('Den Riss versiegeln'), go: () => encRes(E, _t('Mit aller Kraft drückst du die Ränder zusammen. Der Riss schließt sich mit einem Seufzen.'), [{ t: 'xp', n: 80 + E.st * 30 }].concat(Math.random() < .25 ? [{ t: 'fate', n: 1 }] : [])) },
    { t: _t('Abstand halten'), go: () => encRes(E, _t('Manche Türen bleiben besser zu. Der Riss flackert und vergeht.')) }] });

eDef('steinkreis', { n: _t('Das Orakel der Steine'), art: 'steinkreis', c: '#57c7e6', bio: ['wiese', 'fels', 'x'], hint: _t('Alte Steine im Kreis, mit Runen, die leuchten.'),
  intro: () => [_t('In einem Kreis aus uralten Steinen leuchten Runen auf, als du eintrittst. Eine Stimme aus allen Steinen zugleich: „Wähle, was du begehrst. Nur eines.“')],
  ch: E => [{ t: _t('Macht'), s: _t('+20 % Schaden für 5 Minuten'), go: () => { eFx(E, 'dmg', .2, 300, _t('Macht der Steine')); encRes(E, _t('Die Runen fließen in deine Waffe.')); } },
    { t: _t('Schutz'), s: _t('−10 % Schaden für 5 Minuten'), go: () => { eFx(E, 'dr', .1, 300, _t('Schutz der Steine')); encRes(E, _t('Ein Schimmer legt sich wie Stein um deine Haut.')); } },
    { t: _t('Reichtum'), s: _t('+30 % Gold für 5 Minuten'), go: () => { eFx(E, 'gold', .3, 300, _t('Reichtum der Steine')); encRes(E, _t('Deine Taschen fühlen sich plötzlich schwerer an. Noch sind sie leer.')); } },
    { t: _t('Weisheit'), s: _t('+25 % Erfahrung für 5 Minuten'), go: () => { eFx(E, 'xp', .25, 300, _t('Weisheit der Steine')); encRes(E, _t('Für einen Herzschlag verstehst du alles. Dann nur noch fast alles.')); } }] });

eDef('bettlerin', { n: _t('Die alte Bettlerin'), pic: ['sp', 'wizf', 'rgba(120,110,100,.45)'], c: '#a8997e', hint: _t('Sie sitzt am Wegrand und bittet um wenig.'),
  intro: () => [_t('Eine alte Frau in Lumpen streckt dir eine zitternde Hand entgegen. „Nur ein paar Münzen, bitte. Für Brot.“')],
  ch: E => { const p = Math.max(20, Math.round(P.gold * .1)); return [
    { t: _t('Großzügig geben – {n} Gold', { n: fmt(p) }), ok: P.gold >= p ? true : _t('Zu wenig Gold'), go: () => { P.gold -= p; if (Math.random() < .65) { eFx(E, 'dmg', .1, 300, _t('Göttliche Gunst')); eFx(E, 'dr', .08, 300, _t('Göttlicher Schutz')); encRes(E, _t('Die Lumpen fallen ab. Vor dir steht eine Göttin aus Licht. „Es gibt nicht mehr viele wie dich“, sagt sie – und segnet dich.'), [{ t: 'fate', n: 2 }]); } else { eFx(E, 'regen', Math.max(1, P.st.hp * .008), 180, _t('Dank der Alten')); encRes(E, _t('Sie dankt dir mit Tränen in den Augen. Es fühlt sich gut an.')); } } },
    { t: _t('Brot teilen'), go: () => encRes(E, _t('Ihr esst zusammen am Wegrand. Sie erzählt von früher, als die Lande noch klein waren.'), [{ t: 'xp', n: 20 + E.st * 8 }]) },
    { t: _t('Weitergehen'), go: () => encRes(E, _t('Als du dich umdrehst, ist der Wegrand leer. Nur ein Duft nach Lilien bleibt.')) }]; } });

eDef('banditen', { n: _t('Der Wegezoll'), pic: ['sp', 'masked'], c: '#ff8a3a', bio: ['wiese', 'wald', 'fels', 'wueste'], hint: _t('Wo Wege sich kreuzen, wartet die Bande.'),
  intro: () => [_t('Maskierte Gestalten versperren den Weg. „Wegezoll“, sagt die Anführerin und wiegt einen Knüppel in der Hand. „Oder wir nehmen es uns.“')],
  ch: E => { const p = eGold(E, 2); return [
    { t: _t('Zahlen – {n} Gold', { n: fmt(p) }), ok: P.gold >= p ? true : _t('Zu wenig Gold'), go: () => { P.gold -= p; const t = Math.random() < .5 ? ' ' + eReveal(E) : ''; encRes(E, _t('„Kluge Wahl.“ Als Dank flüstert die Anführerin dir zu, was die Bande auf ihren Streifzügen gesehen hat.') + t); } },
    { t: _t('Kämpfen'), s: _t('Ihre Beute für dich'), go: () => { eFight(E, ['orc', 'goblin', 'gobarcher', 'bomber', 'berserker'].slice(0, 3 + Math.min(2, Math.floor(E.dep * 40))), { name: _t('Wegelagerer') }, () => [{ t: 'gold', n: eGold(E, 5) }, eItem(E, 2, 1)], _t('Die Bande ist zerschlagen – ihre Beute gehört dir.')); encRes(E, _t('„Wie du willst!“ Die Bande stürzt sich auf dich.')); } },
    { t: _t('Einschüchtern'), s: P.lv >= 20 ? _t('Sie kennen deinen Ruf') : _t('Riskant'), go: () => { if (P.lv >= 20 || Math.random() < .3) encRes(E, _t('Du sagst nur deinen Namen. Die Bande wird blass, wirft dir einen Beutel zu und rennt.'), [{ t: 'gold', n: eGold(E, 3) }]); else { eFight(E, ['orc', 'goblin', 'gobarcher'], { name: _t('Wegelagerer') }, () => [{ t: 'gold', n: eGold(E, 4) }], _t('Die Bande ist zerschlagen.')); encRes(E, _t('Sie lachen dich aus. Dann greifen sie an.')); } } }]; } });

eDef('lampe', { n: _t('Die Lampe im Sand'), art: 'lampe', c: '#ffd24a', bio: ['wueste', 'ruine'], hint: _t('Halb vergraben, wo der Sand singt.'),
  intro: () => [_t('Aus dem Sand ragt eine goldene Lampe. Als du sie aufhebst, quillt violetter Rauch heraus und formt ein Gesicht.'), _t('„EIN WUNSCH“, dröhnt der Dschinn. „Aber wähle weise. Ich bin seit tausend Jahren schlecht gelaunt.“')],
  ch: E => [{ t: _t('Gold wünschen'), go: () => { eFx(E, 'spd', -.15, 180, _t('Goldgier'), 1); encRes(E, _t('Gold regnet vom Himmel – so viel, dass du kaum laufen kannst.'), [{ t: 'gold', n: eGold(E, 10) }]); } },
    { t: _t('Macht wünschen'), go: () => { eFx(E, 'dmg', .3, 180, _t('Dschinnmacht')); eFx(E, 'hp', -.2, 180, _t('Preis der Macht'), 1); encRes(E, _t('Macht durchströmt dich – und nimmt sich ihren Preis von deinem Leben.')); } },
    { t: _t('Dem Dschinn die Freiheit wünschen'), go: () => { eFx(E, 'dr', .1, 300, _t('Dank des Dschinns')); const t = eReveal(E); encRes(E, _t('Der Dschinn erstarrt. Dann lacht er, zum ersten Mal seit tausend Jahren. „Dafür schulde ich dir etwas.“') + ' ' + t, [{ t: 'fate', n: 1 }]); } },
    { t: _t('Die Lampe zurücklegen'), go: () => encRes(E, _t('„Feige, aber klug“, brummt der Dschinn und zieht sich in die Lampe zurück.')) }] });

eDef('eisgeist', { n: _t('Der Eisgeist'), pic: ['sp', 'icez'], c: '#8ee6ff', bio: ['kalt'], only: 1, hint: _t('Er lebt nur, wo der Schnee nie schmilzt.'),
  intro: () => [_t('Eine Gestalt aus Schnee und Wind wirbelt vor dir auf. „Du bist warm“, haucht sie. „Warm und laut. Willst du etwas von meiner Kälte?“')],
  ch: E => [{ t: _t('Die Kälte annehmen'), s: _t('Frost auf deinen Schlägen'), go: () => { eFx(E, 'frostW', .25, 300, _t('Frostgabe')); eFx(E, 'spd', -.05, 300, _t('Klamme Glieder'), 1); encRes(E, _t('Kälte kriecht in deine Waffe. Jeder Schlag lässt jetzt Raureif zurück.')); } },
    { t: _t('Ein Feuer für ihn entzünden'), go: () => encRes(E, _t('Der Geist schmilzt nicht – er seufzt glücklich und hinterlässt, was er unter dem Eis gehütet hat.'), [{ t: 'mat', k: 'mithril', n: 2 }, { t: 'xp', n: 30 + E.st * 12 }]) },
    { t: _t('Fliehen'), go: () => encRes(E, _t('Der Wind lacht hinter dir her, bis deine Ohren klingeln.')) }] });

eDef('salamander', { n: _t('Der Feuersalamander'), art: 'salamander', c: '#ff8a3a', bio: ['heiss'], only: 1, hint: _t('Er badet in der Glut.'),
  intro: () => [_t('In einem Becken aus Glut räkelt sich ein Salamander, lang wie ein Wagen. Er öffnet träge ein Auge und schnuppert in deine Richtung.')],
  ch: E => [{ t: _t('Ihn mit Glut füttern'), ok: (P.mats.glut || 0) >= 1 ? true : _t('Du hast keine Glut'), go: () => { P.mats.glut--; eFx(E, 'burnW', .25, 300, _t('Salamanderfeuer')); encRes(E, _t('Er schnappt zufrieden zu und haucht dich an. Deine Waffe glüht jetzt von innen.')); } },
    { t: _t('Ihn fangen'), s: _t('heiß!'), go: () => { if (Math.random() < .45) encRes(E, _t('Du packst zu – und hältst plötzlich ein warmes, zuckendes Ei in der Hand. Der Salamander ist entkommen.'), [{ t: 'egg', luck: 1 + E.dep * 6 }]); else { eHurt(.2); encRes(E, _t('Autsch. Du hältst nur noch seinen Schwanz in der Hand. Der wächst ihm nach – dir nicht die Haut.'), [{ t: 'mat', k: 'glut', n: 3 }]); } } },
    { t: _t('Weitergehen'), go: () => encRes(E, _t('Der Salamander schließt das Auge wieder. Die Glut knistert.')) }] });

eDef('pilzkoenig', { n: _t('Der Pilzkönig'), art: 'pilz', c: '#b892f4', bio: ['pilz', 'wald', 'sumpf'], hint: _t('Er herrscht, wo Pilze größer sind als Bäume.'),
  intro: () => [_t('Ein Pilz, groß wie eine Hütte und mit einer winzigen Krone, öffnet zwei schläfrige Augen. „Ein Besucher“, murmelt er. „Wie aufregend. Wie anstrengend.“')],
  ch: E => [{ t: _t('Seine Sporen einatmen'), s: _t('Visionen – und Übelkeit'), go: () => { eHurt(.15); const t = eReveal(E); encRes(E, _t('Die Welt wird bunt und weich. In der Vision siehst du einen Ort, den du suchen solltest.') + ' ' + t); } },
    { t: _t('Ihm Respekt erweisen'), go: () => { eFx(E, 'regen', Math.max(1, P.st.hp * .01), 240, _t('Gunst des Pilzkönigs')); encRes(E, _t('Er nickt so langsam, dass es eine Minute dauert. Dann schenkt er dir etwas aus seinem Reich.'), [{ t: 'mat', k: 'schleim', n: 5 }]); } },
    { t: _t('Ihn zertreten'), s: _t('Kampf'), go: () => { eFight(E, ['slime', 'slime', 'toxslime', 'slime'], { name: _t('Pilzwache') }, () => [{ t: 'gold', n: eGold(E, 2) }, { t: 'mat', k: 'kristall', n: 2 }], _t('Das Pilzreich hat verloren – diesmal.')); eFx(E, 'dmg', -.1, 120, _t('Sporenfluch'), 1); encRes(E, _t('„Wie unhöflich!“ Aus dem Boden quellen seine Wachen.')); } }] });

eDef('kartograf', { n: _t('Der Kartograf im Nebel'), pic: ['sp', 'wizard', 'rgba(210,210,230,.55)'], c: '#e8dcc0', hint: _t('Er zeichnet Karten von Orten, die du noch nicht kennst.'),
  intro: () => [_t('Im Nebel sitzt ein durchscheinender Mann und zeichnet. Seine Karten zeigen die Endlosen Lande – auch Teile, die noch niemand betreten hat.'), _t('„Ich tausche“, sagt er, ohne aufzusehen. „Eine Geschichte gegen eine Richtung.“')],
  ch: E => [{ t: _t('Ihm eine Geschichte erzählen'), go: () => { const a = eReveal(E), b = Math.random() < .5 ? ' ' + eReveal(E) : ''; encRes(E, _t('Er hört zu, nickt und zeichnet zwei Kreise auf deine Karte.') + ' ' + a + b); } },
    { t: _t('Eine Karte kaufen – {n} Gold', { n: fmt(eGold(E, 2)) }), ok: P.gold >= eGold(E, 2) ? true : _t('Zu wenig Gold'), go: () => { P.gold -= eGold(E, 2); encRes(E, _t('Die Tinte ist noch feucht. Ein Ort ist rot umkreist.') + ' ' + eReveal(E)); } },
    { t: _t('Ihn in Ruhe lassen'), go: () => encRes(E, _t('Er zeichnet weiter. Als du zurückblickst, ist auch dein Weg auf seiner Karte.')) }] });

eDef('waechter', { n: _t('Der Uralte Wächter'), art: 'golem', c: '#57c7e6', bio: ['ruine', 'fels', 'kristall'], hint: _t('Er bewacht ein Tor, dessen Losung in alten Geschichten steht.'),
  intro: () => [_t('Ein steinerner Riese steht vor einer Tür im Fels. Seine Augen glimmen blau. „LOSUNG“, verlangt er.')],
  ch: E => [{ t: _t('Die Losung nennen'), s: arteFound() >= 15 ? _t('Du kennst genug alte Geschichten') : _t('Wer viele Artefakte gelesen hat, kennt sie'), go: () => { if (arteFound() >= 15) encRes(E, _t('Du nennst ein Wort aus einer der alten Geschichten. Der Wächter tritt zur Seite. Hinter der Tür: ein vergessener Hort.'), [eItem(E, 3, 2), { t: 'gold', n: eGold(E, 6) }]); else { eFight(E, ['golem'], { elite: true, name: _t('Uralter Wächter'), hpMul: 1.5 }, () => [eItem(E, 3, 1), { t: 'gold', n: eGold(E, 4) }], _t('Der Wächter zerfällt. Die Tür steht offen.')); encRes(E, _t('„FALSCH.“ Der Riese hebt die Fäuste.')); } } },
    { t: _t('Angreifen'), s: _t('Elite-Kampf'), go: () => { eFight(E, ['golem'], { elite: true, name: _t('Uralter Wächter'), hpMul: 1.5 }, () => [eItem(E, 3, 1), { t: 'gold', n: eGold(E, 4) }], _t('Der Wächter zerfällt. Die Tür steht offen.')); encRes(E, _t('Stein knirscht. Der Wächter erwacht ganz.')); } },
    { t: _t('Umkehren'), go: () => encRes(E, _t('„KOMM WIEDER, WENN DU MEHR WEISST“, ruft er dir nach.')) }] });

eDef('barde', { n: _t('Der Spielmann'), pic: ['sp', 'elf', 'rgba(255,200,90,.2)'], c: '#ffd24a', hint: _t('Er singt an jedem Lagerfeuer – auch an fremden.'),
  intro: () => [_t('Am Wegrand sitzt ein Spielmann mit einer Laute, der eine Saite fehlt. „Ein Lied, Fremder? Ich singe von Helden. Manchmal sogar von echten.“')],
  ch: E => { const p = eGold(E, 1), comp = aComplete(); return [
    { t: _t('Ein Lied über dich erbitten'), ok: comp ? true : _t('Er kennt noch keine Geschichte von dir'), go: () => { eFx(E, 'dmg', .12, 300, _t('Heldenlied')); encRes(E, _t('Er singt von „{t}“ – deiner Geschichte. Du wusstest nicht, dass du so mutig warst.', { t: aChain(aStarted().find(c => aDone(c) && aOpened(c))).title })); } },
    { t: _t('Ein Lied bezahlen – {n} Gold', { n: fmt(p) }), ok: P.gold >= p ? true : _t('Zu wenig Gold'), go: () => { P.gold -= p; eFx(E, 'xp', .25, 300, _t('Lied der Lehre')); encRes(E, _t('Ein Lied über alte Kämpfe. Du lernst mehr daraus als aus manchem Buch.')); } },
    { t: _t('Mitsingen'), go: () => Math.random() < .5 ? (eFx(E, 'aspd', .15, 180, _t('Im Takt')), encRes(E, _t('Ihr singt zu zweit, und deine Hände finden einen neuen Takt.'))) : encRes(E, _t('Er hört höflich zu und schweigt danach sehr lange.')) }]; } });

eDef('blutaltar', { n: _t('Der Blutmond-Altar'), art: 'altar', c: '#c8342c', bio: ['schatten', 'heiss', 'ruine'], d0: .01, hint: _t('Er erwacht, wenn der Mond rot ist.'),
  intro: () => [_t('Ein schwarzer Altar, darauf eine Schale, die nach Blut verlangt. Über dir färbt sich der Mond rot.')],
  ch: E => [{ t: _t('Blut opfern'), s: _t('30 % Leben gegen große Kraft'), go: () => { eHurt(.3); eFx(E, 'dmg', .3, 240, _t('Blutmondkraft')); eFx(E, 'leech', .03, 240, _t('Blutdurst')); encRes(E, _t('Die Schale trinkt. Rote Kraft brennt in deinen Adern.')); } },
    { t: _t('Den Altar zerstören'), s: _t('Kampf'), go: () => { eFight(E, ['imp', 'chort', 'imp'].concat(E.dep > .05 ? ['lavadaemon'] : []), { name: _t('Altardiener') }, () => [{ t: 'gem', k: randomGem(E.st + 8) }, { t: 'gold', n: eGold(E, 3) }], _t('Der Altar ist zerstört.')); encRes(E, _t('Der Stein zerbricht – und aus den Rissen kriechen seine Diener.')); } },
    { t: _t('Weggehen'), go: () => encRes(E, _t('Hinter dir tropft es in die Schale. Du drehst dich nicht um.')) }] });

eDef('zwerg', { n: _t('Der verirrte Zwerg'), pic: ['sp', 'dwarf'], c: '#e8b04a', bio: ['fels', 'kristall'], hint: _t('Er sucht seinen Stollen zwischen den Felsen.'),
  intro: () => [_t('Ein Zwerg mit erloschener Grubenlampe flucht leise vor sich hin. „Mein Stollen! Gestern war er noch hier. Und jetzt? Felsen! Nur Felsen!“')],
  ch: E => [{ t: _t('Ihm beim Suchen helfen'), s: _t('Stollenkriecher lauern'), go: () => { eFight(E, ['wurm', 'slime', 'wurm'], { name: _t('Stollenkriecher') }, () => { aFx('wdmg', .15, 300, _t('Geschärfte Klinge')); return [{ t: 'mat', k: E.dep > .1 ? 'adamant' : 'mithril', n: 2 }, { t: 'mat', k: 'erz', n: 6 }]; }, _t('Der Zwerg schärft zum Dank deine Klinge.')); encRes(E, _t('Ihr findet den Stollen – und das, was ihn verschüttet hat.')); } },
    { t: _t('Ihm den Weg beschreiben'), go: () => encRes(E, _t('„Hmpf. Danke.“ Er drückt dir ein paar Erzbrocken in die Hand und stapft davon.'), [{ t: 'mat', k: 'erz', n: 4 }]) },
    { t: _t('Weitergehen'), go: () => encRes(E, _t('Sein Fluchen begleitet dich noch eine ganze Weile.')) }] });

eDef('glocke', { n: _t('Die versunkene Glocke'), art: 'glocke', c: '#57a7d6', bio: ['sumpf', 'wasser'], hint: _t('Sie läutet unter Wasser.'),
  intro: () => [_t('Aus dem dunklen Wasser ragt eine bronzene Glocke. Ein Seil hängt daran, nass und grün. Man sagt, sie rufe die Ertrunkenen.')],
  ch: E => [{ t: _t('Die Glocke läuten'), s: _t('Die Toten kommen'), go: () => { eFight(E, ['zombie', 'skeleton', 'skeleton', 'geist'].slice(0, 3 + (E.dep > .04 ? 1 : 0)), { name: _t('Ertrunkener') }, () => [eItem(E, 2, 2), { t: 'gold', n: eGold(E, 4) }], _t('Die Ertrunkenen ruhen. Sie haben dir hinterlassen, was sie mit in die Tiefe nahmen.')); encRes(E, _t('Ein dumpfer Ton rollt über das Wasser. Dann steigen sie heraus, einer nach dem anderen.')); } },
    { t: _t('Die Glocke heben'), go: () => { eFx(E, 'spd', -.1, 120, _t('Nasse Kleider'), 1); encRes(E, _t('Mit viel Mühe zerrst du sie ans Ufer. Bronze ist Bronze.'), [{ t: 'gold', n: eGold(E, 3) }]); } },
    { t: _t('Weitergehen'), go: () => encRes(E, _t('Als du gehst, läutet sie leise. Von ganz allein.')) }] });

eDef('nest', { n: _t('Das Riesennest'), art: 'nest', c: '#e8dcc0', bio: ['fels', 'wald', 'sturm'], hint: _t('Hoch oben, wo der Wind wohnt.'),
  intro: () => [_t('Ein Nest, groß wie ein Wagen, aus ganzen Baumstämmen geflochten. Darin liegen zwei Eier. Die Mutter ist nicht da. Noch nicht.')],
  ch: E => [{ t: _t('Ein Ei nehmen'), s: _t('Die Mutter kommt zurück'), go: () => { eFight(E, [EN.jungdrache && E.st >= 14 ? 'jungdrache' : 'ogre'], { elite: true, name: _t('Nestmutter') }, () => [{ t: 'gold', n: eGold(E, 3) }], _t('Die Nestmutter ist geflohen.')); encRes(E, _t('Das Ei ist warm. Hinter dir verdunkelt ein Schatten den Himmel.'), [{ t: 'egg', luck: 2 + E.dep * 8 }]); } },
    { t: _t('Das Nest in Ruhe lassen'), go: () => { eFx(E, 'regen', Math.max(1, P.st.hp * .01), 300, _t('Segen der Wildnis')); encRes(E, _t('Du gehst weiter. Später hörst du über dir einen Schrei – es klingt beinahe wie ein Dank.'), [{ t: 'xp', n: 25 + E.st * 10 }]); } }] });

eDef('toter', { n: _t('Der tote Schatzsucher'), art: 'toter', c: '#e8dcc0', hint: _t('Nicht jeder kehrt aus den Landen zurück.'),
  intro: () => [_t('Ein Skelett lehnt an einem Felsen, die Hand um eine zerknitterte Karte gekrallt. Daneben ein Rucksack, halb verrottet.')],
  ch: E => [{ t: _t('Die Karte nehmen'), go: () => encRes(E, _t('Die Karte zeigt mehr als Wege. Jemand hat Notizen an den Rand gekritzelt.') + ' ' + eReveal(E)) },
    { t: _t('Ihn begraben'), go: () => { eFx(E, 'dr', .08, 300, _t('Frieden des Toten')); encRes(E, _t('Du schichtest Steine über ihn. Als du fertig bist, liegt die Karte trotzdem in deiner Tasche. Seltsam.') + ' ' + eReveal(E)); } },
    { t: _t('Den Rucksack durchsuchen'), go: () => Math.random() < .3 ? (eFx(E, 'loot', -.15, 180, _t('Fluch des Toten'), 1), encRes(E, _t('Gold – und ein kalter Hauch im Nacken.'), [{ t: 'gold', n: eGold(E, 4) }])) : encRes(E, _t('Ein paar Münzen und etwas, das er nicht mehr braucht.'), [{ t: 'gold', n: eGold(E, 2) }, eItem(E, 1, 1)]) }] });

eDef('echo', { n: _t('Das Echo von Pyraxis'), pic: ['sp', 'demon', 'rgba(255,80,20,.35)'], c: '#ff6a2a', bio: ['heiss', 'schatten'], d0: .03, hint: _t('Wo die Erde glüht, erinnert sich die Welt an den Drachen.'),
  intro: () => [_t('Aus der Glut formt sich ein riesiger Schatten mit Hörnern. Es ist nicht Pyraxis – nur seine Erinnerung, die der Boden nicht vergessen kann.'), _t('„Kleiner Funke“, grollt das Echo. „Einst hat mich jemand wie du besiegt. Aber das Feuer, das ich war, brennt noch überall.“')],
  ch: E => [{ t: _t('Zuhören'), go: () => { eFx(E, 'burnW', .2, 300, _t('Drachenglut')); encRes(E, _t('Das Echo erzählt vom ersten Feuer, von Zwergen und vom Orden. Dann zerfällt es zu Funken, die in deine Waffe springen.'), [{ t: 'xp', n: 60 + E.st * 20 }]); } },
    { t: _t('Das Echo verjagen'), s: _t('Kampf'), go: () => { eFight(E, ['imp', 'imp', 'lavadaemon', 'chort'], { name: _t('Glutfunke') }, () => [{ t: 'gem', k: randomGem(E.st + 10) }, { t: 'mat', k: 'glut', n: 3 }], _t('Das Echo ist verstummt.')); encRes(E, _t('„Wie du willst.“ Das Echo zerstiebt – in viele kleine, wütende Funken.')); } }] });

/* ---------- Ablauf: würfeln, öffnen, wählen, Ergebnis ---------- */
// Pro Ausflug ein eigener Würfel (Ausflug = solange die Lande offen sind); die Welt kann ctx.trip mitgeben
const AT = { seed: 0, on: false, roll: new Map(), done: new Set(), n: 0 };
function aTripNew(seed) { AT.seed = seed != null ? seed | 0 : (Date.now() ^ Math.floor(Math.random() * 1e9)) | 0; AT.roll.clear(); AT.done.clear(); AT.n = 0; }
function aTrip(ctx) {
  const t = ctx && (ctx.trip != null ? ctx.trip : ctx.tripSeed);
  if (t != null && (t | 0) !== AT.seed) aTripNew(t);
  const on = typeof landeActive === 'function' ? !!landeActive() : true;
  if (t == null && on && !AT.on) aTripNew(); AT.on = on;
  return AT;
}
function aCatOf(bk) {
  const B = typeof LANDE_BIOMES !== 'undefined' && LANDE_BIOMES ? LANDE_BIOMES[bk] : null;
  const hay = (String(bk || '') + ' ' + (B ? [B.n, B.name, B.pool, B.amb, B.deco].filter(Boolean).join(' ') : '')).toLowerCase();
  for (const [k, re] of ATERR) if (re.test(hay)) return k; return 'x';
}
function encounterRoll(ctx) {
  try {
    if (!ctx || !isFinite(ctx.cx) || !isFinite(ctx.cy)) return null;
    aSeen(ctx); const T = aTrip(ctx), cx = ctx.cx | 0, cy = ctx.cy | 0, key = aKey(cx, cy);
    if (T.done.has(key)) return null; if (T.roll.has(key)) return T.roll.get(key);
    const d0 = Math.hypot(cx + .5 - AGATE, cy + .5 - AGATE), dep = isFinite(ctx.depth) ? clamp(+ctx.depth, 0, 1) : clamp(d0 / AWR, 0, 1), M = aLocal();
    let res = null;
    if (d0 >= 3 && T.n < 4) {
      const R = mulberry(aH(20, cx, cy, T.seed)), first = !!M && !Object.keys(M.enc).some(k => M.enc[k] > 0);
      if (R() < (first ? .05 : .013 + Math.min(.012, dep * .03))) {
        const cat = aCatOf(ctx.biome), W = {};
        for (const k in ENCD) { const D = ENCD[k]; if (dep < (D.d0 || 0) || (D.once && M && M.enc[k]) || (D.only && !D.bio.includes(cat))) continue; W[k] = (D.w || 1) * (D.bio && D.bio.includes(cat) ? 3 : 1) * (D.bio && !D.bio.includes('x') && !D.bio.includes(cat) && cat !== 'x' ? .35 : 1); }
        const k = wpick(W, R);
        if (k && ENCD[k]) { res = { key: k, x: cx * ACK + 120 + Math.floor(R() * (ACK - 240)), y: cy * ACK + 120 + Math.floor(R() * (ACK - 240)), cx, cy, depth: dep, name: ENCD[k].n, c: ENCD[k].c, icon: encPicURL(k) }; T.n++; }
      }
    }
    T.roll.set(key, res); return res;
  } catch (e) { console.error('Begegnung (Wurf):', e); return null; }
}
let ENCU = null;   // laufende Begegnung
function encounterOpen(enc) {
  try {
    if (!enc || !ENCD[enc.key] || !P) return false;
    const D = ENCD[enc.key], M = aLocal();
    if (M) { M.enc[enc.key] = (M.enc[enc.key] || 0) + 1; persist(); }
    if (isFinite(enc.cx)) AT.done.add(aKey(enc.cx | 0, enc.cy | 0));
    const dep = isFinite(enc.depth) ? clamp(+enc.depth, 0, 1) : aDepth();
    const E = ENCU = { k: enc.key, D, enc, dep, st: aStage(), after: [], fx: [], back: state === 'play' ? 'play' : 'none' };
    aPauseGame(); stat('arteEnc');
    encShow(E, D.intro(E), D.ch(E));
    sfx('cast');
    return true;
  } catch (e) { console.error('Begegnung (Öffnen):', e); return false; }
}
const ENCPIC = {};
function encPicURL(k) {
  if (ENCPIC[k]) return ENCPIC[k]; const D = ENCD[k]; if (!D) return '';
  try { if (D.pet && typeof petImgURL === 'function' && typeof PET_SP !== 'undefined' && PET_SP[D.pet]) { const u = petImgURL(D.pet, 5, 0, false, false); if (u && u.url) return ENCPIC[k] = u.url; } if (D.pic) return ENCPIC[k] = iconURL(D.pic); const c = aEncArt(D.art || k); return ENCPIC[k] = mk(c.width + 2, c.height + 2, g => g.drawImage(c, 1, 1)).toDataURL(); } catch (e) { return ENCPIC[k] = arteIconURL('rune', 0); }
}
function encShow(E, lines, choices) {
  E.cur = choices;
  const D = E.D;
  showOverlay(`<div class="head"><h2>${esc(D.n.toLocaleUpperCase(LOCALE))}</h2><div class="hbtns"><span class="pill dim">${_t('BEGEGNUNG')}</span></div></div>
  <div class="encw"><div class="encp" style="--c:${D.c}"><img src="${encPicURL(E.k)}" alt=""></div><div class="enct">${lines.map(l => `<p>${esc(l)}</p>`).join('')}</div></div>
  <div class="menu encch">${choices.map((c, i) => { const no = c.ok === false || typeof c.ok === 'string'; return `<button class="btn${i ? ' alt' : ''}" data-act="enc_ch" data-i="${i}" ${no ? 'disabled' : ''}>${esc(c.t)}${c.s || typeof c.ok === 'string' ? `<small>${esc(typeof c.ok === 'string' ? c.ok : c.s)}</small>` : ''}</button>`; }).join('')}</div>`);
}
function encRes(E, txt, list) {
  E.cur = null; E.res = { txt };
  const rows = list && list.length ? aGiveAll(list, { drop: aCanFight() }) : '';
  const fx = E.fx.map(f => `<span class="encfx${f.bad ? ' bad' : ''}">${esc(f.n)} · ${_t('{n} Min.', { n: Math.max(1, Math.round(f.sec / 60)) })}</span>`).join('');
  showOverlay(`<div class="head"><h2>${esc(E.D.n.toLocaleUpperCase(LOCALE))}</h2></div>
  <div class="encw res"><div class="encp" style="--c:${E.D.c}"><img src="${encPicURL(E.k)}" alt=""></div><div class="enct"><p>${esc(txt)}</p>${fx ? `<div class="encfxs">${fx}</div>` : ''}</div></div>${rows}
  <div class="menu foot"><button class="btn" data-act="enc_ok">${_t('Weiter')}</button></div>`);
  if (P && SAVE.active >= 0) saveChar(); persist();
}
function encEnd() {
  const E = ENCU; ENCU = null; if (!E) { aBack('play'); return; }
  aBack(E.back);
  for (const f of E.after) { try { f(); } catch (e) { console.error('Begegnung (danach):', e); } }
  try { if (E.enc && typeof E.enc.done === 'function') E.enc.done(E.res || {}); } catch (_) { }
}
ON.enc_ch = (id, b, i) => { const E = ENCU; if (!E || !E.cur || !E.cur[i]) return; const c = E.cur[i]; if (c.ok === false || typeof c.ok === 'string') return; sfx('click'); E.cur = null; try { c.go(E); } catch (e) { console.error('Begegnung (Wahl):', e); encRes(E, _t('Der Augenblick vergeht, und mit ihm die Begegnung.')); } };
ON.enc_ok = () => { sfx('click'); encEnd(); };

/* ---------- Bilder der Begegnungen (24 × 24 Pixel) ---------- */
function aEncArt(k) {
  const b = PB(24, 24), S = ['#4a4652', '#7a7682', '#9a96a2'];
  switch (k) {
    case 'meteor': b.disc(12, 19, 9, '#2a2430'); b.disc(12, 19, 7, '#5a4a3a'); b.disc(12, 16, 4, '#8a7aa8'); b.disc(12, 16, 2.5, '#c8b8ff'); b.set(11, 15, '#ffffff'); b.line(20, 2, 14, 12, '#ffb03a'); b.line(21, 3, 15, 13, '#ff6a2a'); b.line(19, 1, 13, 11, '#fff0a0'); break;
    case 'drache': b.disc(11, 16, 8, '#6a2222'); b.disc(11, 17, 5, '#c8902a'); b.disc(18, 17, 3.6, '#7a2a2a'); b.line(17, 15, 20, 15, '#1a1420'); b.line(18, 13, 16, 10, '#e8e2cf'); b.line(20, 13, 21, 10, '#e8e2cf'); b.line(3, 16, 1, 21, '#6a2222'); for (const [x, y] of [[6, 10], [10, 9], [14, 10]]) b.set(x, y, '#3a1212'); b.rect(3, 21, 18, 2, '#e8b04a'); b.set(6, 20, '#ffe08a'); b.set(15, 21, '#ffe08a'); b.line(19, 4, 22, 4, '#efe2bf'); b.line(22, 4, 19, 7, '#efe2bf'); b.line(19, 7, 22, 7, '#efe2bf'); break;
    case 'brunnen': b.rect(5, 12, 14, 9, S[1]); b.rect(4, 11, 16, 2, S[2]); b.rect(6, 12, 12, 2, '#3a7ab8'); b.set(9, 12, '#ffd24a'); b.set(14, 13, '#ffd24a'); b.rect(5, 3, 2, 9, '#8a5a32'); b.rect(17, 3, 2, 9, '#8a5a32'); b.rect(3, 2, 18, 2, '#b07a48'); b.rect(12, 4, 1, 4, '#c8b48a'); b.rect(11, 8, 3, 3, '#8a5a32'); for (const x of [7, 11, 15]) b.rect(x, 15, 1, 5, S[0]); break;
    case 'feenring': for (let i = 0; i < 9; i++) { const a = i / 9 * 6.283, x = Math.round(12 + Math.cos(a) * 9), y = Math.round(15 + Math.sin(a) * 5); b.rect(x - 1, y - 2, 3, 1, '#c8342c'); b.set(x, y - 3, '#c8342c'); b.set(x, y - 1, '#e8e2cf'); b.set(x - 1, y - 2, '#ff8a7a'); } for (const [x, y, c] of [[10, 10, '#ffe08a'], [14, 13, '#b892f4'], [12, 7, '#ffffff'], [8, 14, '#f786a0']]) b.set(x, y, c); break;
    case 'schwert': b.disc(12, 20, 7, S[1]); b.rect(4, 19, 16, 4, S[1]); b.rect(5, 19, 14, 1, S[2]); b.rect(11, 8, 2, 12, '#c8d0dc'); b.rect(11, 8, 1, 12, '#ffffff'); b.rect(8, 7, 8, 2, '#e8b04a'); b.rect(11, 2, 2, 5, '#5e3a1e'); b.disc(12, 2, 1.5, '#e8b04a'); b.set(12, 12, '#57c7e6'); b.set(11, 12, '#1a1420'); break;
    case 'sphinx': b.rect(3, 13, 15, 6, '#e8b04a'); b.rect(1, 18, 6, 2, '#e8b04a'); b.rect(12, 18, 6, 2, '#e8b04a'); b.line(5, 13, 11, 7, '#c8a050'); b.line(6, 13, 12, 8, '#c8a050'); b.disc(18, 10, 3.2, '#d8a870'); b.rect(15, 5, 7, 3, '#57a7d6'); b.rect(15, 6, 7, 1, '#ffd24a'); b.rect(15, 8, 1, 5, '#57a7d6'); b.rect(21, 8, 1, 5, '#57a7d6'); b.set(17, 10, '#1a1420'); b.set(19, 10, '#1a1420'); b.rect(19, 15, 2, 4, '#c8902a'); break;
    case 'hirsch': b.rect(6, 11, 11, 5, '#e8b04a'); b.rect(7, 16, 2, 5, '#c8902a'); b.rect(14, 16, 2, 5, '#c8902a'); b.rect(15, 7, 3, 5, '#e8b04a'); b.rect(16, 5, 5, 3, '#e8b04a'); b.set(19, 6, '#1a1420'); b.line(17, 5, 14, 1, '#ffe08a'); b.line(15, 3, 13, 3, '#ffe08a'); b.line(19, 5, 22, 1, '#ffe08a'); b.line(21, 3, 23, 3, '#ffe08a'); b.rect(6, 11, 11, 1, '#ffe08a'); b.set(5, 12, '#fff3c0'); break;
    case 'grab': b.rect(8, 6, 8, 12, S[1]); b.disc(12, 6, 4, S[1]); b.rect(11, 6, 2, 7, S[0]); b.rect(9, 8, 6, 2, S[0]); b.rect(3, 18, 18, 4, '#5a4a3a'); b.rect(4, 17, 16, 1, '#6a5a4a'); b.rect(18, 9, 1, 9, '#c8d0dc'); b.rect(17, 11, 3, 1, '#e8b04a'); b.set(6, 17, '#79c24e'); b.set(15, 17, '#79c24e'); break;
    case 'irrlicht': for (const [x, y, r] of [[6, 9, 2.6], [17, 6, 2.2], [13, 16, 3.2], [20, 15, 1.8]]) { b.disc(x, y, r, '#57c7e6'); b.disc(x, y, r * .55, '#c8f0ff'); } b.set(13, 15, '#ffffff'); break;
    case 'riss': for (let y = 1; y < 23; y++) { const x = Math.round(12 + Math.sin(y * .8) * 3); b.rect(x - 2, y, 5, 1, '#3a1a5a'); b.rect(x - 1, y, 3, 1, '#8a4ad8'); b.set(x, y, '#e0c8ff'); } for (const [x, y] of [[4, 5], [20, 8], [5, 18], [19, 19]]) b.set(x, y, '#ffffff'); break;
    case 'steinkreis': for (const [x, y, h] of [[2, 10, 9], [7, 7, 11], [14, 7, 11], [19, 10, 9], [10, 13, 8]]) { b.rect(x, y, 3, h, S[1]); b.rect(x, y, 1, h, S[2]); b.set(x + 1, y + 3, '#57c7e6'); } b.rect(1, 21, 22, 1, '#3a5a2a'); break;
    case 'lampe': b.rect(5, 15, 12, 4, '#e8b04a'); b.disc(10, 15, 4, '#e8b04a'); b.line(16, 16, 21, 12, '#e8b04a'); b.line(16, 17, 21, 13, '#c8902a'); b.disc(4, 16, 2, '#9c6a24'); b.rect(9, 10, 3, 2, '#ffe08a'); b.rect(6, 19, 9, 1, '#9c6a24'); b.disc(20, 8, 2.2, '#b892f4'); b.disc(17, 4, 2.6, '#c8b8ff'); b.set(8, 13, '#fff3c0'); break;
    case 'pilz': b.disc(12, 10, 8.5, '#8a5ac8'); b.rect(3, 11, 19, 3, null); for (let x = 2; x < 23; x++) for (let y = 11; y < 14; y++) aErase(b, x, y); b.rect(4, 10, 16, 1, '#6a3aa8'); for (const [x, y] of [[8, 5], [14, 4], [17, 8], [6, 8]]) b.disc(x, y, 1.2, '#ffffff'); b.rect(9, 11, 6, 10, '#e8e2cf'); b.set(10, 14, '#1a1420'); b.set(13, 14, '#1a1420'); b.rect(9, 0, 6, 2, '#ffd24a'); b.set(9, 0, null); b.set(11, 0, '#fff3c0'); b.rect(5, 21, 14, 1, '#5a3a2a'); break;
    case 'golem': b.rect(6, 8, 12, 10, S[1]); b.rect(9, 2, 6, 6, S[2]); b.set(10, 4, '#57c7e6'); b.set(13, 4, '#57c7e6'); b.rect(2, 9, 4, 9, S[0]); b.rect(18, 9, 4, 9, S[0]); b.rect(7, 18, 4, 5, S[0]); b.rect(13, 18, 4, 5, S[0]); b.rect(11, 10, 2, 5, '#57c7e6'); b.rect(10, 12, 4, 1, '#57c7e6'); b.set(7, 9, '#79c24e'); break;
    case 'salamander': for (let i = 0; i < 15; i++) b.disc(4 + i, 15 - Math.sin(i / 14 * 3.14) * 3, 2.2, i % 3 ? '#ff6a2a' : '#ffd24a'); b.disc(20, 11, 2.8, '#ff8a3a'); b.set(21, 10, '#1a1420'); b.line(3, 16, 1, 19, '#ff6a2a'); for (const x of [7, 11, 15]) b.rect(x, 17, 1, 3, '#c8401e'); for (const [x, y] of [[8, 8], [13, 7], [18, 6]]) { b.set(x, y, '#ffb03a'); b.set(x, y - 1, '#fff0a0'); } break;
    case 'altar': b.rect(5, 13, 14, 9, '#2a2430'); b.rect(4, 12, 16, 2, '#4a3a4a'); b.rect(8, 12, 8, 1, '#c8342c'); b.rect(10, 13, 1, 3, '#c8342c'); for (const x of [5, 18]) { b.rect(x, 8, 1, 4, '#e8e2cf'); b.set(x, 7, '#ffb03a'); } b.disc(17, 4, 3, '#c8342c'); b.disc(16, 3, 1.5, '#ff6a5a'); b.rect(9, 16, 6, 1, '#5a4a5a'); break;
    case 'glocke': b.disc(12, 8, 6, '#9c6a24'); b.rect(6, 8, 12, 6, '#9c6a24'); b.rect(5, 13, 14, 2, '#9c6a24'); b.rect(9, 5, 1, 8, '#e8b04a'); b.disc(12, 16, 1.6, '#5a4a3a'); b.rect(11, 0, 2, 2, '#5a4a3a'); b.rect(1, 18, 22, 4, '#2a4a6a'); b.rect(1, 18, 22, 1, '#57a7d6'); b.set(7, 19, '#5a8a3a'); b.set(16, 20, '#5a8a3a'); break;
    case 'nest': b.rect(2, 15, 20, 6, '#6a4224'); b.rect(3, 14, 18, 1, '#8a5a32'); for (const x of [4, 9, 14, 19]) b.line(x, 14, x + 3, 20, '#4e3018'); b.disc(9, 12, 3.2, '#efe2bf'); b.disc(15, 12, 3.2, '#e8d8a8'); b.set(15, 11, '#b892f4'); b.set(8, 11, '#ffffff'); break;
    case 'toter': b.rect(3, 9, 9, 7, '#e8dcc0'); b.rect(6, 9, 1, 7, '#c8b48a'); b.line(8, 11, 10, 13, '#c8342c'); b.line(10, 11, 8, 13, '#c8342c'); b.disc(17, 12, 3.4, '#e8e2cf'); b.set(16, 12, '#1a1420'); b.set(18, 12, '#1a1420'); b.rect(12, 17, 10, 2, '#d8d0bc'); for (let i = 0; i < 4; i++) b.rect(13 + i * 2, 14, 1, 3, '#c8c0aa'); b.rect(2, 19, 9, 3, '#6a4224'); break;
    default: b.disc(12, 12, 8, '#57c7e6');
  }
  return pbCanvas(pbOutline(b));
}

/* ---------- Andockstellen im Spiel ---------- */
// Werte: Wissen der Chronik, Segen und Flüche, Fluch der Spiegelklinge
HOOK.stats.push(add => {
  try {
    const b = aBonus(); if (b > 0) { add('xp', b); add('gold', b); }
    for (const f of AFX) add(f.k, f.v);
    if (P && P.gear) for (const s of ['weapon', 'armor', 'helm']) { const it = P.gear[s]; if (it && it.ac) add('hp', -.15); }
  } catch (e) { console.error('Artefakte (Werte):', e); }
});
HOOK.itemLines.push((it, L) => {
  if (it.ac) L.push(_t('Fluch der Spiegelhexe: −15 % Leben, solange angelegt'));
  if (it.arte != null && it.arte >= 0 && it.arte < ARTE_NC) L.push(_t('Schatz der Spur „{t}“', { t: aChain(it.arte).title }));
});
// Segen und Flüche laufen ab (nur im Spiel), Anzeige oben links
let AFXT = 0;
HOOK.update.push(dt => {
  if (!AFX.length) return;
  if (G && G.type === 'versteck') { aFxClear(); return; }
  let gone = false; for (const f of AFX) { f.t -= dt; if (f.t <= 0) gone = true; }
  if (gone) { for (const f of AFX) if (f.t <= 0) toast(_t('{n} ist verflogen.', { n: f.n }), f.bad ? '#79c24e' : '#a8997e'); const keep = AFX.filter(f => f.t > 0); AFX.length = 0; AFX.push(...keep); if (P && P.gear) { computeStats(); P.hp = Math.min(P.hp, P.st.hp); } }
});
HOOK.room.push(type => { if (type === 'lande') { aTripNew(); ASEEN.length = 0; } else aFxClear(); });
HOOK.die.push(h => { aFxClear(); return h; });
// Wächter und Begegnungs-Gegner markieren
HOOK.spawn.push(e => { const v = ATAG.v; if (!v) return; if (v.guard != null && e.boss) e.arteGuard = v.guard; if (v.grp) { e.arteGrp = v.grp; v.grp.n++; } });
HOOK.kill.push(e => {
  try {
    if (e.arteGuard != null) { const c = e.arteGuard, M = aLocal(); e.arteGuard = null; if (M && !M.g.includes(c)) { M.g.push(c); persist(); } setTimeout(() => { if (P && !aOpened(c)) arteTreasureOpen(c, { noGuard: true }); }, 1100); }
    if (e.arteGrp) { const g = e.arteGrp; e.arteGrp = null; g.n--; if (g.n <= 0 && g.done) { const f = g.done; g.done = null; f(e); } }
  } catch (err) { console.error('Artefakte (Sieg):', err); }
});
// Selten trägt ein Gegner in den Landen den Anfang einer Spur bei sich – immer die nächste, die du noch nicht kennst
function aDropChain() {
  const B = aBits(); if (!B) return null;
  const h = aHere(), dep = aDepth(); let best = null, bd = 1e18;
  for (let c = 0; c < ARTE_NC; c++) {
    if (B.cnt[c] || pickups.some(p => p.k === 'arte' && ALAY.cOf[p.id] === c)) continue;
    const C = ALAY.ch[c], d = h ? Math.hypot(C.sites[0].x - h.x, C.sites[0].y - h.y) / ACK : Math.abs(C.dep - dep) * AWR;
    if (d < bd) { bd = d; best = c; }
  }
  return best != null && bd < 70 ? best : null;
}
HOOK.loot.push((e, lm) => {
  try {
    if (typeof landeActive !== 'function' || !landeActive() || !P || e.arteGrp) return;
    const p = (e.boss ? .12 : e.elite ? .025 : .0015) * clamp(+lm || 1, .5, 3);
    if (Math.random() >= p) return;
    const c = aDropChain(); if (c == null) return;
    pickups.push({ k: 'arte', id: ALAY.ch[c].off, x: e.x, y: e.y, z: 8, vz: 130, vx: rnd(-30, 30), vy: rnd(-15, 15), t: 0 });
  } catch (err) { console.error('Artefakte (Beute):', err); }
});
// Auflesen am Boden: sofort ins Wissen (Artefakte gehen nie verloren)
HOOK.collect.push((h, c) => { if (h || !c || c.k !== 'arte') return h; c.got = true; setTimeout(() => artePickup(c.id), 0); return true; });
// Artefakt am Boden zeichnen – und für die Welt: arteDrawSite(Fundstelle, x, y) an Bildschirm-Koordinaten
const ACAN = {};
function aCan(kind, v) { const k = kind + ':' + v; return ACAN[k] || (ACAN[k] = aIconCanvas(kind, v)); }
function arteSiteCanvas(site) { const d = site && arteDef(site.id); return d ? aCan(d.kind, aChain(d.chain).col[d.idx]) : aCan('truhe', 0); }
function arteDrawSite(site, x, y) {
  if (!site) return; const tr = site.chain != null && site.id != null && String(site.id)[0] === 'T', img = tr ? aCan(site.ready ? 'truhe' : 'siegel', 0) : arteSiteCanvas(site), bob = Math.round(Math.sin(T * 3 + x * .1) * 1.5);
  ctx.fillStyle = 'rgba(0,0,0,.3)'; ctx.beginPath(); ctx.ellipse(x, y, 7, 2.6, 0, 0, 6.283); ctx.fill();
  ctx.fillStyle = tr ? (site.ready ? 'rgba(255,190,80,.22)' : 'rgba(200,60,50,.18)') : 'rgba(255,230,150,.2)'; ctx.fillRect(x - 3, y - 26, 6, 26);
  ctx.drawImage(img, Math.round(x - img.width / 2), Math.round(y - img.height - 4 + (tr ? 4 : bob)));
  if (typeof addLight === 'function') addLight(x, y - 8, tr ? 34 : 24, .8);
  if (Math.random() < .25 && typeof part === 'function') part(x + CX + rnd(-6, 6), y + CY, rnd(4, 16), 0, 0, rnd(10, 24), tr ? '#ffb03a' : '#ffe08a', .6, 1, -6, 1);
}
HOOK.draw.push(list => { for (const c of pickups) if (c.k === 'arte') { c.di = c.di || { y: 0, draw: () => { const d = arteDef(c.id); if (!d) return; const img = aCan(d.kind, aChain(d.chain).col[d.idx]), x = Math.round(c.x - CX), y = Math.round(c.y - CY), z = Math.round(c.z + Math.sin(c.t * 5) * 1.5 + 2); ctx.drawImage(img, x - img.width / 2, y - z - img.height + 2); if (typeof addLight === 'function') addLight(x, y - 8, 22, .8); if (Math.random() < .2) part(c.x + rnd(-5, 5), c.y, rnd(4, 14), 0, 0, 16, '#ffe08a', .5, 1, -4, 1); } }; c.di.y = c.y; list.push(c.di); } });
// Zugänge: Kartenmenü „Mehr“, Bibliothek im Versteck, Pause in den Landen
HOOK.mapMore.push(() => `<button class="btn alt" data-act="arte_chron" data-id="map">${_t('Chronik der Artefakte')} · ${aNum(arteFound())}</button>`);
HOOK.station.push((h, id) => {
  if (h || id !== 'bibliothek') return h;
  if (typeof stTab !== 'undefined' && stTab === 'arte') { arteChronik('lib', 'spuren'); return true; }
  queueMicrotask(() => { const t = panel.querySelector('.tabs'); if (t && !t.querySelector('[data-id="arte"]')) t.insertAdjacentHTML('beforeend', `<button class="tab" role="tab" aria-selected="false" data-act="ltab" data-id="arte">${_t('ARTEFAKTE {n}', { n: aNum(arteFound()) })}</button>`); });
  return h;
});
const AFXD = document.createElement('div'); AFXD.id = 'arfx'; AFXD.hidden = true; document.body.appendChild(AFXD);
let AFXK = '';
HOOK.postRender.push(() => {
  const on = AFX.length && state === 'play';
  if (on) { if ((AFXT -= dt0) <= 0) { AFXT = .5; const k = AFX.map(f => `<span class="${f.bad ? 'bad' : ''}">${esc(f.n)} ${Math.max(0, Math.ceil(f.t))}s</span>`).join(''); if (k !== AFXK) { AFXK = k; AFXD.innerHTML = k; } } AFXD.hidden = false; } else if (!AFXD.hidden) AFXD.hidden = true;
  if (state === 'pause' && typeof landeActive === 'function' && landeActive() && !ov.hidden && !panel.querySelector('[data-act="arte_chron"]')) { const m = panel.querySelector('.menu'); if (m) m.insertAdjacentHTML('beforeend', `<button class="btn alt" data-act="arte_chron" data-id="pause">${_t('Chronik der Artefakte')}</button>`); }
});

/* ---------- Prüfen ohne Welt (Tests, Entwicklung) ---------- */
const arteDebug = {
  read: id => { if (!aHas(id)) aSetBit('f', id); return arteRead(id, 'none'); },
  find: list => { for (const id of [].concat(list)) aSetBit('f', id); persist(); return arteFound(); },
  chain: c => { const C = aChain(c); for (let i = 0; i < C.L; i++) aSetBit('f', C.off + i); persist(); return C; },
  chron: tab => arteChronik('none', tab || 'spuren'),
  enc: key => encounterOpen({ key, x: 0, y: 0, depth: aDepth() }),
  treasure: c => arteTreasureOpen(c, { noGuard: true, back: 'none' }),
  reset: () => { const M = aLocal(); if (M) Object.assign(M, aMetaFix(null)); AB.src = null; persist(); }
};

/* ---------- Aussehen ---------- */
const ATORN = (() => { const R = mulberry(77), t = [], b = []; for (let i = 0; i <= 32; i++) { const x = (i / 32 * 100).toFixed(1); t.push(`${x}% ${(R() * 5).toFixed(1)}px`); b.push(`${(100 - i / 32 * 100).toFixed(1)}% calc(100% - ${(R() * 5).toFixed(1)}px)`); } return 'polygon(' + t.concat(b).join(',') + ')'; })();
document.head.insertAdjacentHTML('beforeend', `<style>
#arfx{zoom:var(--ui);position:fixed;left:max(16px,var(--sal));top:calc(var(--sat) + 58px);z-index:5;display:flex;flex-wrap:wrap;max-width:calc(50vw / var(--ui) - 20px);gap:3px;pointer-events:none;font-family:var(--f-display);font-size:7px}
#arfx span{background:rgba(17,14,23,.84);padding:4px 6px;color:#ffd24a;box-shadow:0 0 0 2px var(--night);text-shadow:1px 1px 0 #000;white-space:nowrap}
#arfx span.bad{color:#ff8a7a}
.arnew,.arms{font-family:var(--f-display);font-size:8px;line-height:1.5;color:var(--night);background:var(--gold);padding:7px 8px;margin:0 0 8px;text-align:center;animation:pop .3s steps(3)}
.arms{background:#ffb03a}
.arw{display:grid;gap:10px}
.arside{display:flex;gap:10px;align-items:center;min-width:0}
.armeta{min-width:0}
.aric{width:64px;height:64px;flex:none;display:grid;place-items:center;background:radial-gradient(circle,#4a3e5a,#17121e 70%);box-shadow:0 0 0 2px var(--night),0 0 0 3px var(--gold-dk);animation:arglow 2s steps(4) infinite}
.aric img{width:54px;height:54px;image-rendering:pixelated}
@keyframes arglow{50%{box-shadow:0 0 0 2px var(--night),0 0 0 3px var(--gold),0 0 14px 2px rgba(232,176,74,.45)}}
.arnm{font-size:21px;line-height:1;color:var(--gold)}
.arch{font-size:17px;line-height:1.05;color:var(--rune);margin:3px 0 0}
.arpips{display:flex;gap:3px;margin-top:6px;flex-wrap:wrap;align-items:center}
.arpips i{width:9px;height:9px;background:var(--stone-hi);box-shadow:inset 0 0 0 1px #000}
.arpips i.on{background:var(--gold)}
.arpips i.cur{box-shadow:0 0 0 2px #fff}
.arpips b{width:13px;height:9px;margin-left:3px;background:#4a3a2e;box-shadow:inset 0 0 0 1px #000}
.arpips b.rdy{background:#ffb03a;animation:pulse2 .8s steps(2) infinite}
.arpips b.on{background:var(--moss)}
.arp{position:relative;background-color:#e8d6a8;color:#3a2814;padding:18px 18px 16px;font-size:21px;line-height:1.16;background-image:radial-gradient(ellipse at 25% 15%,rgba(255,250,232,.75),transparent 55%),radial-gradient(ellipse at 85% 95%,rgba(150,95,35,.35),transparent 55%),radial-gradient(circle,rgba(120,80,30,.1) 1px,transparent 1.5px);background-size:auto,auto,7px 7px;box-shadow:inset 0 0 0 2px rgba(150,110,50,.5),inset 0 0 36px rgba(110,70,20,.55);clip-path:${ATORN};transform-origin:top;animation:arun .45s steps(6) both}
@keyframes arun{from{transform:scaleY(.12)}to{transform:none}}
.arp p{margin:0}
.arp .arfund{font-size:18px;color:#6e5434;font-style:italic;margin-bottom:6px}
.arp .arframe{font-size:18px;color:#6e5434;margin-bottom:8px}
.arp.w .arbody:first-letter{font-family:var(--f-display);font-size:18px;color:#8a2a1a;padding-right:2px}
.arp .arsig{text-align:right;margin-top:8px;color:#5a3e22;padding-right:34px}
.arseal{position:absolute;right:14px;bottom:12px;width:28px;height:28px;border-radius:50%;background:radial-gradient(circle at 38% 34%,#ff7a5a,#b22a1e 55%,#6a1410);box-shadow:inset -2px -2px 0 rgba(0,0,0,.3)}
.arclue{display:grid;grid-template-columns:46px minmax(0,1fr);gap:10px;align-items:start;background:var(--stone-lo);padding:10px;box-shadow:inset 3px 0 0 var(--gold)}
.arclue.last{box-shadow:inset 3px 0 0 #ffb03a}
.arclue p{margin:0;font-size:19px;line-height:1.12}
.arclue .arsp{display:block;font-family:var(--f-display);font-weight:400;font-size:8px;color:var(--gold);margin:2px 0 5px;letter-spacing:1px}.arclue.last .arsp{color:#ffb03a}
.arp .arhint{margin-top:10px;padding:6px 8px;background:rgba(120,70,20,.12);box-shadow:inset 3px 0 0 #8a2a1a;color:#4a2a10}
.arp .arhint.v{font-style:italic}
.arcomp{width:44px;height:44px;border-radius:50%;display:grid;place-items:center;background:radial-gradient(circle,#2a2238,#0c0a12);box-shadow:0 0 0 2px var(--gold-dk)}
.arcomp img{width:30px;height:30px;image-rendering:pixelated}
.arkv{display:flex;flex-wrap:wrap;gap:4px;margin-top:7px}
.arkv span{font-size:15px;line-height:1.1;background:var(--stone);padding:3px 6px;color:var(--parch)}
@media (min-width:760px),(min-width:600px) and (orientation:landscape){.arw{grid-template-columns:230px minmax(0,1fr);align-items:start}.arside{align-items:flex-start}.armeta .arnm{font-size:19px}.arw .arp{grid-column:2;grid-row:1/span 2}.arw .arclue{grid-column:1;grid-row:2;margin-top:0;grid-template-columns:36px minmax(0,1fr);gap:8px;padding:8px}.arw .arcomp{width:34px;height:34px}.arw .arcomp img{width:24px;height:24px}.arw .arclue p{font-size:17px}}
.arfoot{grid-template-columns:1fr 1fr}.arfoot .wide{grid-column:1/-1}
@media (min-width:600px){.arfoot{grid-template-columns:2fr 1fr 1fr}.arfoot .wide{grid-column:auto}}
.artr{padding-top:4px}
.artrc{width:84px;height:84px;margin:0 auto 10px;display:grid;place-items:center;background:radial-gradient(circle,rgba(255,210,74,.45),transparent 70%);animation:arglow2 1.2s steps(4) infinite}
.artrc img{width:64px;height:64px;image-rendering:pixelated}
.artrc.seal{background:radial-gradient(circle,rgba(200,52,44,.38),transparent 70%)}
@keyframes arglow2{50%{transform:scale(1.06)}}
.arsum{background:var(--stone-lo);padding:8px 10px;margin-bottom:8px}
.arsum p{margin:5px 0 0;font-size:18px;line-height:1.1}
.arsum .arsm{font-size:16px;color:var(--parch-dim)}
.arbar{height:10px;background:var(--night);box-shadow:0 0 0 2px #000}
.arbar i{display:block;height:100%;min-width:3px;background:linear-gradient(90deg,var(--gold-dk),var(--gold))}
.archr .nm{font-size:19px;line-height:1.05}
.archr.sel{box-shadow:inset 3px 0 0 var(--gold)}
.arunk{opacity:.62}
.arunk img{filter:brightness(.25) grayscale(1)}
.artrr{box-shadow:inset 3px 0 0 #ffb03a}
.arempty{text-align:center;padding:14px 10px;background:var(--stone-lo)}
.arempty img{width:54px;image-rendering:pixelated;opacity:.7}
.arempty p{font-size:19px;line-height:1.15;margin:8px 0 12px}
.arrum{display:grid;grid-template-columns:40px minmax(0,1fr) auto;gap:10px;align-items:center;background:var(--stone-lo);padding:8px 10px;margin-bottom:6px;box-shadow:inset 3px 0 0 var(--rune)}
.arrum.on{box-shadow:inset 3px 0 0 var(--gold)}
.arrum img{width:36px;image-rendering:pixelated}
.arrum b{display:block;font-weight:400;font-size:19px;color:var(--rune);line-height:1}
.arrum p{margin:3px 0;font-size:16px;line-height:1.1}
.arrum small{font-size:14px;color:var(--parch-dim)}
@media (max-width:420px){.arrum{grid-template-columns:34px minmax(0,1fr)}.arrum .btn,.arrum .pill{grid-column:1/-1;justify-self:end}}
.arenc{display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:6px}
.arec{background:var(--stone-lo);padding:8px;display:grid;grid-template-columns:40px minmax(0,1fr);gap:3px 8px;align-items:center;box-shadow:inset 3px 0 0 var(--c)}
.arec img{width:38px;height:38px;object-fit:contain;image-rendering:pixelated;grid-row:span 2}
.arec b{font-family:var(--f-display);font-weight:400;font-size:7px;line-height:1.4;color:var(--c)}
.arec small{font-size:14px;line-height:1.05;color:var(--parch-dim)}
.arec.unk{box-shadow:inset 3px 0 0 var(--stone-hi)}
.arec.unk img{filter:brightness(0);opacity:.55}
.arec.unk b{color:var(--parch-dim)}
.encw{display:grid;grid-template-columns:96px minmax(0,1fr);gap:12px;align-items:start;background:var(--night);padding:12px;margin:4px 0 12px;box-shadow:inset 0 0 0 2px var(--stone-hi)}
.encp{width:96px;height:96px;display:grid;place-items:center;background:radial-gradient(circle,rgba(239,226,191,.12),transparent 70%);box-shadow:inset 0 -3px 0 var(--c);animation:arglow2 1.6s steps(4) infinite}
.encp img{width:80px;height:80px;object-fit:contain;image-rendering:pixelated}
.enct p{margin:0 0 8px;font-size:20px;line-height:1.15}
.enct p:last-child{margin-bottom:0}
.encch .btn small{display:block;font-family:var(--f-body);font-size:15px;line-height:1;margin-top:4px;opacity:.9}
.encfxs{display:flex;flex-wrap:wrap;gap:4px;margin-top:8px}
.encfx{font-family:var(--f-display);font-size:7px;padding:5px 6px;background:var(--moss);color:var(--night)}
.encfx.bad{background:var(--blood);color:var(--parch)}
@media (max-width:420px){.encw{grid-template-columns:72px minmax(0,1fr);padding:10px}.encp{width:72px;height:72px}.encp img{width:62px;height:62px}}
@media (max-height:540px){.arp{font-size:19px;padding:14px 16px 12px}.encw{grid-template-columns:80px minmax(0,1fr);padding:10px}.encp{width:80px;height:80px}.encp img{width:66px;height:66px}.enct p{font-size:18px}.encch{grid-template-columns:1fr 1fr}}
body.touch .encch .btn{min-height:48px}
body.touch .arpips i{width:10px;height:10px}
</style>`);
