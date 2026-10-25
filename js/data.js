'use strict';
/* =========================================================
   KLINGENHORT – Spieldaten
   Alles, was das Spiel ausmacht, steht hier als Daten.
   Neue Klassen, Gegner, Talente, Rezepte: hier ergänzen.
   ========================================================= */

const VERSION = '3.0.1';
const SAVE_KEY = 'klingenhort.v3';
const WALL = 32;

/* ---------- Effekt-Atlas (assets/fx.png) ---------- */
const FX = {"fireball":[0,0,16,16,6],"firebomb":[0,17,16,16,6],"arcane":[0,34,16,16,6],"magicorb":[0,51,16,16,6],"darkorb":[0,68,16,16,6],"darkbolt":[0,85,16,16,6],"waterbolt":[0,102,16,16,6],"plant":[0,119,16,16,6],"lightbolt":[0,136,16,16,6],"windbolt":[0,153,16,16,6],"sparks":[0,170,16,16,6],"waterorb":[0,187,16,16,6],"purebolt":[0,204,16,16,6],"icelance":[0,221,16,16,4],"splash":[0,238,32,32,6],"shield":[0,271,48,48,6],"slash":[0,320,64,47,9],"boom":[0,368,44,44,13],"bolt":[0,413,48,48,12],"ring":[0,462,48,48,14]};

/* ---------- Sprite-Atlas (assets/sheet.png, 0x72 DungeonTileset II) ---------- */
const SP = {
  knight:{idle:[128,100],run:[192,100],hit:[256,100],w:16,h:28},
  wizard:{idle:[128,164],run:[192,164],hit:[256,164],w:16,h:28},
  elf:{idle:[128,36],run:[192,36],hit:[256,36],w:16,h:28},
  doc:{idle:[368,345],run:[432,345],w:16,h:23},
  dwarf:{idle:[128,292],run:[192,292],w:16,h:28},
  wizf:{idle:[128,132],run:[192,132],w:16,h:28},
  elff:{idle:[128,4],run:[192,4],w:16,h:28},
  angel:{idle:[368,304],run:[432,304],w:16,h:16},
  pumpkin:{idle:[368,321],run:[432,321],w:16,h:23},
  goblin:{idle:[368,40],run:[432,40],w:16,h:16},
  skelet:{idle:[368,88],run:[432,88],w:16,h:16},
  lizard:{idle:[128,228],run:[192,228],hit:[256,228],w:16,h:28},
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
  ogre:{idle:[16,380],run:[144,380],w:32,h:36},
  bigz:{idle:[16,332],run:[144,332],w:32,h:36},
  demon:{idle:[16,428],run:[144,428],w:32,h:36},
  mimic:{idle:[304,432],run:[304,432],w:16,h:16,n:3}
};
const WSRC = {knife:[293,10,6,13],rusty_sword:[307,10,10,21],regular_sword:[323,10,10,21],knight_sword:[339,98,10,29],lavish_sword:[307,129,10,30],anime_sword:[322,65,12,30],golden_sword:[291,137,10,22],red_gem_sword:[339,10,10,21],axe:[341,74,9,21],waraxe:[324,168,12,23],double_axe:[288,167,16,24],big_hammer:[291,26,10,37],mace:[339,39,10,24],baton:[323,41,10,22],spear:[309,161,6,30],red_staff:[324,129,8,30],green_staff:[340,129,8,30],bow:[289,195,14,26],bow2:[305,195,14,26],arrow:[324,202,7,21],katana:[293,66,6,29],machete:[294,105,5,22],cleaver:[310,108,9,19]};
const TINT = [null,'#e8eef8','#8ee6ea','#c39cf8','#ff8a4a'];

/* ---------- Waffen ---------- */
const TMUL = [1,1.75,2.9,4.4,6.4];
const WT = {
  dagger:{label:'Dolche',names:['Eisendolche','Stahldolche','Mithrildolche','Runendolche','Drachenzähne'],spr:[['knife'],['knife',TINT[1]],['machete',TINT[2]],['katana',TINT[3]],['katana',TINT[4]]],dmg:6,cd:.24,range:18,arc:1.4,kb:55,crit:.15},
  sword:{label:'Schwert',names:['Rostklinge','Langschwert','Ritterschwert','Runenschwert','Drachenklinge'],spr:[['rusty_sword'],['regular_sword'],['knight_sword'],['lavish_sword'],['anime_sword']],dmg:10,cd:.38,range:25,arc:2.0,kb:110,crit:.06},
  axe:{label:'Axt',names:['Holzfälleraxt','Kriegsaxt','Doppelaxt','Runenaxt','Drachenspalter'],spr:[['axe'],['waraxe'],['double_axe'],['double_axe',TINT[3]],['double_axe',TINT[4]]],dmg:16,cd:.6,range:26,arc:2.8,kb:190,crit:.06},
  bow:{label:'Bogen',names:['Kurzbogen','Jagdbogen','Langbogen','Elfenbogen','Drachenbogen'],spr:[['bow'],['bow2'],['bow2',null,'#3fa7b0'],['bow2',null,'#8a5ad8'],['bow2',null,'#e8542a']],dmg:8,cd:.44,range:0,arc:0,kb:50,crit:.08,ranged:true,proj:'arrow'},
  staff:{label:'Stab',names:['Eichenstab','Glutstab','Froststab','Runenstab','Drachenstab'],spr:[['green_staff'],['red_staff'],['red_staff',null,'#57c7e6'],['red_staff',null,'#a070f0'],['red_staff',null,'#ff7a2a']],dmg:9,cd:.48,range:0,arc:0,kb:40,crit:.06,ranged:true,proj:['arcane','purebolt','waterbolt','magicorb','lightbolt']}
};
const REQ = [1,5,10,16,22];            // Level für Waffen-/Rüstungsstufen
const PRICE = [40,180,460,960,1900];
const AR = {
  armor:{label:'Rüstung',def:[3,7,12,18,26],hp:[0,12,26,42,64]},
  helm:{label:'Helm',def:[1,3,6,9,13],hp:[0,6,12,20,30]}
};

/* ---------- Klassen ---------- */
const CLASSES = {
  knight:{
    name:'Ritter',sp:'knight',desc:'Schwer gepanzert, hält viel aus. Schwert oder Axt, Schildwall und Wirbelklinge.',
    hp:85,hpLv:14,def:6,spd:76,weapons:['sword','axe'],start:'sword',
    res:{name:'Ausdauer',max:100,regen:13,col:'#e8b04a',onHit:3},
    skills:['k1','k2','k3'],ult:'ku',
    pal:{main:'114,214,206',shade:'65,112,137',plume:['218,78,56','238,142,46']},
    names:[['Lederwams','Lederkappe'],['Kettenhemd','Eisenhelm'],['Schuppenpanzer','Federhelm'],['Plattenrüstung','Runenhelm'],['Drachenpanzer','Drachenhelm']],
    tiers:[['#a8743e','#5e3a1e'],['#8e96a3','#4a505c'],['#72d6ce','#417089'],['#e6eaf0','#7a8296'],['#d84a32','#7a1e18']]
  },
  mage:{
    name:'Magier',sp:'wizard',desc:'Zerbrechlich, aber verheerend. Feuerbälle, Frostnova und Kettenblitze aus der Distanz.',
    hp:55,hpLv:9,def:2,spd:74,weapons:['staff'],start:'staff',
    res:{name:'Mana',max:120,regen:11,col:'#57a7d6'},
    skills:['m1','m2','m3'],ult:'mu',
    pal:{main:'86,152,204',shade:'89,86,189'},
    names:[['Novizenrobe','Filzhut'],['Gelehrtenrobe','Spitzhut'],['Sternenrobe','Sternenhut'],['Erzmagierrobe','Runenkrone'],['Drachenrobe','Drachenkrone']],
    tiers:[['#a8743e','#6a4224'],['#5698cc','#5956bd'],['#8a5ad8','#4a2a8a'],['#f0e6c8','#c8a04a'],['#c8342c','#3a1418']]
  },
  rogue:{
    name:'Assassine',sp:'doc',desc:'Schnell und tödlich. Doppelte Dolche, Gift, Rauchbomben und Schattenklone.',
    hp:62,hpLv:11,def:3,spd:90,weapons:['dagger'],start:'dagger',
    res:{name:'Energie',max:100,regen:20,col:'#79c24e'},
    skills:['r1','r2','r3'],ult:'ru',
    pal:{main:'49,65,82',shade:'65,112,137'},
    names:[['Lederumhang','Kapuze'],['Schattenmantel','Maske'],['Nachtmantel','Rabenmaske'],['Phantommantel','Geistermaske'],['Blutmantel','Blutmaske']],
    tiers:[['#5a5048','#8a7a6a'],['#2e4a3a','#4a7a5a'],['#314152','#417089'],['#2a1e3a','#6a48c0'],['#5a1418','#c8342c']]
  },
  ranger:{
    name:'Bogenschütze',sp:'elf',desc:'Präzise aus der Ferne. Fächerschuss, Sprengfallen und ein Waldgeist als Begleiter.',
    hp:60,hpLv:10,def:3,spd:84,weapons:['bow'],start:'bow',
    res:{name:'Fokus',max:100,regen:12,col:'#8ee6ea'},
    skills:['a1','a2','a3'],ult:'au',
    pal:{main:'75,167,71',shade:'61,115,79'},
    names:[['Jagdwams','Lederstirnband'],['Waldläuferwams','Federkappe'],['Elfenwams','Elfenreif'],['Silberwams','Silberreif'],['Goldwams','Sonnenreif']],
    tiers:[['#a8743e','#6a4224'],['#4ba747','#3d734f'],['#2e7a4a','#1e4a2e'],['#cfd6e0','#7a8296'],['#e8b04a','#9c6a24']]
  }
};
const DYES = [
  {id:'natur',n:'Natur',c:null,cost:{}},
  {id:'purpur',n:'Purpur',c:['#9a4ad8','#4a1a7a'],cost:{kristall:2}},
  {id:'smaragd',n:'Smaragd',c:['#3ac87a','#1a6a3a'],cost:{schleim:4}},
  {id:'gold',n:'Gold',c:['#f0c040','#a0701a'],cost:{erz:6,glut:1}},
  {id:'schatten',n:'Schatten',c:['#3a3448','#16121e'],cost:{knochen:6}},
  {id:'blut',n:'Blut',c:['#c82a2a','#5a0e12'],cost:{horn:2}},
  {id:'eis',n:'Eis',c:['#bfefff','#5aa8d8'],cost:{kristall:1,schleim:2}}
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

/* ---------- Talentbäume ---------- */
const TALENTS = {
  knight:[
    ['Waffenmeister',[
      {id:'kw1',n:'Scharfe Klinge',max:3,e:{dmg:.06},d:'+6 % Schaden'},
      {id:'kw2',n:'Präzision',max:3,e:{crit:.03},d:'+3 % Krit-Chance'},
      {id:'kw3',n:'Vernichtender Finisher',max:3,e:{fin:.25},d:'+25 % Kombo-Finisher-Schaden'},
      {id:'kw4',n:'Klingensturm',max:1,e:{k2Dur:.6,k2Dmg:.4},d:'Wirbelklinge +0,6 s und +40 % Schaden'}]],
    ['Bollwerk',[
      {id:'kb1',n:'Eiserne Haut',max:3,e:{def:3},d:'+3 Verteidigung'},
      {id:'kb2',n:'Lebenskraft',max:3,e:{hp:.08},d:'+8 % Lebenspunkte'},
      {id:'kb3',n:'Regeneration',max:3,e:{regen:.6},d:'+0,6 LP pro Sekunde'},
      {id:'kb4',n:'Spiegelschild',max:1,e:{k3Reflect:1,k3Dur:1.5},d:'Schildwall wirft Geschosse zurück, +1,5 s'}]],
    ['Kriegsherr',[
      {id:'kk1',n:'Kampfeswut',max:3,e:{rage:.15},d:'+15 % Wut-Aufbau'},
      {id:'kk2',n:'Taktiker',max:3,e:{cdr:.06},d:'−6 % Abklingzeiten'},
      {id:'kk3',n:'Ansturm',max:3,e:{k1Stun:.4,k1Dmg:.25},d:'Sturmangriff +0,4 s Betäubung, +25 % Schaden'},
      {id:'kk4',n:'Weltenbeben',max:1,e:{uRad:.4,uDmg:.5},d:'Erdbeben +40 % Radius, +50 % Schaden'}]]
  ],
  mage:[
    ['Feuer',[
      {id:'mf1',n:'Glut',max:3,e:{m1Dmg:.15},d:'Feuerball +15 % Schaden'},
      {id:'mf2',n:'Flammenmeer',max:3,e:{m1Rad:.15},d:'Feuerball +15 % Radius'},
      {id:'mf3',n:'Entzünden',max:3,e:{burn:.1},d:'+10 % Chance, Gegner in Brand zu setzen'},
      {id:'mf4',n:'Feuersturm',max:1,e:{m1Split:1},d:'Feuerball teilt sich in drei'}]],
    ['Frost',[
      {id:'mi1',n:'Eiskälte',max:3,e:{m2Dmg:.2},d:'Frostnova +20 % Schaden'},
      {id:'mi2',n:'Permafrost',max:3,e:{m2Freeze:.4},d:'Frostnova friert 0,4 s länger ein'},
      {id:'mi3',n:'Eisrüstung',max:3,e:{def:3},d:'+3 Verteidigung'},
      {id:'mi4',n:'Frostkern',max:1,e:{chill:1},d:'Wer dich trifft, wird verlangsamt'}]],
    ['Arkan',[
      {id:'ma1',n:'Arkanes Wissen',max:3,e:{dmg:.06},d:'+6 % Schaden'},
      {id:'ma2',n:'Manafluss',max:3,e:{resreg:.2},d:'+20 % Mana-Regeneration'},
      {id:'ma3',n:'Kettenreaktion',max:3,e:{m3Chain:1},d:'Kettenblitz springt 1 Mal mehr'},
      {id:'ma4',n:'Meteoritenschwarm',max:1,e:{uCount:6},d:'Meteorhagel +6 Meteore'}]]
  ],
  rogue:[
    ['Klingen',[
      {id:'rk1',n:'Tödliche Präzision',max:3,e:{crit:.04},d:'+4 % Krit-Chance'},
      {id:'rk2',n:'Halsabschneider',max:3,e:{critdmg:.2},d:'+20 % Krit-Schaden'},
      {id:'rk3',n:'Klingentanz',max:3,e:{aspd:.08},d:'+8 % Angriffstempo'},
      {id:'rk4',n:'Endlose Schatten',max:1,e:{r1Reset:1},d:'Schattenschritt lädt sich bei Kills neu'}]],
    ['Gift',[
      {id:'rg1',n:'Toxine',max:3,e:{poison:.25},d:'+25 % Giftschaden'},
      {id:'rg2',n:'Wurfmesser',max:3,e:{r2Knives:2},d:'Giftklingen +2 Wurfmesser'},
      {id:'rg3',n:'Lähmendes Gift',max:3,e:{poisonSlow:.15},d:'Vergiftete Gegner −15 % Tempo'},
      {id:'rg4',n:'Seuche',max:1,e:{plague:1},d:'Gift springt beim Tod auf Nachbarn über'}]],
    ['Schatten',[
      {id:'rs1',n:'Flink',max:3,e:{spd:.06},d:'+6 % Lauftempo'},
      {id:'rs2',n:'Ausweichen',max:3,e:{dodge:.05},d:'+5 % Chance, Treffern auszuweichen'},
      {id:'rs3',n:'Hinterhalt',max:3,e:{stealth:.3},d:'Rauchbombe +30 % Schaden und +0,5 s'},
      {id:'rs4',n:'Legion',max:1,e:{uCount:2},d:'Schattenklone +2'}]]
  ],
  ranger:[
    ['Schütze',[
      {id:'aa1',n:'Adlerauge',max:3,e:{crit:.03},d:'+3 % Krit-Chance'},
      {id:'aa2',n:'Schnellschuss',max:3,e:{aspd:.08},d:'+8 % Angriffstempo'},
      {id:'aa3',n:'Breiter Fächer',max:3,e:{a1Count:2},d:'Fächerschuss +2 Pfeile'},
      {id:'aa4',n:'Pfeilhagel',max:1,e:{uDmg:.5,uDur:2},d:'Pfeilsturm +50 % Schaden, 2 Salven mehr'}]],
    ['Fallensteller',[
      {id:'af1',n:'Sprengmeister',max:3,e:{a2Dmg:.25},d:'Sprengfalle +25 % Schaden'},
      {id:'af2',n:'Vorrat',max:3,e:{a2Max:1},d:'+1 gleichzeitige Falle'},
      {id:'af3',n:'Splitter',max:3,e:{a2Rad:.2},d:'Sprengfalle +20 % Radius'},
      {id:'af4',n:'Kettenexplosion',max:1,e:{a2Cluster:1},d:'Fallen streuen kleine Bomben'}]],
    ['Wildnis',[
      {id:'aw1',n:'Waldläufer',max:3,e:{spd:.05},d:'+5 % Lauftempo'},
      {id:'aw2',n:'Naturverbunden',max:3,e:{hp:.07},d:'+7 % Lebenspunkte'},
      {id:'aw3',n:'Geistband',max:3,e:{a3Dur:3,a3Dmg:.2},d:'Waldgeist +3 s, +20 % Schaden'},
      {id:'aw4',n:'Zwillingsgeister',max:1,e:{a3Count:1},d:'Ein zweiter Waldgeist erscheint'}]]
  ]
};

/* ---------- Seltenheit, Affixe, Sets ---------- */
const RAR = [
  {n:'Gewöhnlich',c:'#c8c8c8',m:1,aff:0,sock:[0,0]},
  {n:'Magisch',c:'#57a7d6',m:1.15,aff:1,sock:[0,1]},
  {n:'Selten',c:'#e8d04a',m:1.3,aff:2,sock:[1,1]},
  {n:'Episch',c:'#b892f4',m:1.5,aff:2,sock:[1,2]},
  {n:'Legendär',c:'#ff8a3a',m:1.8,aff:3,sock:[2,3]},
  {n:'Set',c:'#4ade80',m:1.6,aff:2,sock:[1,1]}
];
const AFFW = {
  krit:{suf:'der Präzision',f:r=>.04+r*.015,s:v=>'Krit +'+pct(v)},
  tempo:{suf:'des Windes',f:r=>.06+r*.02,s:v=>'Tempo +'+pct(v)},
  raub:{suf:'des Blutes',f:r=>.02+r*.008,s:v=>'Lebensraub '+pct(v)},
  feuer:{suf:'der Glut',f:r=>.15+r*.05,s:v=>'Brand '+pct(v)},
  frost:{suf:'des Frostes',f:r=>.06+r*.02,s:v=>'Frost '+pct(v)},
  wucht:{suf:'der Wucht',f:r=>.08+r*.04,s:v=>'Schaden +'+pct(v)}
};
const AFFA = {
  leben:{suf:'des Lebens',f:r=>.05+r*.03,s:v=>'LP +'+pct(v)},
  panzer:{suf:'des Panzers',f:r=>2+r*1.5,s:v=>'VER +'+Math.round(v)},
  heil:{suf:'der Heilung',f:r=>.3+r*.2,s:v=>'Regeneration +'+v.toFixed(1)},
  schutz:{suf:'des Schutzes',f:r=>.03+r*.015,s:v=>'Schadensminderung '+pct(v)},
  eile:{suf:'der Eile',f:r=>.03+r*.015,s:v=>'Lauftempo +'+pct(v)},
  glueck:{suf:'des Glücks',f:r=>.08+r*.05,s:v=>'Gold +'+pct(v)}
};
const LEGEND = {dagger:['Nachtzahn','Viperbiss'],sword:['Sonnenklinge','Morgenrot'],axe:['Weltspalter','Donnerkeil'],bow:['Sternenfall','Himmelsbogen'],staff:['Sternenfeuer','Eiswind'],armor:['Ewige Wacht','Phönixherz'],helm:['Krone der Ahnen','Drachenblick']};
const SETS = {
  lion:{n:'Erbe des Löwen',cls:'knight',base:'sword',pieces:{weapon:'Löwenklinge',armor:'Löwenpanzer',helm:'Löwenhelm'},b2:{dr:.12},b3:{k2Cdr:.5,dmg:.25},d2:'12 % weniger Schaden',d3:'Wirbelklinge halbe Abklingzeit, +25 % Schaden'},
  glut:{n:'Glutweber',cls:'mage',base:'staff',pieces:{weapon:'Glutweberstab',armor:'Glutweberrobe',helm:'Glutweberhut'},b2:{m1Dmg:.3},b3:{m1Split:1,m1Rad:.3},d2:'Feuerball +30 % Schaden',d3:'Feuerball teilt sich, +30 % Radius'},
  nacht:{n:'Nachtschatten',cls:'rogue',base:'dagger',pieces:{weapon:'Nachtschattenklingen',armor:'Nachtschattenmantel',helm:'Nachtschattenmaske'},b2:{crit:.1},b3:{r1Reset:1,critdmg:.4},d2:'+10 % Krit-Chance',d3:'Schattenschritt lädt bei Kills, +40 % Krit-Schaden'},
  wald:{n:'Waldläufer',cls:'ranger',base:'bow',pieces:{weapon:'Waldläuferbogen',armor:'Waldläuferwams',helm:'Waldläuferreif'},b2:{aspd:.15},b3:{a1Count:4,pierce:1},d2:'+15 % Angriffstempo',d3:'Alle Pfeile durchschlagen, Fächer +4'},
  drache:{n:'Drachenfürst',cls:null,base:null,pieces:{weapon:'Drachenfürsten-Waffe',armor:'Drachenfürsten-Panzer',helm:'Drachenfürsten-Krone'},b2:{dmg:.1,hp:.1},b3:{fireAura:1,dr:.08},d2:'+10 % Schaden und LP',d3:'Feuer-Aura verbrennt Gegner in der Nähe, 8 % weniger Schaden'}
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
  schuppe:{n:'Drachenschuppe',c:'#e8d04a',c2:'#9c6a24'}
};
const MATORDER = ['erz','leder','knochen','schleim','zahn','kristall','horn','glut','schuppe'];
const GEMS = {
  rubin:{n:'Rubin',c:'#e8402a',eff:'dmg',v:[.03,.05,.08,.12,.18],s:v=>'Schaden +'+pct(v)},
  saphir:{n:'Saphir',c:'#57a7d6',eff:'def',v:[2,4,7,11,16],s:v=>'VER +'+v},
  smaragd:{n:'Smaragd',c:'#3ac87a',eff:'crit',v:[.01,.02,.035,.05,.07],s:v=>'Krit +'+pct(v)},
  amethyst:{n:'Amethyst',c:'#b892f4',eff:'hp',v:[.03,.05,.08,.12,.17],s:v=>'LP +'+pct(v)},
  topas:{n:'Topas',c:'#e8d04a',eff:'gold',v:[.05,.1,.16,.24,.35],s:v=>'Gold +'+pct(v)}
};
const GEMORDER = ['rubin','saphir','smaragd','amethyst','topas'];
const GEMGRADE = ['Splitter','Kleiner','Feiner','Makelloser','Königlicher'];
const UPCHANCE = [1,1,1,1,1,.85,.7,.55,.45,.35];
const RECIPES = [
  {id:'potion',n:'Heiltrank ×2',d:'Zwei Heiltränke brauen',cost:{schleim:1},gold:15},
  {id:'forge_weapon',n:'Waffe schmieden',d:'Zufällige magische Waffe deiner Klasse',cost:{erz:6,zahn:2},gold:60},
  {id:'forge_armor',n:'Rüstung schmieden',d:'Zufällige magische Rüstung',cost:{leder:6,erz:3},gold:60},
  {id:'forge_helm',n:'Helm schmieden',d:'Zufälliger magischer Helm',cost:{leder:4,knochen:3},gold:50},
  {id:'reroll',n:'Umschmieden',d:'Zusatzwerte eines Gegenstands neu würfeln',cost:{kristall:2},gold:80,needItem:true},
  {id:'socket',n:'Sockel bohren',d:'Einen Sockel hinzufügen (max. 3)',cost:{horn:1,erz:4},gold:100,needItem:true},
  {id:'gem',n:'Edelstein zufällig',d:'Einen zufälligen Edelstein-Splitter herstellen',cost:{kristall:1,erz:2},gold:30}
];

/* ---------- Gegner ---------- */
const EN = {
  goblin:{name:'Goblin',sp:'goblin',hp:24,atk:6,spd:56,r:5,xp:6,gold:3,ai:'melee',reach:13,wind:.36,cd:.95,wpn:'knife',hand:[3,-4],cost:1,from:1,blood:'#4a8a2a',drop:{leder:.3},desc:'Feige in Gruppen, gefährlich im Rudel.'},
  skeleton:{name:'Skelettkrieger',sp:'skelet',hp:36,atk:9,spd:44,r:5,xp:9,gold:4,ai:'melee',reach:17,wind:.44,cd:1.05,wpn:'rusty_sword',hand:[3,-4],cost:1.5,from:2,blood:'#e8e2cf',drop:{knochen:.4},desc:'Rasselt heran und schlägt mit rostigen Klingen zu.'},
  lizard:{name:'Echsenmensch',sp:'lizard',hp:34,atk:8,spd:64,r:5,xp:9,gold:4,ai:'lunge',wpn:'spear',hand:[3,-8],cost:1.5,from:3,blood:'#4a8a2a',drop:{leder:.4},desc:'Springt mit dem Speer aus der Distanz an.'},
  bomber:{name:'Wogol-Sprengmeister',sp:'wogol',hp:28,atk:15,spd:42,r:5,xp:11,gold:6,ai:'bomber',cost:2,from:3,blood:'#b8302a',drop:{erz:.35},desc:'Wirft Bomben – trifft dabei auch seine Freunde.'},
  slime:{name:'Sumpfschleim',sp:'swampy',hp:42,atk:8,spd:32,r:6,xp:8,gold:3,ai:'melee',reach:8,wind:.4,cd:1.1,cost:1.5,from:4,blood:'#5aa83a',split:true,drop:{schleim:.55},desc:'Teilt sich beim Tod in zwei Schleimlinge.'},
  minislime:{name:'Schleimling',sp:'muddy',hp:14,atk:4,spd:48,r:4,xp:3,gold:1,ai:'melee',reach:8,wind:.3,cd:.9,cost:99,from:99,blood:'#8a6a3a',drop:{schleim:.2},desc:'Klein, schnell, klebrig.'},
  mage:{name:'Nekromant',sp:'necro',hp:28,atk:11,spd:34,r:5,xp:12,gold:6,ai:'caster',wpn:'red_staff',hand:[3,-6],cost:2,from:4,blood:'#8a4ad8',summon:'tinyz',orb:'darkorb',drop:{kristall:.25},desc:'Schleudert Schattenkugeln und erweckt Zombies.'},
  orc:{name:'Orkkrieger',sp:'orc',hp:64,atk:13,spd:46,r:6,xp:15,gold:8,ai:'melee',reach:17,wind:.42,cd:.95,wpn:'baton',hand:[3,-6],cost:2.5,from:5,blood:'#b8302a',drop:{zahn:.4},desc:'Muskeln, Keule, keine Gnade.'},
  ogre:{name:'Oger',sp:'ogre',hp:140,atk:20,spd:28,r:10,xp:26,gold:14,ai:'slam',wpn:'big_hammer',hand:[6,-12],cost:4,from:6,mass:3,blood:'#b8302a',drop:{zahn:.6,erz:.4},desc:'Sein Hammer erzeugt Schockwellen.'},
  berserker:{name:'Ork-Berserker',sp:'masked',hp:95,atk:16,spd:42,r:6,xp:22,gold:12,ai:'charge',wpn:'waraxe',hand:[3,-6],cost:3.5,from:7,mass:2.4,blood:'#b8302a',drop:{zahn:.5},desc:'Stürmt blind los – und kracht gern gegen Säulen.'},
  imp:{name:'Imp',sp:'imp',hp:52,atk:12,spd:62,r:5,xp:16,gold:9,ai:'swoop',cost:3,from:8,mass:1.4,blood:'#ff8a3a',drop:{horn:.3},desc:'Kreist in der Luft und stürzt herab.'},
  chort:{name:'Hornteufel',sp:'chort',hp:74,atk:14,spd:72,r:6,xp:18,gold:10,ai:'lunge',cost:3,from:9,mass:1.6,blood:'#b8302a',drop:{horn:.45},desc:'Der schnellste Teufel der Glutfeste.'},
  zombie:{name:'Moderriese',sp:'bigz',hp:180,atk:22,spd:25,r:10,xp:32,gold:16,ai:'slam',cost:4.5,from:11,mass:3.4,blood:'#6a8a3a',drop:{knochen:.7},desc:'Langsam, zäh und erschreckend stark.'},
  icez:{name:'Frostgeist',sp:'icez',hp:40,atk:10,spd:40,r:5,xp:12,gold:6,ai:'caster',cost:2,from:12,blood:'#8ee6ea',orb:'waterorb',drop:{kristall:.3},desc:'Seine Eiskugeln verlangsamen.'},
  tinyz:{name:'Kriechzombie',sp:'tinyz',hp:16,atk:5,spd:46,r:4,xp:3,gold:1,ai:'melee',reach:9,wind:.35,cd:1,cost:99,from:99,blood:'#6a8a3a',drop:{knochen:.2},desc:'Vom Nekromanten erweckt.'},
  mimic:{name:'Mimik',sp:'mimic',hp:90,atk:15,spd:62,r:6,xp:25,gold:40,ai:'lunge',cost:99,from:99,blood:'#b8302a',drop:{kristall:1},desc:'Sieht aus wie eine Truhe. Ist keine.'},
  shaman:{name:'Orkschamane',sp:'shaman',hp:32,atk:12,spd:34,r:5,xp:12,gold:7,ai:'caster',wpn:'green_staff',hand:[3,-6],cost:99,from:99,blood:'#4a8a2a',summon:'orc',orb:'plant',drop:{kristall:.4},desc:'Ruft Orks und schleudert Dornengeschosse.'},
  goldgob:{name:'Schatzgoblin',sp:'goblin',hp:60,atk:0,spd:70,r:5,xp:40,gold:120,ai:'flee',cost:99,from:99,blood:'#e8d04a',drop:{},desc:'Rennt mit seinem Gold davon. Schnapp ihn dir!'},
  demon:{name:'Höllenschlund',sp:'demon',hp:540,atk:24,spd:30,r:13,xp:60,gold:40,ai:'dragon',boss:true,mass:8,blood:'#ff8a3a',drop:{horn:4,schuppe:2},desc:'Herrscher der Glutfeste.'}
};
const BOSSES = [
  {type:'ogre',name:'Ogerhäuptling Grausch',sc:1.6,hpMul:4.5,tint:'rgba(255,60,40,.3)'},
  {type:'shaman',name:'Schamane Vexhal',sc:1.9,hpMul:13},
  {type:'zombie',name:'Moderkönig Morgul',sc:1.7,hpMul:3.6,tint:'rgba(120,255,140,.22)'},
  {type:'demon',name:'Höllenschlund Ignaroth',sc:2,hpMul:1.15}
];
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
  {key:'kerker',name:'Kerker',tint:[1,1,1],dark:.4,root:45,dust:'#8a7a6a',vein:'erz'},
  {key:'moss',name:'Moosgrotte',tint:[.78,1.04,.74],dark:.45,root:43,dust:'#7a9a62',vein:'erz'},
  {key:'gruft',name:'Knochengruft',tint:[.8,.84,1.02],dark:.52,root:41,dust:'#8a8496',vein:'kristall'},
  {key:'glut',name:'Glutfeste',tint:[1.18,.8,.62],dark:.34,root:40,dust:'#8a5a4a',vein:'glut'}
];
const DIFFS = {
  normal:{n:'Normal',hp:1,dmg:1,loot:1,elite:.1,affix:[1,1],heal:.25,d:'Fordernd, aber fair.'},
  nightmare:{n:'Albtraum',hp:1.7,dmg:1.55,loot:1.6,elite:.16,affix:[1,2],heal:.2,d:'Härtere Gegner, bessere Beute.'},
  hell:{n:'Hölle',hp:2.6,dmg:2.2,loot:2.4,elite:.26,affix:[2,3],heal:.12,d:'Nur für Wahnsinnige. Die beste Beute.'}
};
const NODE = {
  kampf:{n:'Kampf',icon:['w','rusty_sword'],c:'#c8c8c8',d:'Mehrere Wellen von Gegnern.'},
  elite:{n:'Elite',icon:['s',288,432,16,16],c:'#e8b04a',d:'Starke Gegner mit Affixen. Garantierte Beute.'},
  ueberleben:{n:'Überleben',icon:['fx','ring',10],c:'#ff8a3a',d:'Halte 45 Sekunden durch.'},
  schatz:{n:'Schatzkammer',icon:['s',304,416,16,16],c:'#e8d04a',d:'Truhen, Erzadern – und vielleicht ein Mimik.'},
  goblin:{n:'Schatzgoblin',icon:['sp','goblin'],c:'#e8d04a',d:'Fang den Goblin, bevor er mit seinem Gold flieht.'},
  dunkel:{n:'Dunkelkammer',icon:['fx','darkorb',0],c:'#8a7aa8',d:'Nur dein eigenes Licht. Mehr Beute.'},
  haendler:{n:'Händler',icon:['sp','dwarf'],c:'#79c24e',d:'Ausrüstung, Tränke und Edelsteine kaufen.'},
  schrein:{n:'Schrein',icon:['fx','sparks',2],c:'#b892f4',d:'Wähle einen Segen – oder einen lohnenden Fluch.'},
  werkbank:{n:'Werkbank',icon:['s',288,408,16,24],c:'#57a7d6',d:'Aufwerten, schmieden, sockeln. Heilt 50 %.'},
  event:{n:'Ereignis',icon:['s',288,352,16,16],c:'#efe2bf',d:'Etwas Unerwartetes wartet.'},
  boss:{n:'Boss',icon:['s',16,428,32,36],c:'#c8463c',d:'Der Herrscher dieses Gebiets.'}
};
const SHRINES = [
  {id:'wut',n:'Schrein der Wut',d:'+35 % Schaden für 3 Räume',buff:{dmg:.35},rooms:3},
  {id:'stein',n:'Schrein des Steins',d:'+12 Verteidigung für 3 Räume',buff:{def:12},rooms:3},
  {id:'gier',n:'Schrein der Gier',d:'+60 % Gold für 3 Räume',buff:{gold:.6},rooms:3},
  {id:'eile',n:'Schrein der Eile',d:'+20 % Tempo, −20 % Abklingzeiten für 3 Räume',buff:{spd:.2,cdr:.2},rooms:3},
  {id:'fluch',n:'Verfluchter Altar',d:'Gegner +50 % LP, aber doppelte Beute für 3 Räume',buff:{curse:1,loot:1},rooms:3},
  {id:'blut',n:'Blutaltar',d:'Sofort 30 % LP verlieren, +1 Talentpunkt',instant:'blood'}
];
const EVENTS = [
  {id:'brunnen',n:'Mysteriöser Brunnen',d:'Ein Brunnen voller schimmerndem Wasser.',opts:[{n:'Trinken (voll heilen)',a:'heal'},{n:'Münze werfen (50 Gold: Glücksspiel)',a:'gamble'}]},
  {id:'gefangener',n:'Gefangener Händler',d:'Ein Zwerg sitzt in einem Käfig. Er verspricht eine Belohnung.',opts:[{n:'Befreien (Kampf gegen Wachen)',a:'rescue'},{n:'Weitergehen',a:'leave'}]},
  {id:'truhe',n:'Verfluchte Truhe',d:'Eine Truhe, umgeben von dunklem Nebel.',opts:[{n:'Öffnen (Elite-Kampf, epische Beute)',a:'cursed'},{n:'Liegen lassen',a:'leave'}]},
  {id:'schmied',n:'Wandernder Schmied',d:'Ein Schmied bietet eine kostenlose Aufwertung an.',opts:[{n:'Waffe aufwerten (+1)',a:'upw'},{n:'Rüstung aufwerten (+1)',a:'upa'}]},
  {id:'alchemist',n:'Alchemistin',d:'Eine Hexe mischt Tränke.',opts:[{n:'2 Heiltränke nehmen',a:'potions'},{n:'Materialien tauschen (zufällig ×3)',a:'mats'}]}
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
  {id:'par10',n:'Über den Grenzen',d:'Erreiche Paragon 10',t:s=>s.maxPar>=10,r:1000},
  {id:'boss1',n:'Ogertöter',d:'Besiege Grausch',t:s=>s.boss_ogre>=1,r:150},
  {id:'boss2',n:'Geisterbanner',d:'Besiege Vexhal',t:s=>s.boss_shaman>=1,r:250},
  {id:'boss3',n:'Grabwächter',d:'Besiege Morgul',t:s=>s.boss_zombie>=1,r:400},
  {id:'boss4',n:'Höllenbezwinger',d:'Besiege Ignaroth',t:s=>s.boss_demon>=1,r:700},
  {id:'act5',n:'In die Qual',d:'Erreiche Akt 5 (Qual 1)',t:s=>s.maxAct>=5,r:800},
  {id:'act10',n:'Unaufhaltsam',d:'Erreiche Akt 10',t:s=>s.maxAct>=10,r:3000},
  {id:'leg',n:'Legendär!',d:'Finde einen legendären Gegenstand',t:s=>s.legs>=1,r:200},
  {id:'set',n:'Komplettiert',d:'Trage ein vollständiges Set',t:s=>s.fullset>=1,r:600},
  {id:'up10',n:'Meisterschmied',d:'Werte einen Gegenstand auf +10 auf',t:s=>s.maxUp>=10,r:800},
  {id:'gem5',n:'Königlich',d:'Stelle einen königlichen Edelstein her',t:s=>s.royal>=1,r:500},
  {id:'mimic',n:'Reingelegt',d:'Besiege einen Mimik',t:s=>s.k_mimic>=1,r:80},
  {id:'goldgob',n:'Goldrausch',d:'Erwische einen Schatzgoblin',t:s=>s.k_goldgob>=1,r:150},
  {id:'combo50',n:'Kombo-König',d:'Erreiche 50 Treffer in Folge',t:s=>s.maxCombo>=50,r:250},
  {id:'gold10k',n:'Goldene Hände',d:'Sammle insgesamt 10.000 Gold',t:s=>s.goldTotal>=10000,r:300},
  {id:'daily',n:'Tagwerk',d:'Schließe eine Tages-Herausforderung ab',t:s=>s.dailies>=1,r:200},
  {id:'reborn',n:'Wiedergeboren',d:'Wähle die Wiedergeburt',t:s=>s.rebirths>=1,r:1000},
  {id:'hc20',n:'Ohne Netz',d:'Erreiche Level 20 im Hardcore-Modus',t:s=>s.hcLv>=20,r:1000},
  {id:'allcls',n:'Vielseitig',d:'Bringe alle vier Klassen auf Level 10',t:s=>s.clsLv10>=4,r:800}
];

function pct(v){return Math.round(v*100)+' %'}
