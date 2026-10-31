'use strict';
/* =========================================================
   KLINGENHORT – Spieldaten
   Alles, was das Spiel ausmacht, steht hier als Daten.
   Neue Klassen, Gegner, Talente, Rezepte: hier ergänzen.
   ========================================================= */

const VERSION = '6.3.1';
const SAVE_KEY = 'klingenhort.v3';
const WALL = 32;

/* ---------- Effekt-Atlas (assets/fx.png) ---------- */
const FX = {"fireball":[0,0,16,16,6],"firebomb":[0,17,16,16,6],"arcane":[0,34,16,16,6],"magicorb":[0,51,16,16,6],"darkorb":[0,68,16,16,6],"darkbolt":[0,85,16,16,6],"waterbolt":[0,102,16,16,6],"plant":[0,119,16,16,6],"lightbolt":[0,136,16,16,6],"windbolt":[0,153,16,16,6],"sparks":[0,170,16,16,6],"waterorb":[0,187,16,16,6],"purebolt":[0,204,16,16,6],"icelance":[0,221,16,16,4],"splash":[0,238,32,32,6],"shield":[0,271,48,48,6],"slash":[0,320,64,47,9],"boom":[0,368,44,44,13],"bolt":[0,413,48,48,12],"ring":[0,462,48,48,14]};

/* ---------- Sprite-Atlas (assets/sheet.png, 0x72 DungeonTileset II) ---------- */
const SP = {
  knight:{idle:[128,100],run:[192,100],hit:[256,100],w:16,h:28},
  knightf:{idle:[128,68],run:[192,68],hit:[256,68],w:16,h:28},
  wizard:{idle:[128,164],run:[192,164],hit:[256,164],w:16,h:28},
  wizf:{idle:[128,132],run:[192,132],hit:[256,132],w:16,h:28},
  elf:{idle:[128,36],run:[192,36],hit:[256,36],w:16,h:28},
  elff:{idle:[128,4],run:[192,4],hit:[256,4],w:16,h:28},
  lizard:{idle:[128,228],run:[192,228],hit:[256,228],w:16,h:28},
  lizardf:{idle:[128,196],run:[192,196],hit:[256,196],w:16,h:28},
  dwarf:{idle:[128,292],run:[192,292],hit:[256,292],w:16,h:28},
  dwarff:{idle:[128,260],run:[192,260],hit:[256,260],w:16,h:28},
  doc:{idle:[368,345],run:[432,345],w:16,h:23},
  angel:{idle:[368,304],run:[432,304],w:16,h:16},
  pumpkin:{idle:[368,321],run:[432,321],w:16,h:23},
  goblin:{idle:[368,40],run:[432,40],w:16,h:16},
  skelet:{idle:[368,88],run:[432,88],w:16,h:16},
  necro:{idle:[368,225],run:[368,225],w:16,h:23},
  wogol:{idle:[368,249],run:[432,249],w:16,h:23},
  orc:{idle:[368,177],run:[432,177],w:16,h:23},
  masked:{idle:[368,153],run:[432,153],w:16,h:23},
  shaman:{idle:[368,201],run:[432,201],w:16,h:23},
  swampy:{idle:[432,112],run:[432,112],w:16,h:16},
  muddy:{idle:[368,112],run:[368,112],w:16,h:16},
  imp:{idle:[368,64],run:[432,64],w:16,h:16},
  chort:{idle:[368,273],run:[432,273],w:16,h:23},
  tinyz:{idle:[368,16],run:[432,16],w:16,h:16},
  icez:{idle:[432,136],run:[432,136],w:16,h:16},
  slug:{idle:[368,375],run:[432,375],w:16,h:17},
  ogre:{idle:[16,380],run:[144,380],w:32,h:36},
  bigz:{idle:[16,332],run:[144,332],w:32,h:36},
  demon:{idle:[16,428],run:[144,428],w:32,h:36},
  mimic:{idle:[304,432],run:[304,432],w:16,h:16,n:3}
};
const WSRC = {knife:[293,10,6,13],rusty_sword:[307,10,10,21],regular_sword:[323,10,10,21],knight_sword:[339,98,10,29],lavish_sword:[307,129,10,30],anime_sword:[322,65,12,30],golden_sword:[291,137,10,22],red_gem_sword:[339,10,10,21],axe:[341,74,9,21],waraxe:[324,168,12,23],double_axe:[288,167,16,24],big_hammer:[291,26,10,37],mace:[339,39,10,24],baton:[323,41,10,22],spear:[309,161,6,30],red_staff:[324,129,8,30],green_staff:[340,129,8,30],bow:[289,195,14,26],bow2:[305,195,14,26],arrow:[324,202,7,21],katana:[293,66,6,29],machete:[294,105,5,22],cleaver:[310,108,9,19]};

/* ---------- Material-Stufen ----------
   n: Waffen-Material, m: Metallfarben (dunkel → Glanz), c: Rüstungsfarben (Haupt, Schatten), pl: Helmbusch */
const MAT = [
  {n:'Eisen',m:['#4a505c','#7a828e','#a8b0bc','#d0d6de'],c:['#a8743e','#5e3a1e'],pl:null},
  {n:'Stahl',m:['#4a5466','#8a96aa','#c8d2e0','#f4f8ff'],c:['#8e96a3','#4a505c'],pl:['#9aa2ae','#d0d6de']},
  {n:'Mithril',m:['#2e6a7a','#57b7c6','#9ee8f0','#eaffff'],c:['#72d6ce','#417089'],pl:['#57b7c6','#9ee8f0']},
  {n:'Adamant',m:['#14403a','#22806a','#44c89a','#b8f8dc'],c:['#3ab08a','#1a5a48'],pl:['#22806a','#44c89a']},
  {n:'Drachen',m:['#6a1410','#b8301e','#f06a2a','#ffd24a'],c:['#d84a32','#7a1e18'],pl:['#da4e38','#ee8e2e'],hi:'#ffd24a'},
  {n:'Obsidian',m:['#120c1a','#2e2240','#5a4278','#ff8a3a'],c:['#4a3a5e','#1e1428'],pl:['#ff6a2a','#ffb03a'],hi:'#ff8a3a',glow:'#ff7a2a'},
  {n:'Sternen',m:['#26266a','#4a4ad0','#9aa2ff','#ffffff'],c:['#5a5ae0','#24247a'],pl:['#9aa2ff','#ffffff'],hi:'#d8dcff',glow:'#9aa2ff'},
  {n:'Ätherium',m:['#8a6a2a','#d8b050','#ffe8a0','#ffffff'],c:['#f0e6c8','#c8a04a'],pl:['#ffd24a','#fff8d0'],hi:'#fff8d0',glow:'#ffe08a'}
];
const TIERS = MAT.length;
const TINT = MAT.map((m, i) => i ? m.m[2] : null);

/* ---------- Waffen ---------- */
const TMUL = [1,1.75,2.9,4.4,6.4,9,12.4,16.8];
const WT = {
  dagger:{label:'Dolche',dmg:6,cd:.24,range:18,arc:1.4,kb:55,crit:.15},
  sword:{label:'Schwert',dmg:10,cd:.38,range:25,arc:2.0,kb:110,crit:.06},
  axe:{label:'Axt',dmg:16,cd:.6,range:26,arc:2.8,kb:190,crit:.06},
  bow:{label:'Bogen',dmg:8,cd:.44,range:0,arc:0,kb:50,crit:.08,ranged:true,proj:'arrow'},
  staff:{label:'Stab',dmg:9,cd:.48,range:0,arc:0,kb:40,crit:.06,ranged:true,proj:['arcane','purebolt','waterbolt','magicorb','lightbolt','fireball','windbolt','sparks']}
};
/* Waffenformen: Aussehen und kleine Wert-Unterschiede. std = neutrale Form für alte Spielstände */
const WFORM = {
  sword:[
    {id:'kurz',n:'Kurzschwert',dm:.92,sp:.88,len:11,w:3},
    {id:'lang',n:'Langschwert',std:1,len:15,w:3},
    {id:'breit',n:'Breitschwert',dm:1.1,sp:1.08,len:14,w:5},
    {id:'saebel',n:'Säbel',dm:.96,sp:.94,crit:.04,len:15,w:3,curve:1},
    {id:'zwei',n:'Zweihänder',dm:1.28,sp:1.22,range:4,len:19,w:4,big:1},
    {id:'flamm',n:'Flammberg',dm:1.15,sp:1.1,crit:.02,len:17,w:4,wavy:1}
  ],
  axe:[
    {id:'beil',n:'Beil',dm:.9,sp:.88,crit:.02},
    {id:'streit',n:'Streitaxt',std:1},
    {id:'doppel',n:'Doppelaxt',dm:1.12,sp:1.08},
    {id:'barte',n:'Bartaxt',crit:.04},
    {id:'hammer',n:'Kriegshammer',dm:1.2,sp:1.14,kb:1.5},
    {id:'helle',n:'Hellebarde',dm:1.08,sp:1.06,range:6}
  ],
  dagger:[
    {id:'messer',n:'Messer',std:1},
    {id:'stilett',n:'Stilette',dm:.92,crit:.05},
    {id:'kris',n:'Krisdolche',dm:1.06,sp:1.02},
    {id:'sichel',n:'Sicheln',dm:1.08,sp:1.05,range:2},
    {id:'katar',n:'Katare',dm:1.14,sp:1.1}
  ],
  bow:[
    {id:'kurz',n:'Kurzbogen',dm:.9,sp:.86},
    {id:'jagd',n:'Jagdbogen',std:1},
    {id:'lang',n:'Langbogen',dm:1.1,sp:1.08},
    {id:'reflex',n:'Reflexbogen',crit:.04},
    {id:'arm',n:'Armbrust',dm:1.32,sp:1.3}
  ],
  staff:[
    {id:'stab',n:'Stab',std:1},
    {id:'zepter',n:'Zepter',dm:.92,sp:.86},
    {id:'kristall',n:'Kristallstab',crit:.04},
    {id:'knochen',n:'Knochenstab',dm:1.08,sp:1.05},
    {id:'mond',n:'Mondsichelstab',dm:1.14,sp:1.1}
  ]
};
const REQ = [1,5,10,16,22,30,38,46];            // Level für Waffen-/Rüstungsstufen
const PRICE = [40,180,460,960,1900,3400,5600,8800];
const AR = {
  armor:{label:'Rüstung',def:[3,7,12,18,26,36,48,62],hp:[0,12,26,42,64,90,120,156]},
  helm:{label:'Helm',def:[1,3,6,9,13,18,24,31],hp:[0,6,12,20,30,44,60,78]}
};

/* ---------- Körper (Aussehen) ----------
   main: Kleidung/Rüstung, hair, skin, plume: Farbschlüssel im Sprite-Atlas */
const BODIES = {
  knight_m:{n:'Ritter',sp:'knight',main:['114,214,206','65,112,137'],plume:['218,78,56','238,142,46'],hi:'253,247,237'},
  knight_f:{n:'Ritterin',sp:'knightf',main:['114,214,206','65,112,137'],plume:['220,74,123','247,134,151'],hi:'253,247,237'},
  wizard_m:{n:'Magier',sp:'wizard',main:['86,152,204','89,86,189'],hair:['253,247,237','211,191,169'],skin:['181,128,87','138,80,62']},
  wizard_f:{n:'Magierin',sp:'wizf',main:['86,152,204','89,86,189'],hair:['253,247,237','211,191,169'],skin:['181,128,87','138,80,62']},
  elf_m:{n:'Elf',sp:'elf',main:['75,167,71','61,115,79'],hair:['250,203,62','238,142,46'],skin:['252,203,163','226,182,148']},
  elf_f:{n:'Elfe',sp:'elff',main:['75,167,71','61,115,79'],hair:['250,203,62','238,142,46'],skin:['252,203,163','226,182,148']},
  dwarf_m:{n:'Zwerg',sp:'dwarf',main:['123,137,148','119,92,85'],hair:['218,78,56','228,110,51'],skin:['216,165,125','195,141,112']},
  dwarf_f:{n:'Zwergin',sp:'dwarff',main:['220,74,123','159,41,78'],hair:['250,203,62','238,142,46'],skin:['216,165,125','195,141,112']},
  lizard_m:{n:'Echsenmann',sp:'lizard',main:['72,59,58','119,92,85'],skin:['75,167,71','61,115,79']},
  lizard_f:{n:'Echsenfrau',sp:'lizardf',main:['143,64,41','98,35,47'],hair:['218,78,56','159,41,78'],skin:['73,167,144','65,112,137']},
  doc:{n:'Pestmaske',sp:'doc',main:['49,65,82','65,112,137'],skin:['170,141,122','211,191,169']}
};
const BODYORDER = ['knight_m','knight_f','wizard_m','wizard_f','elf_m','elf_f','dwarf_m','dwarf_f','lizard_m','lizard_f','doc'];
const HAIRS = [['Blond','#facb3e','#ee8e2e'],['Rot','#da4e38','#e46e33'],['Braun','#8a5a32','#5e3a1e'],['Schwarz','#3e3848','#24202c'],['Weiß','#fdf7ed','#d3bfa9'],['Silber','#c8d0e0','#8a96aa'],['Blau','#57a7d6','#3a5aa8'],['Grün','#79c24e','#3d734f'],['Violett','#b892f4','#6a48c0'],['Rosa','#f786a0','#dc4a7b']];
const SKINS = [['Hell','#fccba3','#e2b694'],['Rosig','#f2b49c','#d8907e'],['Mittel','#d8a57d','#c38d70'],['Gebräunt','#b58057','#8a503e'],['Dunkel','#7a4a32','#5a3424'],['Ork','#7ab04a','#4a7a2e'],['Frost','#8ec0e6','#5a88b8'],['Untot','#a8a8b0','#74748a'],['Dämon','#d8584a','#9a2e2a'],['Schatten','#5a4a7a','#3a2e52']];
const CAPES = [['Rot','#c8342c','#7a1e18'],['Blau','#3a6ac8','#1e3a7a'],['Grün','#3a9a4a','#1e5a2a'],['Schwarz','#2a2434','#141018'],['Violett','#7a48c0','#3e2470'],['Gold','#e8b04a','#9c6a24'],['Weiß','#e8e8f0','#a8a8b8'],['Braun','#8a5a32','#4e3018']];
const ACCENTS = [['Rot','#da4e38','#ee8e2e'],['Rosa','#dc4a7b','#f786a0'],['Blau','#3a6ac8','#57a7d6'],['Grün','#3a9a4a','#79c24e'],['Gold','#e8b04a','#ffd24a'],['Weiß','#c8d0e0','#ffffff'],['Schwarz','#2a2434','#4a4458'],['Violett','#6a48c0','#b892f4']];

/* ---------- Klassen ---------- */
const CLASSES = {
  knight:{
    name:'Ritter',sp:'knight',body:'knight_m',desc:'Schwer gepanzert, hält viel aus. Schwert oder Axt, Schildwall und Wirbelklinge.',
    hp:85,hpLv:14,def:6,spd:76,weapons:['sword','axe'],start:'sword',style:'plate',
    res:{name:'Ausdauer',max:100,regen:13,col:'#e8b04a',onHit:3},
    skills:['k1','k2','k3'],ult:'ku',
    names:[['Lederwams','Lederkappe'],['Kettenhemd','Stahlhelm'],['Mithrilpanzer','Mithrilhelm'],['Adamantpanzer','Adamanthelm'],['Drachenschuppenpanzer','Drachenhelm'],['Obsidianpanzer','Obsidianhelm'],['Sternenpanzer','Sternenhelm'],['Ätheriumpanzer','Ätheriumkrone']]
  },
  mage:{
    name:'Magier',sp:'wizard',body:'wizard_m',desc:'Zerbrechlich, aber verheerend. Feuerbälle, Frostnova und Kettenblitze aus der Distanz.',
    hp:55,hpLv:9,def:2,spd:74,weapons:['staff'],start:'staff',style:'robe',
    res:{name:'Mana',max:120,regen:11,col:'#57a7d6'},
    skills:['m1','m2','m3'],ult:'mu',
    names:[['Novizenrobe','Filzhut'],['Gelehrtenrobe','Spitzhut'],['Mithrilrobe','Mithrilhut'],['Adamantrobe','Adamantkrone'],['Drachenseidenrobe','Drachenkrone'],['Glutrobe','Obsidiankrone'],['Sternenrobe','Sternenhut'],['Ätherrobe','Ätherkrone']]
  },
  rogue:{
    name:'Assassine',sp:'doc',body:'doc',desc:'Schnell und tödlich. Doppelte Dolche, Gift, Rauchbomben und Schattenklone.',
    hp:62,hpLv:11,def:3,spd:90,weapons:['dagger'],start:'dagger',style:'cloak',
    res:{name:'Energie',max:100,regen:20,col:'#79c24e'},
    skills:['r1','r2','r3'],ult:'ru',
    names:[['Lederumhang','Kapuze'],['Schattenmantel','Maske'],['Mithrilharnisch','Mithrilmaske'],['Adamantmantel','Adamantmaske'],['Drachenledermantel','Drachenmaske'],['Obsidianmantel','Obsidianmaske'],['Sternenmantel','Sternenmaske'],['Äthermantel','Äthermaske']]
  },
  ranger:{
    name:'Bogenschütze',sp:'elf',body:'elf_m',desc:'Präzise aus der Ferne. Fächerschuss, Sprengfallen und ein Waldgeist als Begleiter.',
    hp:60,hpLv:10,def:3,spd:84,weapons:['bow'],start:'bow',style:'vest',
    res:{name:'Fokus',max:100,regen:12,col:'#8ee6ea'},
    skills:['a1','a2','a3'],ult:'au',
    names:[['Jagdwams','Lederstirnband'],['Waldläuferwams','Federkappe'],['Mithrilwams','Mithrilreif'],['Adamantwams','Adamantreif'],['Drachenlederwams','Drachenreif'],['Obsidianwams','Obsidianreif'],['Sternenwams','Sternenreif'],['Ätherwams','Sonnenreif']]
  }
};
const DYES = [
  {id:'natur',n:'Naturfarbe',c:null,cost:{}},
  {id:'purpur',n:'Purpur',c:['#9a4ad8','#4a1a7a'],cost:{kristall:2}},
  {id:'smaragd',n:'Smaragd',c:['#3ac87a','#1a6a3a'],cost:{schleim:4}},
  {id:'gold',n:'Gold',c:['#f0c040','#a0701a'],cost:{erz:6,glut:1}},
  {id:'schatten',n:'Schatten',c:['#3a3448','#16121e'],cost:{knochen:6}},
  {id:'blut',n:'Blut',c:['#c82a2a','#5a0e12'],cost:{horn:2}},
  {id:'eis',n:'Eis',c:['#bfefff','#5aa8d8'],cost:{kristall:1,schleim:2}},
  {id:'mitter',n:'Mitternacht',c:['#2a3a8a','#10163a'],cost:{stern:1,erz:4}},
  {id:'rose',n:'Rosé',c:['#f08ab0','#a83a6a'],cost:{schleim:3,kristall:1}},
  {id:'lava',n:'Lava',c:['#ff7a2a','#7a1e10'],cost:{glut:3}},
  {id:'jade',n:'Jade',c:['#5ad8a8','#1e7a5a'],cost:{adamant:1,schleim:2}},
  {id:'weiss',n:'Elfenbein',c:['#f4efe0','#b8ae96'],cost:{knochen:4,erz:2}}
];

/* ---------- Fähigkeiten ---------- */
const SKILLS = {
  k1:{n:'Sturmangriff',cost:30,cd:5,icon:['w','knight_sword'],d:'Stürmt vor und betäubt alle Gegner auf dem Weg.'},
  k2:{n:'Wirbelklinge',cost:40,cd:8,icon:['fx','slash',4],d:'Drehender Klingenwirbel, trifft alles ringsum.'},
  k3:{n:'Schildwall',cost:35,cd:12,icon:['fx','shield',2],d:'3 s lang 70 % weniger Schaden.'},
  ku:{n:'Erdbeben',ult:true,icon:['fx','ring',8],d:'Gewaltiger Sprung mit Schockwelle.'},
  m1:{n:'Feuerball',cost:18,cd:1.1,icon:['fx','fireball',2],d:'Explodiert beim Aufprall.'},
  m2:{n:'Frostnova',cost:35,cd:7,icon:['fx','icelance',1],d:'Friert alle Gegner in der Nähe ein.'},
  m3:{n:'Kettenblitz',cost:28,cd:3.5,icon:['fx','bolt',5],d:'Blitz springt auf mehrere Gegner über.'},
  mu:{n:'Meteorhagel',ult:true,icon:['fx','firebomb',3],d:'Ein Regen aus brennenden Meteoren.'},
  r1:{n:'Schattenschritt',cost:25,cd:3,icon:['fx','darkbolt',2],d:'Sprint durch Gegner mit garantierten Krits.'},
  r2:{n:'Giftklingen',cost:30,cd:8,icon:['fx','plant',1],d:'Wirft Messer und vergiftet 6 s lang alle Treffer.'},
  r3:{n:'Rauchbombe',cost:40,cd:12,icon:['s',288,320,16,16],d:'Unsichtbar für 3 s, doppelter Schaden aus dem Schatten.'},
  ru:{n:'Schattenklone',ult:true,icon:['sp','doc'],d:'Drei Schattenklone kämpfen an deiner Seite.'},
  a1:{n:'Fächerschuss',cost:25,cd:3,icon:['w','arrow'],d:'Fächer aus 7 Pfeilen.'},
  a2:{n:'Sprengfalle',cost:30,cd:5,icon:['s',304,320,16,16],d:'Legt eine Falle, die beim Kontakt explodiert.'},
  a3:{n:'Waldgeist',cost:45,cd:16,icon:['sp','angel'],d:'Ein Waldgeist schießt 15 s lang mit.'},
  au:{n:'Pfeilsturm',ult:true,icon:['fx','windbolt',2],d:'Salven aus durchschlagenden Pfeilen.'}
};

/* ---------- Talentbäume ----------
   Je Zweig 4 Grund-Talente (10 Punkte) und ab 6.4 die Meister-Stufe (23 Punkte): lv = ab diesem Level des Helden, cap = Schlussstein.
   Meister: Level 30/40/50/60/70 (je 4 Ränge), 80 (2 Ränge), Schlussstein 90/95/100 (1 Rang) → 33 je Zweig, 99 je Klasse = 1 Punkt je Level bis 100 */
const TALENTS = {
  knight:[
    ['Waffenmeister',[
      {id:'kw1',n:'Scharfe Klinge',max:3,e:{dmg:.06},d:'+6 % Schaden'},
      {id:'kw2',n:'Präzision',max:3,e:{crit:.03},d:'+3 % Krit-Chance'},
      {id:'kw3',n:'Vernichtender Finisher',max:3,e:{fin:.25},d:'+25 % Kombo-Finisher-Schaden'},
      {id:'kw4',n:'Klingensturm',max:1,e:{k2Dur:.6,k2Dmg:.4},d:'Wirbelklinge +0,6 s und +40 % Schaden'},
      {id:'kw5',n:'Klingenschliff',max:4,lv:30,e:{dmg:.03},d:'+3 % Schaden'},
      {id:'kw6',n:'Schwachstellen',max:4,lv:40,e:{critdmg:.08},d:'+8 % Krit-Schaden'},
      {id:'kw7',n:'Kampfrausch',max:4,lv:50,e:{aspd:.03},d:'+3 % Angriffstempo'},
      {id:'kw8',n:'Wirbelmeister',max:4,lv:60,e:{k2Dmg:.1},d:'Wirbelklinge +10 % Schaden'},
      {id:'kw9',n:'Meisterhieb',max:4,lv:70,e:{fin:.1},d:'+10 % Kombo-Finisher-Schaden'},
      {id:'kw10',n:'Klingenwind',max:2,lv:80,e:{k2Rad:.08},d:'Wirbelklinge +8 % Reichweite'},
      {id:'kw11',n:'Klingenorkan',max:1,lv:90,cap:1,e:{k2Dur:.6,k2Dmg:.3,k2Rad:.15},d:'Wirbelklinge +0,6 s, +30 % Schaden und +15 % Reichweite'}]],
    ['Bollwerk',[
      {id:'kb1',n:'Eiserne Haut',max:3,e:{def:3},d:'+3 Verteidigung'},
      {id:'kb2',n:'Lebenskraft',max:3,e:{hp:.08},d:'+8 % Lebenspunkte'},
      {id:'kb3',n:'Regeneration',max:3,e:{regen:.6},d:'+0,6 LP pro Sekunde'},
      {id:'kb4',n:'Spiegelschild',max:1,e:{k3Reflect:1,k3Dur:1.5},d:'Schildwall wirft Geschosse zurück, +1,5 s'},
      {id:'kb5',n:'Stahlhaut',max:4,lv:30,e:{def:2},d:'+2 Verteidigung'},
      {id:'kb6',n:'Zähigkeit',max:4,lv:40,e:{hp:.03},d:'+3 % Lebenspunkte'},
      {id:'kb7',n:'Unerschütterlich',max:4,lv:50,e:{dr:.015},d:'1,5 % weniger Schaden'},
      {id:'kb8',n:'Schildmeister',max:4,lv:60,e:{k3Dur:.25},d:'Schildwall +0,25 s'},
      {id:'kb9',n:'Zweiter Atem',max:4,lv:70,e:{regen:.4},d:'+0,4 LP pro Sekunde'},
      {id:'kb10',n:'Heilender Wall',max:2,lv:80,e:{k3Heal:.04},d:'Schildwall heilt 4 % LP'},
      {id:'kb11',n:'Bastion',max:1,lv:95,cap:1,e:{k3Push:1,k3Dur:1,k3Heal:.06},d:'Schildwall stößt Gegner zurück, hält 1 s länger und heilt 6 % LP'}]],
    ['Kriegsherr',[
      {id:'kk1',n:'Kampfeswut',max:3,e:{rage:.15},d:'+15 % Wut-Aufbau'},
      {id:'kk2',n:'Taktiker',max:3,e:{cdr:.06},d:'−6 % Abklingzeiten'},
      {id:'kk3',n:'Ansturm',max:3,e:{k1Stun:.4,k1Dmg:.25},d:'Sturmangriff +0,4 s Betäubung, +25 % Schaden'},
      {id:'kk4',n:'Weltenbeben',max:1,e:{uRad:.4,uDmg:.5},d:'Erdbeben +40 % Radius, +50 % Schaden'},
      {id:'kk5',n:'Schlachtruf',max:4,lv:30,e:{rage:.06},d:'+6 % Wut-Aufbau'},
      {id:'kk6',n:'Feldherr',max:4,lv:40,e:{cdr:.02},d:'−2 % Abklingzeiten'},
      {id:'kk7',n:'Sturmreiter',max:4,lv:50,e:{k1Dmg:.1},d:'Sturmangriff +10 % Schaden'},
      {id:'kk8',n:'Erschütterung',max:4,lv:60,e:{uDmg:.1},d:'Erdbeben +10 % Schaden'},
      {id:'kk9',n:'Eiserner Wille',max:4,lv:70,e:{leech:.004},d:'+0,4 % Lebensraub'},
      {id:'kk10',n:'Bebende Erde',max:2,lv:80,e:{uRad:.1},d:'Erdbeben +10 % Radius'},
      {id:'kk11',n:'Weltenbrecher',max:1,lv:100,cap:1,e:{k1Wave:1,k1Dmg:.3,uAfter:1},d:'Sturmangriff endet in einer Schockwelle und trifft 30 % härter, Erdbeben bebt nach'}]]
  ],
  mage:[
    ['Feuer',[
      {id:'mf1',n:'Glut',max:3,e:{m1Dmg:.15},d:'Feuerball +15 % Schaden'},
      {id:'mf2',n:'Flammenmeer',max:3,e:{m1Rad:.15},d:'Feuerball +15 % Radius'},
      {id:'mf3',n:'Entzünden',max:3,e:{burn:.1},d:'+10 % Chance, Gegner in Brand zu setzen'},
      {id:'mf4',n:'Feuersturm',max:1,e:{m1Split:1},d:'Feuerball teilt sich in drei'},
      {id:'mf5',n:'Glutherz',max:4,lv:30,e:{m1Dmg:.08},d:'Feuerball +8 % Schaden'},
      {id:'mf6',n:'Funkenflug',max:4,lv:40,e:{burn:.04},d:'+4 % Chance, Gegner in Brand zu setzen'},
      {id:'mf7',n:'Feuerseele',max:4,lv:50,e:{dmg:.03},d:'+3 % Schaden'},
      {id:'mf8',n:'Weite Flammen',max:4,lv:60,e:{m1Rad:.06},d:'Feuerball +6 % Radius'},
      {id:'mf9',n:'Hitzewelle',max:4,lv:70,e:{critdmg:.07},d:'+7 % Krit-Schaden'},
      {id:'mf10',n:'Lodernde Kraft',max:2,lv:80,e:{m1Dmg:.1},d:'Feuerball +10 % Schaden'},
      {id:'mf11',n:'Phönixfeuer',max:1,lv:90,cap:1,e:{m1Twin:1,m1Burn:1},d:'Ein Feuerball mehr je Wurf, Getroffene brennen immer'}]],
    ['Frost',[
      {id:'mi1',n:'Eiskälte',max:3,e:{m2Dmg:.2},d:'Frostnova +20 % Schaden'},
      {id:'mi2',n:'Permafrost',max:3,e:{m2Freeze:.4},d:'Frostnova friert 0,4 s länger ein'},
      {id:'mi3',n:'Eisrüstung',max:3,e:{def:3},d:'+3 Verteidigung'},
      {id:'mi4',n:'Frostkern',max:1,e:{chill:1},d:'Wer dich trifft, wird verlangsamt'},
      {id:'mi5',n:'Frostpanzer',max:4,lv:30,e:{def:2},d:'+2 Verteidigung'},
      {id:'mi6',n:'Gletscherblut',max:4,lv:40,e:{hp:.03},d:'+3 % Lebenspunkte'},
      {id:'mi7',n:'Eisige Weite',max:4,lv:50,e:{m2Rad:.06},d:'Frostnova +6 % Radius'},
      {id:'mi8',n:'Tiefkühlung',max:4,lv:60,e:{m2Freeze:.15},d:'Frostnova friert 0,15 s länger ein'},
      {id:'mi9',n:'Kältebrand',max:4,lv:70,e:{m2Dmg:.1},d:'Frostnova +10 % Schaden'},
      {id:'mi10',n:'Frostschild',max:2,lv:80,e:{dr:.02},d:'2 % weniger Schaden'},
      {id:'mi11',n:'Ewiger Winter',max:1,lv:95,cap:1,e:{m2Armor:1,m2Rad:.2,m2Freeze:.5},d:'Frostnova gibt 3 s Frostpanzer (−30 % Schaden), +20 % Radius, friert 0,5 s länger ein'}]],
    ['Arkan',[
      {id:'ma1',n:'Arkanes Wissen',max:3,e:{dmg:.06},d:'+6 % Schaden'},
      {id:'ma2',n:'Manafluss',max:3,e:{resreg:.2},d:'+20 % Mana-Regeneration'},
      {id:'ma3',n:'Kettenreaktion',max:3,e:{m3Chain:1},d:'Kettenblitz springt 1 Mal mehr'},
      {id:'ma4',n:'Meteoritenschwarm',max:1,e:{uCount:6},d:'Meteorhagel +6 Meteore'},
      {id:'ma5',n:'Arkane Tiefe',max:4,lv:30,e:{dmg:.03},d:'+3 % Schaden'},
      {id:'ma6',n:'Manaquell',max:4,lv:40,e:{resreg:.08},d:'+8 % Mana-Regeneration'},
      {id:'ma7',n:'Leitende Blitze',max:4,lv:50,e:{m3Range:.08},d:'Kettenblitz +8 % Sprungweite'},
      {id:'ma8',n:'Zauberfluss',max:4,lv:60,e:{cdr:.02},d:'−2 % Abklingzeiten'},
      {id:'ma9',n:'Arkane Präzision',max:4,lv:70,e:{crit:.01},d:'+1 % Krit-Chance'},
      {id:'ma10',n:'Sternenfall',max:2,lv:80,e:{uCount:2},d:'Meteorhagel +2 Meteore'},
      {id:'ma11',n:'Gewittergott',max:1,lv:100,cap:1,e:{m3Chain:2,m3Stun:.4,muDmg:.25},d:'Kettenblitz springt 2 Mal mehr und lähmt 0,4 s, Meteore +25 % Schaden'}]]
  ],
  rogue:[
    ['Klingen',[
      {id:'rk1',n:'Tödliche Präzision',max:3,e:{crit:.04},d:'+4 % Krit-Chance'},
      {id:'rk2',n:'Halsabschneider',max:3,e:{critdmg:.2},d:'+20 % Krit-Schaden'},
      {id:'rk3',n:'Klingentanz',max:3,e:{aspd:.08},d:'+8 % Angriffstempo'},
      {id:'rk4',n:'Endlose Schatten',max:1,e:{r1Reset:1},d:'Schattenschritt lädt sich bei Kills neu'},
      {id:'rk5',n:'Messerspitze',max:4,lv:30,e:{crit:.015},d:'+1,5 % Krit-Chance'},
      {id:'rk6',n:'Blutgier',max:4,lv:40,e:{leech:.003},d:'+0,3 % Lebensraub'},
      {id:'rk7',n:'Klingenwirbel',max:4,lv:50,e:{aspd:.03},d:'+3 % Angriffstempo'},
      {id:'rk8',n:'Schattenhieb',max:4,lv:60,e:{r1Dmg:.1},d:'Schattenschritt +10 % Schaden'},
      {id:'rk9',n:'Mordlust',max:4,lv:70,e:{critdmg:.08},d:'+8 % Krit-Schaden'},
      {id:'rk10',n:'Weiter Schritt',max:2,lv:80,e:{r1Far:.1},d:'Schattenschritt +10 % Weg'},
      {id:'rk11',n:'Tausend Klingen',max:1,lv:90,cap:1,e:{r1Wide:1,r1Dmg:.3,r1Stealth:.6},d:'Schattenschritt wird breiter, trifft 30 % härter und macht danach 0,6 s unsichtbar'}]],
    ['Gift',[
      {id:'rg1',n:'Toxine',max:3,e:{poison:.25},d:'+25 % Giftschaden'},
      {id:'rg2',n:'Wurfmesser',max:3,e:{r2Knives:2},d:'Giftklingen +2 Wurfmesser'},
      {id:'rg3',n:'Lähmendes Gift',max:3,e:{poisonSlow:.15},d:'Vergiftete Gegner −15 % Tempo'},
      {id:'rg4',n:'Seuche',max:1,e:{plague:1},d:'Gift springt beim Tod auf Nachbarn über'},
      {id:'rg5',n:'Ätzend',max:4,lv:30,e:{poison:.1},d:'+10 % Giftschaden'},
      {id:'rg6',n:'Giftmischer',max:4,lv:40,e:{r2Dmg:.1},d:'Giftklingen +10 % Schaden'},
      {id:'rg7',n:'Zähes Leben',max:4,lv:50,e:{hp:.03},d:'+3 % Lebenspunkte'},
      {id:'rg8',n:'Giftnebel',max:4,lv:60,e:{dmg:.03},d:'+3 % Schaden'},
      {id:'rg9',n:'Schleichendes Gift',max:4,lv:70,e:{poison:.1},d:'+10 % Giftschaden'},
      {id:'rg10',n:'Messerhagel',max:2,lv:80,e:{r2Knives:1},d:'Giftklingen +1 Wurfmesser'},
      {id:'rg11',n:'Giftsturm',max:1,lv:95,cap:1,e:{r2Ring:1,r2Knives:2,poison:.3},d:'Giftklingen werfen auch einen Messerkranz rundum, +2 Messer, +30 % Giftschaden'}]],
    ['Schatten',[
      {id:'rs1',n:'Flink',max:3,e:{spd:.06},d:'+6 % Lauftempo'},
      {id:'rs2',n:'Ausweichen',max:3,e:{dodge:.05},d:'+5 % Chance, Treffern auszuweichen'},
      {id:'rs3',n:'Hinterhalt',max:3,e:{stealth:.3},d:'Rauchbombe +30 % Schaden und +0,5 s'},
      {id:'rs4',n:'Legion',max:1,e:{uCount:2},d:'Schattenklone +2'},
      {id:'rs5',n:'Leichtfuß',max:4,lv:30,e:{spd:.02},d:'+2 % Lauftempo'},
      {id:'rs6',n:'Schemen',max:4,lv:40,e:{dodge:.015},d:'+1,5 % Chance, Treffern auszuweichen'},
      {id:'rs7',n:'Dunkle Gabe',max:4,lv:50,e:{r3Dmg:.08},d:'Rauchbombe +8 % Hinterhalt-Schaden'},
      {id:'rs8',n:'Nebelschleier',max:4,lv:60,e:{r3Dur:.25},d:'Rauchbombe +0,25 s'},
      {id:'rs9',n:'Schattenpakt',max:4,lv:70,e:{ruDmg:.1},d:'Schattenklone +10 % Schaden'},
      {id:'rs10',n:'Lange Schatten',max:2,lv:80,e:{ruDur:1},d:'Schattenklone +1 s'},
      {id:'rs11',n:'Schattenarmee',max:1,lv:100,cap:1,e:{uCount:2,ruBoom:1},d:'Schattenklone +2, sie explodieren am Ende'}]]
  ],
  ranger:[
    ['Schütze',[
      {id:'aa1',n:'Adlerauge',max:3,e:{crit:.03},d:'+3 % Krit-Chance'},
      {id:'aa2',n:'Schnellschuss',max:3,e:{aspd:.08},d:'+8 % Angriffstempo'},
      {id:'aa3',n:'Breiter Fächer',max:3,e:{a1Count:2},d:'Fächerschuss +2 Pfeile'},
      {id:'aa4',n:'Pfeilhagel',max:1,e:{uDmg:.5,uDur:2},d:'Pfeilsturm +50 % Schaden, 2 Salven mehr'},
      {id:'aa5',n:'Scharfes Auge',max:4,lv:30,e:{crit:.015},d:'+1,5 % Krit-Chance'},
      {id:'aa6',n:'Zielsicher',max:4,lv:40,e:{critdmg:.08},d:'+8 % Krit-Schaden'},
      {id:'aa7',n:'Flinke Sehne',max:4,lv:50,e:{aspd:.03},d:'+3 % Angriffstempo'},
      {id:'aa8',n:'Weiter Fächer',max:4,lv:60,e:{a1Dmg:.1},d:'Fächerschuss +10 % Schaden'},
      {id:'aa9',n:'Salvenmeister',max:4,lv:70,e:{uDmg:.1},d:'Pfeilsturm +10 % Schaden'},
      {id:'aa10',n:'Pfeilregen',max:2,lv:80,e:{auArrows:1},d:'Pfeilsturm +2 Pfeile je Salve'},
      {id:'aa11',n:'Sturm der Pfeile',max:1,lv:90,cap:1,e:{a1Twice:1,a1Count:3},d:'Fächerschuss: +3 Pfeile und eine zweite Salve mit halbem Schaden'}]],
    ['Fallensteller',[
      {id:'af1',n:'Sprengmeister',max:3,e:{a2Dmg:.25},d:'Sprengfalle +25 % Schaden'},
      {id:'af2',n:'Vorrat',max:3,e:{a2Max:1},d:'+1 gleichzeitige Falle'},
      {id:'af3',n:'Splitter',max:3,e:{a2Rad:.2},d:'Sprengfalle +20 % Radius'},
      {id:'af4',n:'Kettenexplosion',max:1,e:{a2Cluster:1},d:'Fallen streuen kleine Bomben'},
      {id:'af5',n:'Schwarzpulver',max:4,lv:30,e:{a2Dmg:.1},d:'Sprengfalle +10 % Schaden'},
      {id:'af6',n:'Großer Knall',max:4,lv:40,e:{a2Rad:.06},d:'Sprengfalle +6 % Radius'},
      {id:'af7',n:'Fallenkunde',max:4,lv:50,e:{cdr:.02},d:'−2 % Abklingzeiten'},
      {id:'af8',n:'Zähe Schlinge',max:4,lv:60,e:{a2Slow:.6},d:'Explosion verlangsamt 0,6 s'},
      {id:'af9',n:'Kriegslist',max:4,lv:70,e:{dmg:.03},d:'+3 % Schaden'},
      {id:'af10',n:'Großvorrat',max:2,lv:80,e:{a2Max:1},d:'+1 gleichzeitige Falle'},
      {id:'af11',n:'Feuerwerk',max:1,lv:95,cap:1,e:{a2Dmg:.3,a2Rad:.2,a2Max:1},d:'Sprengfalle +30 % Schaden und +20 % Radius, eine Falle mehr'}]],
    ['Wildnis',[
      {id:'aw1',n:'Waldläufer',max:3,e:{spd:.05},d:'+5 % Lauftempo'},
      {id:'aw2',n:'Naturverbunden',max:3,e:{hp:.07},d:'+7 % Lebenspunkte'},
      {id:'aw3',n:'Geistband',max:3,e:{a3Dur:3,a3Dmg:.2},d:'Waldgeist +3 s, +20 % Schaden'},
      {id:'aw4',n:'Zwillingsgeister',max:1,e:{a3Count:1},d:'Ein zweiter Waldgeist erscheint'},
      {id:'aw5',n:'Wildleben',max:4,lv:30,e:{hp:.03},d:'+3 % Lebenspunkte'},
      {id:'aw6',n:'Pfadfinder',max:4,lv:40,e:{spd:.02},d:'+2 % Lauftempo'},
      {id:'aw7',n:'Erdverbunden',max:4,lv:50,e:{regen:.4},d:'+0,4 LP pro Sekunde'},
      {id:'aw8',n:'Geisterruf',max:4,lv:60,e:{a3Dmg:.1},d:'Waldgeist +10 % Schaden'},
      {id:'aw9',n:'Waldsegen',max:4,lv:70,e:{a3Dur:1.5},d:'Waldgeist +1,5 s'},
      {id:'aw10',n:'Schnelle Geister',max:2,lv:80,e:{a3Fast:.1},d:'Waldgeist schießt 10 % schneller'},
      {id:'aw11',n:'Hüter des Waldes',max:1,lv:100,cap:1,e:{a3Count:1,a3Heal:1},d:'Ein weiterer Waldgeist, Waldgeister heilen dich alle 3 s um 2 % LP'}]]
  ]
};

/* ---------- Seltenheit, Affixe, Sets, Mythisch ---------- */
const RAR = [
  {n:'Gewöhnlich',c:'#c8c8c8',m:1,aff:0,sock:[0,0]},
  {n:'Magisch',c:'#57a7d6',m:1.15,aff:1,sock:[0,1]},
  {n:'Selten',c:'#e8d04a',m:1.3,aff:2,sock:[1,1]},
  {n:'Episch',c:'#b892f4',m:1.5,aff:2,sock:[1,2]},
  {n:'Legendär',c:'#ff8a3a',m:1.8,aff:3,sock:[2,3]},
  {n:'Set',c:'#4ade80',m:1.6,aff:2,sock:[1,1]},
  {n:'Mythisch',c:'#ff4fd8',m:2.15,aff:4,sock:[2,3]}
];
const AFFW = {
  krit:{suf:'der Präzision',f:r=>.04+r*.015,s:v=>_t('Krit +{v}',{v:pct(v)})},
  tempo:{suf:'des Windes',f:r=>.06+r*.02,s:v=>_t('Tempo +{v}',{v:pct(v)})},
  raub:{suf:'des Blutes',f:r=>.02+r*.008,s:v=>_t('Lebensraub {v}',{v:pct(v)})},
  feuer:{suf:'der Glut',f:r=>.15+r*.05,s:v=>_t('Brand {v}',{v:pct(v)})},
  frost:{suf:'des Frostes',f:r=>.06+r*.02,s:v=>_t('Frost {v}',{v:pct(v)})},
  wucht:{suf:'der Wucht',f:r=>.08+r*.04,s:v=>_t('Schaden +{v}',{v:pct(v)})}
};
const AFFA = {
  leben:{suf:'des Lebens',f:r=>.05+r*.03,s:v=>_t('LP +{v}',{v:pct(v)})},
  panzer:{suf:'des Panzers',f:r=>2+r*1.5,s:v=>_t('VER +{v}',{v:Math.round(v)})},
  heil:{suf:'der Heilung',f:r=>.3+r*.2,s:v=>_t('Regeneration +{v}',{v:v.toLocaleString(LOCALE,{minimumFractionDigits:1,maximumFractionDigits:1})})},
  schutz:{suf:'des Schutzes',f:r=>.03+r*.015,s:v=>_t('Schadensminderung {v}',{v:pct(v)})},
  eile:{suf:'der Eile',f:r=>.03+r*.015,s:v=>_t('Lauftempo +{v}',{v:pct(v)})},
  glueck:{suf:'des Glücks',f:r=>.08+r*.05,s:v=>_t('Gold +{v}',{v:pct(v)})}
};
const LEGEND = {dagger:['Nachtzahn','Viperbiss','Schattenkuss'],sword:['Sonnenklinge','Morgenrot','Sturmbrecher'],axe:['Weltspalter','Donnerkeil','Bergfäller'],bow:['Sternenfall','Himmelsbogen','Windflüsterer'],staff:['Sternenfeuer','Eiswind','Weltenauge'],armor:['Ewige Wacht','Phönixherz','Bollwerk der Ahnen'],helm:['Krone der Ahnen','Drachenblick','Löwenhaupt']};
const SETS = {
  lion:{n:'Erbe des Löwen',cls:'knight',base:'sword',pieces:{weapon:'Löwenklinge',armor:'Löwenpanzer',helm:'Löwenhelm'},b2:{dr:.12},b3:{k2Cdr:.5,dmg:.25},d2:'12 % weniger Schaden',d3:'Wirbelklinge halbe Abklingzeit, +25 % Schaden'},
  glut:{n:'Glutweber',cls:'mage',base:'staff',pieces:{weapon:'Glutweberstab',armor:'Glutweberrobe',helm:'Glutweberhut'},b2:{m1Dmg:.3},b3:{m1Split:1,m1Rad:.3},d2:'Feuerball +30 % Schaden',d3:'Feuerball teilt sich, +30 % Radius'},
  nacht:{n:'Nachtschatten',cls:'rogue',base:'dagger',pieces:{weapon:'Nachtschattenklingen',armor:'Nachtschattenmantel',helm:'Nachtschattenmaske'},b2:{crit:.1},b3:{r1Reset:1,critdmg:.4},d2:'+10 % Krit-Chance',d3:'Schattenschritt lädt bei Kills, +40 % Krit-Schaden'},
  wald:{n:'Waldläufer',cls:'ranger',base:'bow',pieces:{weapon:'Waldläuferbogen',armor:'Waldläuferwams',helm:'Waldläuferreif'},b2:{aspd:.15},b3:{a1Count:4,pierce:1},d2:'+15 % Angriffstempo',d3:'Alle Pfeile durchschlagen, Fächer +4'},
  drache:{n:'Drachenfürst',cls:null,base:null,pieces:{weapon:'Drachenfürsten-Waffe',armor:'Drachenfürsten-Panzer',helm:'Drachenfürsten-Krone'},b2:{dmg:.1,hp:.1},b3:{fireAura:1,dr:.08},d2:'+10 % Schaden und LP',d3:'Feuer-Aura verbrennt Gegner in der Nähe, 8 % weniger Schaden'}
};
/* Mythische Gegenstände: eine einzigartige Kraft (p) */
const MYTHIC = {
  klinge:{n:'Klinge von Klingenhort',slot:'weapon',p:'chain',d:'20 % Chance: Treffer lösen einen Kettenblitz aus'},
  zorn:{n:'Pyraxis\' Zorn',slot:'weapon',p:'fireburst',d:'Kritische Treffer entfesseln eine Feuerexplosion'},
  ernter:{n:'Seelenernter',slot:'weapon',p:'soul',d:'Jeder Kill heilt 4 % LP und füllt 10 Ressource'},
  phoenix:{n:'Phönixpanzer',slot:'armor',p:'phoenix',d:'Einmal pro Raum: statt zu sterben mit 50 % LP auferstehen'},
  dornen:{n:'Dornenwacht',slot:'armor',p:'thorns',d:'Angreifer erleiden ihren Schaden selbst'},
  krone:{n:'Krone der Ewigkeit',slot:'helm',p:'echo',d:'Fähigkeiten kosten 30 % weniger, 20 % kürzere Abklingzeit'},
  eisherz:{n:'Eisherz-Diadem',slot:'helm',p:'frostaura',d:'Gegner in deiner Nähe sind verlangsamt'},
  midas:{n:'Midas\' Haube',slot:'helm',p:'midas',d:'+100 % Gold, doppelte Edelstein-Chance'}
};
/* Kosmetik aus dem Glückstempel */
const COSM = {
  w_engel:{n:'Engelsflügel',k:'wings',c:['#ffffff','#b8c8e8']},
  w_drache:{n:'Drachenflügel',k:'wings',c:['#c8342c','#5a0e12'],bat:1},
  w_nacht:{n:'Fledermausflügel',k:'wings',c:['#4a4058','#1e1828'],bat:1},
  w_fee:{n:'Feenflügel',k:'wings',c:['#bff4f8','#57a7d6'],fairy:1},
  w_phoenix:{n:'Phönixflügel',k:'wings',c:['#ffd24a','#ff5a2a'],fire:1},
  a_feuer:{n:'Feueraura',k:'aura',c:['#ff8a3a','#ffd24a']},
  a_eis:{n:'Eisaura',k:'aura',c:['#bfefff','#57a7d6']},
  a_schatten:{n:'Schattenaura',k:'aura',c:['#6a48c0','#2a1e3a']},
  a_gold:{n:'Goldaura',k:'aura',c:['#ffd24a','#fff3c0']},
  a_gift:{n:'Giftaura',k:'aura',c:['#79c24e','#c8f06a']},
  c_koenig:{n:'Königsumhang',k:'cape',c:['#b8242c','#6a1018'],trim:'#ffd24a'},
  c_sterne:{n:'Sternenumhang',k:'cape',c:['#2a2a6a','#14143a'],stars:1},
  // Level-Belohnungen (6.4, js/aufstieg.js): lvl = nur beim Erreichen dieses Levels, nie aus dem Glückstempel; ring = kreisende Funken
  c_aufstieg:{n:'Mantel des Aufstiegs',k:'cape',c:['#2a4a8a','#121e44'],trim:'#e8d8a0',lvl:60},
  w_aufstieg:{n:'Schwingen des Aufstiegs',k:'wings',c:['#fff3c0','#d8a040'],lvl:80},
  a_hundert:{n:'Aura der Hundert',k:'aura',c:['#ffe08a','#ffffff'],ring:1,lvl:100}
};

/* ---------- Materialien, Edelsteine, Rezepte ---------- */
const MATS = {
  erz:{n:'Eisenerz',c:'#9aa2ae',c2:'#5a606c'},
  leder:{n:'Leder',c:'#a8743e',c2:'#6a4424'},
  knochen:{n:'Knochenstaub',c:'#e8e2cf',c2:'#a8a08a'},
  schleim:{n:'Schleimkern',c:'#79c24e',c2:'#3a7a2a'},
  zahn:{n:'Orkzahn',c:'#f2ead2',c2:'#b8a888'},
  kristall:{n:'Seelenkristall',c:'#b892f4',c2:'#6a48c0'},
  horn:{n:'Dämonenhorn',c:'#d84a32',c2:'#7a1e18'},
  glut:{n:'Glutstein',c:'#ff8a3a',c2:'#c8402a'},
  mithril:{n:'Mithrilerz',c:'#9ee8f0',c2:'#2e6a7a'},
  adamant:{n:'Adamanterz',c:'#44c89a',c2:'#14403a'},
  schuppe:{n:'Drachenschuppe',c:'#e8d04a',c2:'#9c6a24'},
  stern:{n:'Sternenstaub',c:'#b0b8ff',c2:'#4a4ad0'},
  aether:{n:'Ätherkristall',c:'#ffe8a0',c2:'#c8a04a'},
  // Rohstoffe (6.2, res): sammeln in den Landen und im Versteck, bauen damit (js/bauen.js) – keine Gegner-Beute
  holz:{n:'Holz',c:'#b07a48',c2:'#6a4424',res:1,w:'Bäume (Holzplatz im Versteck, Endlose Lande), Kisten, Acker'},
  stein:{n:'Stein',c:'#a8a296',c2:'#5e5a54',res:1,w:'Felsen (Holzplatz im Versteck, Endlose Lande), Erzmine'},
  faser:{n:'Pflanzenfaser',c:'#c8d070',c2:'#5a7a26',res:1,w:'Büsche, Pilze und Kakteen, Kräutergarten, Acker (Flachs)'},
  samen:{n:'Samen',c:'#d8b060',c2:'#6a4a1e',res:1,w:'Büsche, Kräuterbeete, Kräutergarten, Ernte im Acker'},
  feder:{n:'Feder',c:'#f2ead2',c2:'#7a90c0',res:1,w:'Vogelnester in Bäumen, Holzplatz im Versteck, Kräutergarten'},
  eisenholz:{n:'Eisenholz',c:'#7a8494',c2:'#2e343e',res:1,w:'Bäume tiefer in den Landen (alte und dunkle Wälder), Acker'},
  marmor:{n:'Marmor',c:'#eee8dc',c2:'#a8a090',res:1,w:'helle Felsen und Säulen in den Landen, Erzmine ab Stufe 6'},
  obsidian:{n:'Obsidian',c:'#5a4878',c2:'#140e1e',res:1,w:'dunkle Felsen und Obsidian in Glut-Gebieten, Erzmine ab Stufe 8'},
  sternholz:{n:'Sternholz',c:'#a8b8ff',c2:'#3a3a8a',res:1,w:'Sternenbäume weit draußen in den Landen, Acker (Sternblume)'}
};
const MATORDER = ['erz','leder','knochen','schleim','zahn','kristall','horn','glut','mithril','adamant','schuppe','stern','aether','holz','stein','faser','samen','feder','eisenholz','marmor','obsidian','sternholz'];
// Gegner-Materialien in Stufen-Reihenfolge (Beute, Truhen, Händler wählen „bis Stufe n“ daraus) – ohne die Rohstoffe
const MONMATS = MATORDER.filter(k => !MATS[k].res);
const GEMS = {
  rubin:{n:'Rubin',c:'#e8402a',eff:'dmg',v:[.03,.05,.08,.12,.18],s:v=>_t('Schaden +{v}',{v:pct(v)})},
  saphir:{n:'Saphir',c:'#57a7d6',eff:'def',v:[2,4,7,11,16],s:v=>_t('VER +{v}',{v})},
  smaragd:{n:'Smaragd',c:'#3ac87a',eff:'crit',v:[.01,.02,.035,.05,.07],s:v=>_t('Krit +{v}',{v:pct(v)})},
  amethyst:{n:'Amethyst',c:'#b892f4',eff:'hp',v:[.03,.05,.08,.12,.17],s:v=>_t('LP +{v}',{v:pct(v)})},
  topas:{n:'Topas',c:'#e8d04a',eff:'gold',v:[.05,.1,.16,.24,.35],s:v=>_t('Gold +{v}',{v:pct(v)})}
};
const GEMORDER = ['rubin','saphir','smaragd','amethyst','topas'];
const GEMGRADE = ['Gesplitterter','Kleiner','Feiner','Makelloser','Königlicher'];
const UPCHANCE = [1,1,1,1,1,.85,.7,.55,.45,.35];
const RECIPES = [
  {id:'potion',n:'Heiltrank ×2',d:'Zwei Heiltränke brauen',cost:{schleim:1},gold:15},
  {id:'reroll',n:'Umschmieden',d:'Zusatzwerte eines Gegenstands neu würfeln',cost:{kristall:2},gold:80,needItem:true},
  {id:'socket',n:'Sockel bohren',d:'Einen Sockel hinzufügen (max. 3)',cost:{horn:1,erz:4},gold:100,needItem:true},
  {id:'gem',n:'Edelstein zufällig',d:'Einen zufälligen Edelstein-Splitter herstellen',cost:{kristall:1,erz:2},gold:30}
];
/* Schmieden nach Material: garantiert diese Stufe */
const FORGE = [
  {w:{erz:6},a:{leder:6}},
  {w:{erz:10,zahn:2},a:{leder:8,erz:4}},
  {w:{mithril:5,erz:6},a:{mithril:4,leder:6}},
  {w:{adamant:5,zahn:4},a:{adamant:4,leder:8}},
  {w:{schuppe:3,horn:3},a:{schuppe:3,leder:10}},
  {w:{glut:6,horn:4,adamant:2},a:{glut:5,horn:3,leder:10}},
  {w:{stern:5,kristall:6},a:{stern:4,kristall:5}},
  {w:{aether:4,stern:4,schuppe:3},a:{aether:3,stern:4,schuppe:3}}
];
/* Veredeln: 5 einfache → 1 besseres Material */
const TRANSMUTE = [['erz','zahn',5,20],['leder','knochen',5,20],['knochen','kristall',6,40],['schleim','kristall',6,40],['erz','mithril',8,60],['zahn','horn',5,60],['mithril','adamant',5,90],['kristall','glut',4,90],['horn','schuppe',5,160],['glut','stern',6,200],['adamant','schuppe',4,200],['stern','aether',5,300]];

/* ---------- Gegner ---------- */
const EN = {
  goblin:{name:'Goblin',sp:'goblin',hp:24,atk:6,spd:56,r:5,xp:6,gold:3,ai:'melee',reach:13,wind:.36,cd:.95,wpn:'knife',hand:[3,-4],cost:1,from:1,blood:'#4a8a2a',drop:{leder:.3},desc:'Feige in Gruppen, gefährlich im Rudel.'},
  skeleton:{name:'Skelettkrieger',sp:'skelet',hp:36,atk:9,spd:44,r:5,xp:9,gold:4,ai:'melee',reach:17,wind:.44,cd:1.05,wpn:'rusty_sword',hand:[3,-4],cost:1.5,from:2,blood:'#e8e2cf',drop:{knochen:.4},desc:'Rasselt heran und schlägt mit rostigen Klingen zu.'},
  gobarcher:{name:'Goblin-Schütze',sp:'goblin',tint:'rgba(120,80,30,.3)',hp:20,atk:7,spd:52,r:5,xp:8,gold:4,ai:'archer',wpn:'bow',hand:[3,-5],cost:1.4,from:2,blood:'#4a8a2a',drop:{leder:.35},desc:'Schießt aus sicherer Entfernung – und rennt weg, wenn du kommst.'},
  lizard:{name:'Echsenmensch',sp:'lizard',hp:34,atk:8,spd:64,r:5,xp:9,gold:4,ai:'lunge',wpn:'spear',hand:[3,-8],cost:1.5,from:3,blood:'#4a8a2a',drop:{leder:.4},desc:'Springt mit dem Speer aus der Distanz an.'},
  bomber:{name:'Wogol-Sprengmeister',sp:'wogol',hp:28,atk:15,spd:42,r:5,xp:11,gold:6,ai:'bomber',cost:2,from:3,blood:'#b8302a',drop:{erz:.35},desc:'Wirft Bomben – trifft dabei auch seine Freunde.'},
  skelarcher:{name:'Knochenschütze',sp:'skelet',tint:'rgba(255,240,200,.25)',hp:30,atk:9,spd:40,r:5,xp:10,gold:5,ai:'archer',wpn:'bow2',hand:[3,-5],cost:1.7,from:3,blood:'#e8e2cf',drop:{knochen:.45},desc:'Seine Pfeile sind alt, aber spitz.'},
  slime:{name:'Sumpfschleim',sp:'swampy',hp:42,atk:8,spd:32,r:6,xp:8,gold:3,ai:'melee',reach:8,wind:.4,cd:1.1,cost:1.5,from:4,blood:'#5aa83a',split:true,drop:{schleim:.55},desc:'Teilt sich beim Tod in zwei Schleimlinge.'},
  minislime:{name:'Schleimling',sp:'muddy',hp:14,atk:4,spd:48,r:4,xp:3,gold:1,ai:'melee',reach:8,wind:.3,cd:.9,cost:99,from:99,blood:'#8a6a3a',drop:{schleim:.2},desc:'Klein, schnell, klebrig.'},
  mage:{name:'Nekromant',sp:'necro',hp:28,atk:11,spd:34,r:5,xp:12,gold:6,ai:'caster',wpn:'red_staff',hand:[3,-6],cost:2,from:4,blood:'#8a4ad8',summon:'tinyz',orb:'darkorb',drop:{kristall:.25},desc:'Schleudert Schattenkugeln und erweckt Zombies.'},
  geist:{name:'Gruftgeist',sp:'necro',tint:'rgba(200,230,255,.6)',hp:30,atk:10,spd:46,r:5,xp:12,gold:5,ai:'ghost',cost:2,from:4,blood:'#bfefff',drop:{kristall:.3},desc:'Gleitet durch Säulen und verschwindet, wenn du zuschlägst.'},
  orc:{name:'Orkkrieger',sp:'orc',hp:64,atk:13,spd:46,r:6,xp:15,gold:8,ai:'melee',reach:17,wind:.42,cd:.95,wpn:'baton',hand:[3,-6],cost:2.5,from:5,blood:'#b8302a',drop:{zahn:.4},desc:'Muskeln, Keule, keine Gnade.'},
  skelmage:{name:'Knochenmagier',sp:'skelet',tint:'rgba(150,80,255,.38)',hp:30,atk:12,spd:34,r:5,xp:13,gold:6,ai:'caster',wpn:'green_staff',hand:[3,-6],orb:'darkbolt',cost:2,from:5,blood:'#c8a8ff',drop:{knochen:.4,kristall:.15},desc:'Schleudert Schattenblitze aus leeren Augenhöhlen.'},
  lizshaman:{name:'Echsenschamanin',sp:'lizardf',hp:40,atk:11,spd:40,r:5,xp:14,gold:7,ai:'caster',wpn:'green_staff',hand:[3,-8],orb:'waterbolt',aff:['heiler'],cost:2.2,from:5,blood:'#4a8a6a',drop:{leder:.4,mithril:.15},desc:'Heilt ihre Sippe und verlangsamt Feinde mit Wasserkugeln.'},
  ogre:{name:'Oger',sp:'ogre',hp:140,atk:20,spd:28,r:10,xp:26,gold:14,ai:'slam',wpn:'big_hammer',hand:[6,-12],cost:4,from:6,mass:3,blood:'#b8302a',drop:{zahn:.6,erz:.4},desc:'Sein Hammer erzeugt Schockwellen.'},
  toxslime:{name:'Giftschleim',sp:'swampy',tint:'rgba(170,60,230,.42)',hp:50,atk:9,spd:30,r:6,xp:11,gold:4,ai:'melee',reach:8,wind:.4,cd:1.1,trail:'gift',cost:2,from:6,blood:'#a050d8',drop:{schleim:.6},desc:'Hinterlässt giftige Pfützen.'},
  zwerg:{name:'Abtrünniger Zwerg',sp:'dwarf',tint:'rgba(90,20,20,.28)',hp:88,atk:15,spd:44,r:6,xp:18,gold:12,ai:'charge',wpn:'mace',hand:[3,-7],mass:2,cost:3,from:6,blood:'#b8302a',drop:{erz:.6,mithril:.2},desc:'Hat den Orden verraten – für Gold, das ihm nicht gehört.'},
  berserker:{name:'Ork-Berserker',sp:'masked',hp:95,atk:16,spd:42,r:6,xp:22,gold:12,ai:'charge',wpn:'waraxe',hand:[3,-6],cost:3.5,from:7,mass:2.4,blood:'#b8302a',drop:{zahn:.5},desc:'Stürmt blind los – und kracht gern gegen Säulen.'},
  wurm:{name:'Grubenwurm',sp:'slug',hp:70,atk:14,spd:62,r:6,xp:16,gold:8,ai:'burrow',cost:2.8,from:7,mass:1.6,blood:'#6a8a2a',drop:{schleim:.4,adamant:.12},desc:'Gräbt sich ein und bricht unter deinen Füßen hervor.'},
  kuerbis:{name:'Kürbisgeist',sp:'pumpkin',hp:46,atk:16,spd:58,r:5,xp:14,gold:9,ai:'lunge',boomDeath:1,cost:2.5,from:7,blood:'#ff8a3a',drop:{leder:.3,glut:.1},desc:'Grinst, springt – und explodiert.'},
  imp:{name:'Imp',sp:'imp',hp:52,atk:12,spd:62,r:5,xp:16,gold:9,ai:'swoop',cost:3,from:8,mass:1.4,blood:'#ff8a3a',drop:{horn:.3},desc:'Kreist in der Luft und stürzt herab.'},
  seuche:{name:'Seuchendoktor',sp:'doc',tint:'rgba(120,200,60,.32)',hp:44,atk:13,spd:40,r:5,xp:15,gold:9,ai:'bomber',flask:1,cost:2.6,from:8,blood:'#79c24e',drop:{schleim:.4,kristall:.15},desc:'Wirft Giftflaschen, die Pfützen hinterlassen.'},
  chort:{name:'Hornteufel',sp:'chort',hp:74,atk:14,spd:72,r:6,xp:18,gold:10,ai:'lunge',cost:3,from:9,mass:1.6,blood:'#b8302a',drop:{horn:.45},desc:'Der schnellste Teufel der Glutfeste.'},
  pyro:{name:'Feuermagier',sp:'wizard',tint:'rgba(255,90,40,.32)',hp:42,atk:15,spd:36,r:5,xp:16,gold:10,ai:'caster',wpn:'red_staff',hand:[3,-6],orb:'fireball',cost:2.6,from:9,blood:'#ff8a3a',drop:{glut:.3},desc:'Ein abtrünniger Ordensmagier. Seine Feuerkugeln brennen.'},
  glutschleim:{name:'Glutschleim',sp:'muddy',tint:'rgba(255,110,30,.48)',hp:40,atk:11,spd:44,r:5,xp:12,gold:6,ai:'melee',reach:8,wind:.35,cd:1,trail:'feuer',boomDeath:1,cost:2,from:9,blood:'#ff8a3a',drop:{glut:.3},desc:'Hinterlässt Feuer und platzt beim Tod.'},
  golem:{name:'Steingolem',sp:'bigz',tint:'rgba(150,130,105,.55)',hp:220,atk:24,spd:22,r:10,xp:36,gold:18,ai:'slam',aff:['gepanzert'],mass:4,cost:5,from:10,blood:'#8a7a6a',drop:{erz:1,adamant:.3},desc:'Fels mit Wut. Erst den Panzer brechen.'},
  hexe:{name:'Sumpfhexe',sp:'wizf',tint:'rgba(90,200,80,.34)',hp:46,atk:13,spd:36,r:5,xp:17,gold:10,ai:'caster',wpn:'green_staff',hand:[3,-6],orb:'plant',summon:'toxslime',cost:3,from:10,blood:'#79c24e',drop:{schleim:.5,kristall:.2},desc:'Ruft Giftschleime aus dem Morast.'},
  zombie:{name:'Moderriese',sp:'bigz',hp:180,atk:22,spd:25,r:10,xp:32,gold:16,ai:'slam',cost:4.5,from:11,mass:3.4,blood:'#6a8a3a',drop:{knochen:.7},desc:'Langsam, zäh und erschreckend stark.'},
  engel:{name:'Gefallener Engel',sp:'angel',tint:'rgba(60,20,80,.48)',hp:60,atk:14,spd:64,r:5,xp:18,gold:11,ai:'swoop',cost:3,from:11,mass:1.3,blood:'#b892f4',drop:{kristall:.35,stern:.08},desc:'Einst Wächter des Ordens. Jetzt nur noch Zorn.'},
  schattenimp:{name:'Schattenimp',sp:'imp',tint:'rgba(60,30,120,.52)',hp:56,atk:13,spd:66,r:5,xp:17,gold:10,ai:'swoop',aff:['teleport'],cost:3,from:11,mass:1.4,blood:'#6a48c0',drop:{horn:.3},desc:'Blinzelt durch die Schatten direkt hinter dich.'},
  icez:{name:'Frostgeist',sp:'icez',hp:40,atk:10,spd:40,r:5,xp:12,gold:6,ai:'caster',cost:2,from:12,blood:'#8ee6ea',orb:'waterorb',drop:{kristall:.3},desc:'Seine Eiskugeln verlangsamen.'},
  elfe:{name:'Dunkelelfen-Jägerin',sp:'elff',tint:'rgba(110,50,170,.42)',hp:48,atk:13,spd:70,r:5,xp:17,gold:11,ai:'archer',wpn:'bow2',hand:[3,-7],cost:3,from:12,blood:'#8a4ad8',drop:{leder:.4,stern:.06},desc:'Schnell, präzise, gnadenlos. Schießt Dreiersalven.'},
  lavadaemon:{name:'Lavadämon',sp:'chort',tint:'rgba(255,120,30,.42)',hp:84,atk:16,spd:70,r:6,xp:20,gold:12,ai:'lunge',aff:['brennend'],cost:3.4,from:12,mass:1.6,blood:'#ff8a3a',drop:{glut:.45,horn:.2},desc:'Wo er läuft, brennt der Boden.'},
  eisgeist:{name:'Eisgespenst',sp:'icez',tint:'rgba(220,245,255,.5)',hp:46,atk:12,spd:48,r:5,xp:15,gold:8,ai:'ghost',frosty:1,cost:2.4,from:13,blood:'#bfefff',drop:{kristall:.3,mithril:.2},desc:'Ein eisiger Hauch, der dich verlangsamt.'},
  frostoger:{name:'Frostoger',sp:'ogre',tint:'rgba(140,200,255,.42)',hp:170,atk:23,spd:28,r:10,xp:34,gold:17,ai:'slam',aff:['frostig'],wpn:'big_hammer',hand:[6,-12],mass:3,cost:4.5,from:13,blood:'#8ee6ea',drop:{mithril:.4,zahn:.4},desc:'Sein Hammer lässt die Luft gefrieren.'},
  todesritter:{name:'Todesritter',sp:'knight',tint:'rgba(30,10,30,.62)',hp:150,atk:20,spd:46,r:6,xp:30,gold:18,ai:'charge',wpn:'knight_sword',hand:[4,-9],mass:2.6,cost:4.5,from:14,blood:'#6a1a28',drop:{adamant:.35,kristall:.3},desc:'Varkas\' Garde. Sie kennt keinen Schmerz.'},
  jungdrache:{name:'Jungdrache',sp:'demon',tint:'rgba(200,40,20,.38)',sc:.72,hp:240,atk:22,spd:34,r:11,xp:44,gold:24,ai:'dragon',summon:'imp',mass:4,cost:6,from:16,blood:'#ff8a3a',drop:{schuppe:.5,glut:.4},desc:'Pyraxis\' Brut. Klein – für einen Drachen.'},
  tinyz:{name:'Kriechzombie',sp:'tinyz',hp:16,atk:5,spd:46,r:4,xp:3,gold:1,ai:'melee',reach:9,wind:.35,cd:1,cost:99,from:99,blood:'#6a8a3a',drop:{knochen:.2},desc:'Vom Nekromanten erweckt.'},
  mimic:{name:'Mimik',sp:'mimic',hp:90,atk:15,spd:62,r:6,xp:25,gold:40,ai:'lunge',cost:99,from:99,blood:'#b8302a',drop:{kristall:1},desc:'Sieht aus wie eine Truhe. Ist keine.'},
  goldmimik:{name:'Goldmimik',sp:'mimic',tint:'rgba(255,210,60,.48)',hp:130,atk:18,spd:68,r:6,xp:40,gold:140,ai:'lunge',cost:99,from:99,blood:'#e8d04a',drop:{kristall:1,mithril:1},desc:'Diese Truhe beißt – und zahlt gut.'},
  shaman:{name:'Orkschamane',sp:'shaman',hp:32,atk:12,spd:34,r:5,xp:12,gold:7,ai:'caster',wpn:'green_staff',hand:[3,-6],cost:99,from:99,blood:'#4a8a2a',summon:'orc',orb:'plant',drop:{kristall:.4},desc:'Ruft Orks und schleudert Dornengeschosse.'},
  goldgob:{name:'Schatzgoblin',sp:'goblin',hp:60,atk:0,spd:70,r:5,xp:40,gold:120,ai:'flee',cost:99,from:99,blood:'#e8d04a',drop:{},desc:'Rennt mit seinem Gold davon. Schnapp ihn dir!'},
  demon:{name:'Höllenschlund',sp:'demon',hp:540,atk:24,spd:30,r:13,xp:60,gold:40,ai:'dragon',summon:'imp',boss:true,mass:8,blood:'#ff8a3a',drop:{horn:4,schuppe:2},desc:'Herrscher der Glutfeste.'},
  frostra:{name:'Eiskönigin',sp:'wizf',hp:60,atk:20,spd:36,r:6,xp:70,gold:50,ai:'caster',orb:'waterorb',summon:'eisgeist',nova:1,boss:true,mass:6,blood:'#bfefff',drop:{mithril:6,kristall:4},desc:'Einst die größte Magierin des Ordens.'},
  morbus:{name:'Seuchenfürst',sp:'doc',hp:60,atk:22,spd:38,r:6,xp:80,gold:55,ai:'bomber',flask:1,summon:'toxslime',boss:true,mass:6,blood:'#79c24e',drop:{adamant:5,schleim:6},desc:'Züchtet Pyraxis\' Brut im Giftsumpf.'},
  varkas:{name:'Todesritter',sp:'knight',glow:'#ff3a5a',hp:160,atk:26,spd:48,r:7,xp:90,gold:60,ai:'charge',wpn:'anime_sword',hand:[4,-9],summon:'skeleton',boss:true,mass:7,blood:'#6a1a28',drop:{adamant:4,stern:4},desc:'Der Verräter des Ordens.'},
  pyraxis:{name:'Uralter Drache',sp:'demon',hp:540,atk:30,spd:32,r:13,xp:120,gold:90,ai:'dragon',summon:'jungdrache',boss:true,mass:9,blood:'#ff8a3a',drop:{schuppe:6,aether:3},desc:'Der Drache, der das Weltenfeuer stahl.'},
  dummy:{name:'Trainingspuppe',sp:'skelet',hp:500,atk:0,spd:0,r:7,xp:0,gold:0,ai:'dummy',hidden:1,cost:99,from:99,blood:'#c8a878',drop:{},desc:''}
};
const BOSSES = [
  {type:'ogre',name:'Ogerhäuptling Grausch',sc:1.6,hpMul:4.5,tint:'rgba(255,60,40,.3)'},
  {type:'shaman',name:'Schamane Vexhal',sc:1.9,hpMul:13},
  {type:'zombie',name:'Moderkönig Morgul',sc:1.7,hpMul:3.6,tint:'rgba(120,255,140,.22)'},
  {type:'demon',name:'Höllenschlund Ignaroth',sc:2,hpMul:1.15},
  {type:'frostra',name:'Eiskönigin Frostra',sc:1.9,hpMul:12,tint:'rgba(170,230,255,.5)'},
  {type:'morbus',name:'Seuchenfürst Morbus',sc:2,hpMul:10,tint:'rgba(120,200,60,.38)'},
  {type:'varkas',name:'Todesritter Varkas',sc:2,hpMul:3.6,tint:'rgba(70,0,30,.42)'},
  {type:'pyraxis',name:'Uralter Drache Pyraxis',sc:2.5,hpMul:1.7,tint:'rgba(210,30,10,.38)'}
];
const STORY_ACTS = BOSSES.length;   // danach beginnen die Qual-Stufen
const CHAMPS = ['Grimmzahn der Schlächter','Vela die Flinke','Knochenbrecher Thorg','Die Graue Witwe','Kerax Blutdurst','Skarn der Unbeugsame','Morra Schattenhand','Brutus Eisenkiefer','Ilse die Verfluchte','Zagg der Hungrige'];
const AFFIX = {
  schnell:{n:'Schnell',c:'#8ee6ea'},
  explosiv:{n:'Explosiv',c:'#ff8a3a'},
  gepanzert:{n:'Gepanzert',c:'#c8c8d8'},
  heiler:{n:'Heiler',c:'#79c24e'},
  vampir:{n:'Vampir',c:'#c8342c'},
  teleport:{n:'Teleport',c:'#b892f4'},
  frostig:{n:'Frostig',c:'#bfefff'},
  brennend:{n:'Brennend',c:'#ffb03a'},
  riese:{n:'Riese',c:'#e8b04a'}
};

/* ---------- Gebiete, Schwierigkeit ---------- */
const BIOMES = [
  {key:'kerker',name:'Kerker',tint:[1,1,1],dark:.4,root:45,dust:'#8a7a6a',vein:'erz',map:['#3a3440','#2e2834','#463e4c','#25202a']},
  {key:'moss',name:'Moosgrotte',tint:[.78,1.04,.74],dark:.45,root:43,dust:'#7a9a62',vein:'erz',pool:'wasser',map:['#2e4a2a','#263e22','#3a5a32','#1e3220']},
  {key:'gruft',name:'Knochengruft',tint:[.8,.84,1.02],dark:.52,root:41,dust:'#8a8496',vein:'kristall',map:['#34344a','#2a2a3e','#40405a','#22223a']},
  {key:'glut',name:'Glutfeste',tint:[1.18,.8,.62],dark:.34,root:40,dust:'#8a5a4a',vein:'glut',pool:'lava',map:['#4a2a22','#3a201a','#5a3426','#2e1812']},
  {key:'frost',name:'Frostgipfel',tint:[.86,.98,1.22],dark:.36,root:47,dust:'#c8e0f0',vein:'mithril',pool:'eis',map:['#5a7088','#4a5e74','#6a849c','#3e5064']},
  {key:'sumpf',name:'Giftsumpf',tint:[.86,.96,.72],dark:.5,root:42,dust:'#7a8a52',vein:'adamant',pool:'gift',map:['#3a4228','#2e3620','#4a5230','#262c1a']},
  {key:'schatten',name:'Schattenzitadelle',tint:[.74,.7,.98],dark:.6,root:38,dust:'#6a5a8a',vein:'stern',map:['#2a2440','#221c34','#342c4e','#1a1628']},
  {key:'hort',name:'Drachenhort',tint:[1.16,.94,.66],dark:.32,root:44,dust:'#a88a4a',vein:'schuppe',pool:'lava',map:['#4a3a22','#3e301c','#5a4628','#2e2414']}
];
const HIDE_BIOME = {key:'versteck',name:'Versteck',tint:[1.06,1,.9],dark:.22,root:48,dust:'#8a7a6a',vein:'erz'};
const DIFFS = {
  normal:{n:'Normal',hp:1,dmg:1,loot:1,elite:.1,affix:[1,1],heal:.25,d:'Fordernd, aber fair.'},
  nightmare:{n:'Albtraum',hp:1.7,dmg:1.55,loot:1.6,elite:.16,affix:[1,2],heal:.2,d:'Härtere Gegner, bessere Beute.'},
  hell:{n:'Hölle',hp:2.6,dmg:2.2,loot:2.4,elite:.26,affix:[2,3],heal:.12,d:'Nur für Wahnsinnige. Die beste Beute.'}
};
const NODE = {
  kampf:{n:'Kampf',icon:['w','rusty_sword'],c:'#c8c8c8',d:'Mehrere Wellen von Gegnern.'},
  elite:{n:'Elite',icon:['s',288,432,16,16],c:'#e8b04a',d:'Starke Gegner mit Affixen. Garantierte Beute.'},
  champion:{n:'Champion',icon:['sp','masked'],c:'#ff6a3a',d:'Ein berüchtigter Champion mit Gefolge. Beste Beute, vielleicht eine Glücksmünze.'},
  ueberleben:{n:'Überleben',icon:['fx','ring',10],c:'#ff8a3a',d:'Halte 45 Sekunden durch.'},
  schatz:{n:'Schatzkammer',icon:['s',304,416,16,16],c:'#e8d04a',d:'Truhen, Erzadern – und vielleicht ein Mimik.'},
  goblin:{n:'Schatzgoblin',icon:['sp','goblin'],c:'#e8d04a',d:'Fang den Goblin, bevor er mit seinem Gold flieht.'},
  dunkel:{n:'Dunkelkammer',icon:['fx','darkorb',0],c:'#8a7aa8',d:'Nur dein eigenes Licht. Mehr Beute.'},
  haendler:{n:'Händler',icon:['sp','dwarf'],c:'#79c24e',d:'Ausrüstung, Tränke und Edelsteine kaufen.'},
  schrein:{n:'Schrein',icon:['fx','sparks',2],c:'#b892f4',d:'Wähle einen Segen – oder einen lohnenden Fluch.'},
  werkbank:{n:'Werkbank',icon:['s',288,408,16,24],c:'#57a7d6',d:'Aufwerten, schmieden, verschmelzen. Heilt 50 %.'},
  rast:{n:'Rastplatz',icon:['pa','feuer'],c:'#ffb03a',d:'Ein sicheres Lagerfeuer. Heilt 40 % und erzählt Geschichten.'},
  raetsel:{n:'Rätselkammer',icon:['pa','frage'],c:'#57c7e6',d:'Eine steinerne Sphinx stellt dir ein Rätsel.'},
  event:{n:'Ereignis',icon:['s',288,352,16,16],c:'#efe2bf',d:'Etwas Unerwartetes wartet.'},
  boss:{n:'Boss',icon:['s',16,428,32,36],c:'#c8463c',d:'Der Herrscher dieses Gebiets.'}
};
const SHRINES = [
  {id:'wut',n:'Schrein der Wut',bn:'Wut',d:'+35 % Schaden für 3 Räume',buff:{dmg:.35},rooms:3},
  {id:'stein',n:'Schrein des Steins',bn:'Stein',d:'+12 Verteidigung für 3 Räume',buff:{def:12},rooms:3},
  {id:'gier',n:'Schrein der Gier',bn:'Gier',d:'+60 % Gold für 3 Räume',buff:{gold:.6},rooms:3},
  {id:'eile',n:'Schrein der Eile',bn:'Eile',d:'+20 % Tempo, −20 % Abklingzeiten für 3 Räume',buff:{spd:.2,cdr:.2},rooms:3},
  {id:'fluch',n:'Verfluchter Altar',d:'Gegner +50 % LP, aber doppelte Beute für 3 Räume',buff:{curse:1,loot:1},rooms:3},
  {id:'blut',n:'Blutaltar',d:'Sofort 30 % LP verlieren, +1 Talentpunkt',instant:'blood'},
  {id:'ahnen',n:'Schrein der Ahnen',bn:'Ahnen',d:'+15 % Schaden und LP für 4 Räume',buff:{dmg:.15,hp:.15},rooms:4},
  {id:'fortuna',n:'Schrein Fortunas',d:'Sofort 1 Glücksmünze',instant:'coin'}
];
const EVENTS = [
  {id:'brunnen',n:'Mysteriöser Brunnen',d:'Ein Brunnen voller schimmerndem Wasser.',opts:[{n:'Trinken (voll heilen)',a:'heal'},{n:'Münze werfen (50 Gold: Glücksspiel)',a:'gamble'}]},
  {id:'gefangener',n:'Gefangener Händler',d:'Ein Zwerg sitzt in einem Käfig. Er verspricht eine Belohnung.',opts:[{n:'Befreien (Kampf gegen Wachen)',a:'rescue'},{n:'Weitergehen',a:'leave'}]},
  {id:'truhe',n:'Verfluchte Truhe',d:'Eine Truhe, umgeben von dunklem Nebel.',opts:[{n:'Öffnen (Elite-Kampf, epische Beute)',a:'cursed'},{n:'Liegen lassen',a:'leave'}]},
  {id:'schmied',n:'Wandernder Schmied',d:'Ein Schmied bietet eine kostenlose Aufwertung an.',opts:[{n:'Waffe aufwerten (+1)',a:'upw'},{n:'Rüstung aufwerten (+1)',a:'upa'}]},
  {id:'alchemist',n:'Alchemistin',d:'Eine Hexe mischt Tränke.',opts:[{n:'2 Heiltränke nehmen',a:'potions'},{n:'Materialien tauschen (zufällig ×3)',a:'mats'}]},
  {id:'ritter',n:'Verwundeter Ordensritter',d:'Ein alter Ritter mit dem Wappen von Klingenhort lehnt an einer Wand. Er blutet stark.',opts:[{n:'Einen Heiltrank geben',a:'knight'},{n:'Weitergehen',a:'leave'}]},
  {id:'opfer',n:'Opferaltar',d:'Ein Altar verlangt ein Opfer. Was du gibst, kehrt verwandelt zurück – vielleicht.',opts:[{n:'Schwächsten Gegenstand aus dem Beutel opfern',a:'sacrifice'},{n:'Weitergehen',a:'leave'}]},
  {id:'kraemer',n:'Goblin-Krämer',d:'„Wundertüte! Nur 120 Gold! Garantiert … irgendwas!“',opts:[{n:'Wundertüte kaufen (120 Gold)',a:'bag'},{n:'Weitergehen',a:'leave'}]},
  {id:'grab',n:'Grab eines Ordensritters',d:'Ein steinernes Grab. Auf dem Deckel liegt ein verblichenes Schwert.',opts:[{n:'Plündern (Gold und Beute, aber die Toten erwachen)',a:'grave'},{n:'Ehre erweisen (Segen der Ahnen)',a:'honor'}]},
  {id:'quelle',n:'Glücksquelle',d:'Goldene Münzen glänzen am Grund einer Quelle.',opts:[{n:'Glücksmünze opfern (30 %: drei zurück)',a:'luckwell'},{n:'Daraus trinken (+30 % LP)',a:'drink'}]}
];
const RIDDLES = [
  {q:'Ich habe Städte, aber keine Häuser, Wälder, aber keine Bäume, Wasser, aber keine Fische. Was bin ich?',a:['Eine Karte','Ein Traum','Ein Spiegel']},
  {q:'Je mehr du davon machst, desto mehr lässt du hinter dir.',a:['Schritte','Gold','Fehler']},
  {q:'Was gehört dir, wird aber von anderen viel öfter benutzt?',a:['Dein Name','Dein Schwert','Dein Gold']},
  {q:'Ich spreche ohne Mund und höre ohne Ohren. Ich habe keinen Körper, doch ich erwache mit dem Wind.',a:['Ein Echo','Ein Geist','Ein Drache']},
  {q:'Was wird nasser, je mehr es trocknet?',a:['Ein Handtuch','Ein Fluss','Eine Klinge']},
  {q:'Ich bin immer hungrig und muss immer fressen. Der Finger, den ich berühre, wird bald rot.',a:['Feuer','Ein Wolf','Ein Vampir']},
  {q:'Je mehr man wegnimmt, desto größer wird es.',a:['Ein Loch','Ein Berg','Ein Schatz']},
  {q:'Ich habe Zähne, aber ich beiße nicht.',a:['Ein Kamm','Ein Mimik','Ein Drache']},
  {q:'Morgens auf vier Beinen, mittags auf zwei, abends auf dreien. Wer ist es?',a:['Der Mensch','Der Oger','Die Spinne']}
];

/* ---------- Versteck: Gebäude ----------
   lv: Kosten je Stufe, d: was die Stufe bringt */
const BUILD = {
  feuer:{n:'Lagerfeuer',icon:'feuer',fixed:1,d0:'Das Herz des Verstecks. Einmal pro Akt vollständig heilen.'},
  portal:{n:'Portal',icon:'portal',fixed:1,d0:'Zurück zur Weltkarte.'},
  spiegel:{n:'Spiegel der Gestalt',icon:'spiegel',fixed:1,d0:'Aussehen deines Helden jederzeit ändern.'},
  schmiede:{n:'Schmiede',icon:'amboss',npc:'Borin',body:'dwarf',lv:[{gold:120,erz:8,holz:6,stein:4},{gold:700,erz:16,zahn:4,holz:12,stein:10},{gold:1800,mithril:6,horn:3,holz:20,stein:16},{gold:4500,adamant:6,schuppe:3,eisenholz:6,stein:24},{gold:7000,adamant:8,eisenholz:10,marmor:6},{gold:10000,schuppe:5,eisenholz:14,marmor:10},{gold:14000,stern:4,obsidian:6,marmor:14},{gold:19000,stern:6,obsidian:10,eisenholz:20},{gold:26000,aether:2,obsidian:14,sternholz:4},{gold:35000,aether:4,sternholz:8,obsidian:18}],d:['Aufwerten, Schmieden und Verschmelzen im Versteck','+5 % Aufwertungs-Chance, Schmieden 20 % günstiger','+10 % Aufwertungs-Chance','Drachenesse: bis zu 5 Verschmelzungen pro Gegenstand, +15 % Chance','+16 % Aufwertungs-Chance','Schmieden 25 % günstiger, +17 % Aufwertungs-Chance','+18 % Aufwertungs-Chance','Schmieden 30 % günstiger, +19 % Aufwertungs-Chance','+20 % Aufwertungs-Chance','Sternenesse: Schmieden 35 % günstiger, +21 % Aufwertungs-Chance']},
  alchemie:{n:'Alchemielabor',icon:'kessel',npc:'Mira',body:'wizf',lv:[{gold:150,schleim:4,holz:6,stein:2},{gold:600,schleim:8,kristall:2,holz:10,stein:6},{gold:1600,kristall:5,glut:2,holz:16,faser:8},{gold:4000,stern:3,schleim:12,marmor:4,faser:12},{gold:6500,kristall:10,glut:6,marmor:8,faser:16},{gold:9500,stern:5,eisenholz:10,faser:20},{gold:13000,adamant:8,marmor:14,faser:24},{gold:18000,stern:8,obsidian:8,faser:30},{gold:25000,aether:2,sternholz:4,marmor:20},{gold:34000,aether:4,sternholz:8,obsidian:14}],d:['Tränke brauen, Trank-Vorrat 10','Heiltränke heilen 55 %','Elixiere brauen, Trank-Vorrat 12','Heiltränke heilen 65 %, Trank-Vorrat 14','Trank-Vorrat 15','Heiltränke heilen 68 %','Trank-Vorrat 16','Heiltränke heilen 70 %','Trank-Vorrat 18','Heiltränke heilen 75 %, Trank-Vorrat 20']},
  juwelier:{n:'Juwelier',icon:'juwel',npc:'Selis',body:'elff',lv:[{gold:200,kristall:2,erz:6,holz:6,stein:4},{gold:900,kristall:6,holz:10,stein:8},{gold:2600,stern:2,kristall:8,marmor:4},{gold:5000,kristall:12,marmor:8,eisenholz:4},{gold:8000,stern:4,marmor:12},{gold:11000,adamant:6,obsidian:6},{gold:15000,stern:6,obsidian:10},{gold:20000,schuppe:6,marmor:20,obsidian:12},{gold:27000,aether:3,sternholz:4},{gold:36000,aether:5,sternholz:8,obsidian:16}],d:['Edelsteine einsetzen, verschmelzen, Materialien veredeln','Edelsteine verschmelzen kostet die Hälfte','+50 % Edelstein-Funde','+60 % Edelstein-Funde','+70 % Edelstein-Funde','+80 % Edelstein-Funde','+90 % Edelstein-Funde','+100 % Edelstein-Funde','+110 % Edelstein-Funde','+120 % Edelstein-Funde']},
  lager:{n:'Schatzkammer',icon:'truhe',lv:[{gold:150,leder:6,holz:8},{gold:500,erz:10,holz:12,stein:6},{gold:1200,mithril:4,holz:18,stein:12},{gold:2600,adamant:4,holz:24,stein:18},{gold:5000,schuppe:2,eisenholz:6,stein:24},{gold:7000,eisenholz:10,marmor:6},{gold:9000,eisenholz:14,marmor:10,leder:20},{gold:12000,eisenholz:18,marmor:14,adamant:6},{gold:15000,obsidian:6,eisenholz:22},{gold:19000,obsidian:10,marmor:20,schuppe:4},{gold:24000,sternholz:3,obsidian:12},{gold:30000,sternholz:5,marmor:28,stern:6},{gold:37000,sternholz:8,obsidian:18},{gold:45000,sternholz:11,aether:3,marmor:36},{gold:55000,sternholz:15,aether:5,obsidian:24}],d:['Lager mit 12 Plätzen – für alle Helden','24 Plätze','36 Plätze','48 Plätze','60 Plätze','80 Plätze','100 Plätze','125 Plätze','150 Plätze','180 Plätze','210 Plätze','250 Plätze','300 Plätze','350 Plätze','400 Plätze']},
  training:{n:'Trainingsplatz',icon:'puppe',npc:'Hauptfrau Kael',body:'knightf',lv:[{gold:200,leder:4,holz:6},{gold:450,erz:8,holz:10,stein:4},{gold:900,zahn:6,holz:14,stein:8},{gold:1600,knochen:8,holz:18,stein:12},{gold:2600,mithril:5,eisenholz:4,stein:16},{gold:4000,kristall:8,eisenholz:8,marmor:4},{gold:6000,adamant:6,eisenholz:12,marmor:8},{gold:9000,horn:8,obsidian:6,marmor:12},{gold:13000,schuppe:4,obsidian:10,eisenholz:16},{gold:20000,stern:5,obsidian:14,marmor:18},{gold:27000,stern:7,sternholz:3,obsidian:16},{gold:35000,aether:2,sternholz:5,marmor:26},{gold:44000,aether:3,sternholz:7,obsidian:22},{gold:55000,aether:4,sternholz:10,marmor:34},{gold:70000,aether:6,sternholz:14,obsidian:30}],d:['+3 % Schaden und LP pro Stufe']},
  tempel:{n:'Glückstempel',icon:'rad',npc:'Orakel Fortuna',body:'angel',lv:[{gold:300,kristall:3,holz:8,stein:6},{gold:1500,kristall:6,glut:2,marmor:4},{gold:5000,stern:4,aether:1,marmor:10},{gold:8000,stern:5,marmor:14,feder:6},{gold:11000,kristall:16,obsidian:6,feder:10},{gold:15000,stern:7,marmor:20},{gold:20000,aether:2,obsidian:12,feder:16},{gold:26000,stern:10,sternholz:4},{gold:33000,aether:3,sternholz:7,marmor:30},{gold:42000,aether:5,sternholz:10,obsidian:20}],d:['Glücksrad, Schicksalstruhen und Münztausch','Glücksmünzen im Münztausch 25 % günstiger','Ein Gratis-Dreh pro Akt','Münztausch 28 % günstiger','Münztausch 31 % günstiger','Münztausch 34 % günstiger','Münztausch 37 % günstiger','Münztausch 40 % günstiger','Münztausch 43 % günstiger','Münztausch 46 % günstiger']},
  bibliothek:{n:'Bibliothek',icon:'buch',npc:'Archivar Ulmo',body:'wizard',lv:[{gold:180,leder:5,knochen:3,holz:8},{gold:800,knochen:8,kristall:2,holz:14,stein:6},{gold:2400,stern:2,kristall:5,holz:20,marmor:4},{gold:4500,kristall:8,eisenholz:6,marmor:6,feder:4},{gold:7000,stern:3,eisenholz:10,feder:8},{gold:10000,adamant:6,marmor:14},{gold:14000,stern:5,eisenholz:18,feder:12},{gold:19000,schuppe:5,obsidian:8,marmor:20},{gold:26000,aether:2,sternholz:5},{gold:35000,aether:4,sternholz:9,feder:20}],d:['Chronik und Bestiarium, +5 % Erfahrung','+10 % Erfahrung','+15 % Erfahrung, Chronikseiten häufiger','+20 % Erfahrung','+25 % Erfahrung','+30 % Erfahrung','+35 % Erfahrung','+40 % Erfahrung','+45 % Erfahrung','+50 % Erfahrung']},
  mine:{n:'Erzmine',icon:'mine',lv:[{gold:250,leder:4,erz:4,holz:10},{gold:700,zahn:4,holz:14,stein:6},{gold:1600,mithril:3,holz:18,stein:12},{gold:3200,adamant:3,eisenholz:4,stein:18},{gold:6000,stern:2,eisenholz:8,stein:24},{gold:9000,adamant:6,eisenholz:12,stein:30},{gold:13000,schuppe:3,marmor:12,eisenholz:16},{gold:18000,stern:5,marmor:18},{gold:25000,obsidian:12,eisenholz:24},{gold:34000,aether:3,sternholz:6,obsidian:16}],d:['Fördert pro geschafftem Raum Eisenerz und Stein','Mehr Erz, manchmal Mithril','Auch Adamant','Auch Glutsteine','Auch Sternenstaub','Auch Marmor','Mehr Stein, Mithril und Adamant','Auch Obsidian','Mehr Glutsteine und Sternenstaub','Auch Ätherkristalle']},
  garten:{n:'Kräutergarten',icon:'garten',lv:[{gold:200,schleim:3,holz:6,stein:2},{gold:600,schleim:6,leder:4,holz:10,stein:4},{gold:1400,knochen:6,holz:14,faser:6},{gold:3000,kristall:4,holz:18,stein:10,faser:10},{gold:5500,glut:4,eisenholz:4,faser:14},{gold:8500,kristall:8,eisenholz:8,marmor:6},{gold:12000,adamant:5,eisenholz:12,faser:24},{gold:17000,stern:4,marmor:14,obsidian:4},{gold:24000,stern:6,eisenholz:20,obsidian:8},{gold:33000,aether:3,sternholz:5,marmor:20}],d:['Wächst pro geschafftem Raum: Schleimkerne, Pflanzenfaser und Samen · Acker mit 2 Beeten (Flachs, Heilkraut)','Auch Leder und Federn · Acker: Schösslinge (Holz)','Auch Heiltränke · 3 Beete','Auch Seelenkristalle · Acker: Seelenmoos','Doppelte Ernte · 4 Beete','Acker: Eisenholz-Setzlinge','5 Beete, Ernte im Acker +25 %','Acker: Sternblumen (Sternholz)','6 Beete','Im Acker wächst alles doppelt so schnell']},
  sattler:{n:'Sattlerei',icon:'sattel',npc:'Sattler Fenrik',body:'elf',lv:[{gold:300,leder:8,faser:6,holz:6},{gold:900,leder:14,faser:10,holz:10},{gold:2000,leder:20,faser:14,knochen:8},{gold:3800,leder:26,faser:18,eisenholz:4},{gold:6000,horn:6,faser:24,eisenholz:8},{gold:9000,schuppe:3,faser:30,marmor:6},{gold:13000,adamant:6,faser:36,eisenholz:14},{gold:18000,schuppe:6,faser:44,obsidian:6},{gold:25000,stern:6,faser:52,sternholz:4},{gold:34000,aether:4,faser:60,sternholz:8}],d:['Größere Taschen: Beutel des Helden 36 Plätze, Rucksack in den Landen 22 Plätze','Beutel 42 Plätze, Rucksack 24, Begleiter-Tasche +1 Platz','Beutel 48 Plätze, Rucksack 26','Beutel 54 Plätze, Rucksack 28, Begleiter-Tasche +2 Plätze','Beutel 60 Plätze, Rucksack 30','Beutel 66 Plätze, Rucksack 32, Begleiter-Tasche +3 Plätze','Beutel 72 Plätze, Rucksack 34','Beutel 78 Plätze, Rucksack 36, Begleiter-Tasche +4 Plätze','Beutel 84 Plätze, Rucksack 38','Beutel 90 Plätze, Rucksack 40, Begleiter-Tasche +5 Plätze']},
  voliere:{n:'Vogelhaus',icon:'voliere',npc:'Vogelwart Corvin',body:'doc',lv:[{gold:400,holz:12,faser:8,feder:4},{gold:1500,holz:20,faser:14,feder:10,stein:10},{gold:5000,eisenholz:8,feder:18,marmor:6},{gold:14000,eisenholz:16,feder:28,obsidian:8},{gold:30000,sternholz:8,feder:40,aether:3}],d:['Spatzen aufziehen: Ein Spatz trägt 3 Plätze aus den Landen heim','Tauben (5 Plätze), Aufzucht schneller und günstiger','Raben (7 Plätze), Aufzucht schneller und günstiger','Eulen (9 Plätze), Aufzucht schneller und günstiger','Phönixfedern (10 Plätze), Aufzucht am schnellsten und günstigsten']},
  weltentor:{n:'Weltentor',icon:'tor',fixed:1,d0:'Tor zu den Verlorenen Landen: die beste Beute – aber wer dort stirbt, verliert alles, was er trägt.'},
  basar:{n:'Basar',icon:'basar',fixed:1,d0:'Kaufen, verkaufen und versteigern.'},
  brutnest:{n:'Brutnest',icon:'nest',fixed:1,d0:'Hier pflegst du Eier, bis sie schlüpfen.'}
};
const BUILDORDER = ['feuer','portal','spiegel','schmiede','alchemie','juwelier','lager','sattler','voliere','training','tempel','bibliothek','mine','garten','weltentor','basar','brutnest'];
/* Bauzeit (Sekunden) je Ziel-Stufe: Sekunden am Anfang, Stunden spät (js/bauen.js) */
const BTIME = [0,10,30,90,300,900,1800,3600,7200,14400,21600,28800,36000,43200,57600,72000];
/* Acker im Kräutergarten: lv = ab Garten-Stufe, t = Wachszeit (s), seed = Saatgut, out = Ernte [von, bis], pot = Heiltrank */
const CROPS = {
  flachs:{n:'Flachs',lv:1,t:600,seed:{samen:1},out:{faser:[3,5],samen:[1,2]}},
  heilkraut:{n:'Heilkraut',lv:1,t:1200,seed:{samen:1},out:{schleim:[2,3]},pot:1},
  setzling:{n:'Schössling',lv:2,t:1800,seed:{samen:2},out:{holz:[6,9],samen:[0,1]}},
  moos:{n:'Seelenmoos',lv:4,t:7200,seed:{samen:2,schleim:1},out:{kristall:[2,3]}},
  eisenbaum:{n:'Eisenholz-Setzling',lv:6,t:10800,seed:{samen:2,eisenholz:1},out:{eisenholz:[3,5],samen:[1,1]}},
  sternblume:{n:'Sternblume',lv:8,t:21600,seed:{samen:3,stern:1},out:{sternholz:[1,2],stern:[1,1],samen:[1,1]}}
};
const CROPORDER = ['flachs','heilkraut','setzling','moos','eisenbaum','sternblume'];
const ELIXIRS = [
  {id:'kraft',n:'Elixier der Kraft',bn:'Kraft',d:'+30 % Schaden für 3 Räume',cost:{schleim:4,horn:1},gold:150,buff:{dmg:.3},rooms:3},
  {id:'stein',n:'Elixier des Steins',bn:'Stein',d:'+15 Verteidigung, +10 % LP für 3 Räume',cost:{schleim:4,erz:6},gold:150,buff:{def:15,hp:.1},rooms:3},
  {id:'glueck',n:'Elixier des Glücks',bn:'Glück',d:'+80 % Gold, mehr Beute für 3 Räume',cost:{schleim:4,kristall:2},gold:200,buff:{gold:.8,loot:.4},rooms:3},
  {id:'wind',n:'Elixier des Windes',bn:'Wind',d:'+20 % Angriffs- und Lauftempo für 3 Räume',cost:{schleim:5,glut:1},gold:200,buff:{aspd:.2,spd:.2},rooms:3}
];

/* ---------- Glückstempel ---------- */
const WHEEL = [
  {k:'gold',n:'Goldregen',w:24,c:'#e8b04a'},
  {k:'mats',n:'Materialbündel',w:18,c:'#9aa2ae'},
  {k:'pots',n:'3 Heiltränke',w:10,c:'#79c24e'},
  {k:'gem',n:'Edelstein',w:12,c:'#57a7d6'},
  {k:'rare',n:'Seltener Gegenstand',w:12,c:'#e8d04a'},
  {k:'epic',n:'Epischer Gegenstand',w:8,c:'#b892f4'},
  {k:'coins',n:'2 Glücksmünzen',w:5,c:'#ffd24a'},
  {k:'leg',n:'Legendärer Gegenstand',w:3,c:'#ff8a3a'},
  {k:'set',n:'Set-Teil',w:3,c:'#4ade80'},
  {k:'cos',n:'Kosmetik',w:1.4,c:'#f786a0'},
  {k:'myth',n:'MYTHISCH',w:.4,c:'#ff4fd8'}
];
const CHESTS = [
  {id:'bronze',n:'Bronzetruhe',d:'Ein magischer bis epischer Gegenstand. 2 % Legendär.',gold:1,minRar:1},
  {id:'gold',n:'Schicksalstruhe',d:'Garantiert Episch. 10 % Legendär, 1 % Mythisch, 5 % Kosmetik.',coins:3,minRar:3},
  {id:'drache',n:'Drachentruhe',d:'Garantiert Legendär. 6 % Mythisch, 15 % Kosmetik.',coins:10,minRar:4}
];

/* ---------- Erfolge ---------- */
const ACH = [
  {id:'kill1',n:'Erstes Blut',d:'Besiege einen Gegner',t:s=>s.kills>=1,r:20},
  {id:'kill100',n:'Schlächter',d:'Besiege 100 Gegner',t:s=>s.kills>=100,r:100},
  {id:'kill1000',n:'Legende des Gemetzels',d:'Besiege 1.000 Gegner',t:s=>s.kills>=1000,r:500},
  {id:'kill10000',n:'Zehntausend Klingen',d:'Besiege 10.000 Gegner',t:s=>s.kills>=10000,r:3000},
  {id:'lv10',n:'Abenteurer',d:'Erreiche Level 10',t:s=>s.maxLv>=10,r:100},
  {id:'lv25',n:'Veteran',d:'Erreiche Level 25',t:s=>s.maxLv>=25,r:400},
  {id:'lv50',n:'Held von Klingenhort',d:'Erreiche Level 50',t:s=>s.maxLv>=50,r:1500},
  {id:'lv75',n:'Meister des Aufstiegs',d:'Erreiche Level 75',t:s=>s.maxLv>=75,r:4000},
  {id:'lv100',n:'Legende der Hundert',d:'Erreiche Level 100',t:s=>s.maxLv>=100,r:12000},
  {id:'par10',n:'Über den Grenzen',d:'Erreiche Paragon 10',t:s=>s.maxPar>=10,r:1000},
  {id:'boss1',n:'Ogertöter',d:'Besiege Grausch',t:s=>s.boss_ogre>=1,r:150},
  {id:'boss2',n:'Geisterbanner',d:'Besiege Vexhal',t:s=>s.boss_shaman>=1,r:250},
  {id:'boss3',n:'Grabwächter',d:'Besiege Morgul',t:s=>s.boss_zombie>=1,r:400},
  {id:'boss4',n:'Höllenbezwinger',d:'Besiege Ignaroth',t:s=>s.boss_demon>=1,r:700},
  {id:'boss5',n:'Tauwetter',d:'Besiege Eiskönigin Frostra',t:s=>s.boss_frostra>=1,r:900},
  {id:'boss6',n:'Heilmittel',d:'Besiege Seuchenfürst Morbus',t:s=>s.boss_morbus>=1,r:1100},
  {id:'boss7',n:'Verrat gesühnt',d:'Besiege Todesritter Varkas',t:s=>s.boss_varkas>=1,r:1400},
  {id:'boss8',n:'Drachentöter',d:'Besiege den Uralten Drachen Pyraxis',t:s=>s.boss_pyraxis>=1,r:2500},
  {id:'act5',n:'Über die Gipfel',d:'Erreiche Akt 5 (Frostgipfel)',t:s=>s.maxAct>=5,r:800},
  {id:'act9',n:'In die Qual',d:'Erreiche Akt 9 (Qual 1)',t:s=>s.maxAct>=9,r:2000},
  {id:'act12',n:'Unaufhaltsam',d:'Erreiche Akt 12',t:s=>s.maxAct>=12,r:4000},
  {id:'leg',n:'Legendär!',d:'Finde einen legendären Gegenstand',t:s=>s.legs>=1,r:200},
  {id:'myth',n:'Mythos',d:'Besitze einen mythischen Gegenstand',t:s=>s.myths>=1,r:2000},
  {id:'set',n:'Komplettiert',d:'Trage ein vollständiges Set',t:s=>s.fullset>=1,r:600},
  {id:'up10',n:'Meisterschmied',d:'Werte einen Gegenstand auf +10 auf',t:s=>s.maxUp>=10,r:800},
  {id:'fuse1',n:'Verschmolzen',d:'Verschmelze zwei Gegenstände',t:s=>s.fusions>=1,r:100},
  {id:'fuse25',n:'Alchemie der Klingen',d:'Verschmelze 25 Mal',t:s=>s.fusions>=25,r:800},
  {id:'gem5',n:'Königlich',d:'Stelle einen königlichen Edelstein her',t:s=>s.royal>=1,r:500},
  {id:'mimic',n:'Reingelegt',d:'Besiege einen Mimik',t:s=>s.k_mimic>=1,r:80},
  {id:'goldgob',n:'Goldrausch',d:'Erwische einen Schatzgoblin',t:s=>s.k_goldgob>=1,r:150},
  {id:'champ',n:'Champion-Jäger',d:'Besiege 10 Champions',t:s=>s.champs>=10,r:600},
  {id:'combo50',n:'Kombo-König',d:'Erreiche 50 Treffer in Folge',t:s=>s.maxCombo>=50,r:250},
  {id:'gold10k',n:'Goldene Hände',d:'Sammle insgesamt 10.000 Gold',t:s=>s.goldTotal>=10000,r:300},
  {id:'hide10',n:'Baumeister',d:'Baue dein Versteck auf insgesamt Stufe 10 aus',t:s=>s.hideLv>=10,r:500},
  {id:'hide30',n:'Festung Klingenhort',d:'Baue dein Versteck auf insgesamt Stufe 30 aus',t:s=>s.hideLv>=30,r:2500},
  {id:'spin50',n:'Glückspilz',d:'Drehe 50 Mal am Glücksrad',t:s=>s.spins>=50,r:500},
  {id:'lore10',n:'Chronist',d:'Finde 10 Chronikseiten',t:s=>s.lore>=10,r:400},
  {id:'best35',n:'Monsterkundler',d:'Entdecke 35 Gegnerarten',t:s=>s.bestiary>=35,r:700},
  {id:'riddle5',n:'Rätselmeister',d:'Löse 5 Rätsel der Sphinx',t:s=>s.riddles>=5,r:400},
  {id:'cos1',n:'Schick!',d:'Besitze ein Kosmetik-Teil',t:s=>s.cosm>=1,r:300},
  {id:'daily',n:'Tagwerk',d:'Schließe eine Tages-Herausforderung ab',t:s=>s.dailies>=1,r:200},
  {id:'reborn',n:'Wiedergeboren',d:'Wähle die Wiedergeburt',t:s=>s.rebirths>=1,r:1000},
  {id:'hc20',n:'Ohne Netz',d:'Erreiche Level 20 im Hardcore-Modus',t:s=>s.hcLv>=20,r:1000},
  {id:'allcls',n:'Vielseitig',d:'Bringe alle vier Klassen auf Level 10',t:s=>s.clsLv10>=4,r:800}
];

function pct(v){return _t('{n} %',{n:Math.round(v*100)})}
