/* ============================================================
   Tutta la grafica del sito e' disegnata a runtime su canvas 2D
   e passata a three.js come CanvasTexture: niente immagini da
   scaricare, il sito funziona anche offline.
   Le copertine sono illustrazioni originali ispirate al tema dei
   giochi, non riproduzioni delle scatole vere.
   ============================================================ */
const ART = (function(){
'use strict';

function cnv(w, h){
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return [c, c.getContext('2d')];
}

// CanvasTexture con le impostazioni che servono sempre:
// spazio colore sRGB (senza, i colori escono slavati con il tone mapping)
// e anisotropia alta, perche' le superfici si guardano di sbieco.
function toTex(c, opt){
  opt = opt || {};
  const t = new THREE.CanvasTexture(c);
  if (THREE.SRGBColorSpace) t.colorSpace = THREE.SRGBColorSpace;
  else t.encoding = THREE.sRGBEncoding;          // three < r152
  t.anisotropy = opt.aniso || 8;
  if (opt.repeat){
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(opt.repeat[0], opt.repeat[1]);
  }
  if (opt.rot){ t.center.set(.5,.5); t.rotation = opt.rot; }
  return t;
}

const rnd = (a,b) => a + Math.random()*(b-a);

// Testo con crenatura allargata: il canvas non ha letter-spacing
// prima di Chrome 99, quindi le lettere vanno piazzate a mano.
function spaced(x, str, cx, y, sp, align){
  const ch = String(str).split('');
  let tot = -sp;
  for (let i=0;i<ch.length;i++) tot += x.measureText(ch[i]).width + sp;
  let px = align === 'center' ? cx - tot/2 : (align === 'right' ? cx - tot : cx);
  for (let i=0;i<ch.length;i++){
    x.fillText(ch[i], px, y);
    px += x.measureText(ch[i]).width + sp;
  }
  return tot;
}

// Grana della carta: rumore fine, tiene insieme il disegno vettoriale
// e gli toglie quell'aria di clip art.
function grain(x, w, h, amount){
  const img = x.getImageData(0,0,w,h), d = img.data;
  for (let i=0;i<d.length;i+=4){
    const n = (Math.random()-.5) * amount;
    d[i] += n; d[i+1] += n; d[i+2] += n;
  }
  x.putImageData(img, 0, 0);
}

function vignette(x, w, h, strength){
  const g = x.createRadialGradient(w/2,h/2,h*.28, w/2,h/2,h*.78);
  g.addColorStop(0,'rgba(0,0,0,0)');
  g.addColorStop(1,'rgba(0,0,0,'+strength+')');
  x.fillStyle = g; x.fillRect(0,0,w,h);
}

/* ---------------------------------------------------------------
   LEGNO
   Venature orizzontali ondulate + qualche nodo. La stessa texture
   viene usata anche come bumpMap: la luminanza delle venature basta
   a dare il rilievo, senza generare una normal map.
   --------------------------------------------------------------- */
function wood(o){
  o = o || {};
  const w = o.w || 512, h = o.h || 512;
  const base = o.base || '#5a3620', dark = o.dark || '#2c1a10', light = o.light || '#8a5730';
  const [c,x] = cnv(w,h);

  x.fillStyle = base; x.fillRect(0,0,w,h);

  const lines = o.lines || 160;
  for (let i=0;i<lines;i++){
    const y = Math.random()*h;
    const amp = rnd(1,7), per = rnd(70,240), ph = Math.random()*6.283;
    x.strokeStyle = Math.random() < .55 ? dark : light;
    x.globalAlpha = rnd(.03,.16);
    x.lineWidth = rnd(.6,3.2);
    x.beginPath(); x.moveTo(0, y);
    for (let px=6; px<=w; px+=6){
      x.lineTo(px, y + Math.sin(px/per*6.283 + ph)*amp + Math.sin(px*.11+ph)*.7);
    }
    x.stroke();
  }

  // nodi: anelli concentrici schiacciati
  const knots = o.knots === undefined ? 3 : o.knots;
  for (let k=0;k<knots;k++){
    const kx = rnd(w*.1, w*.9), ky = rnd(h*.1, h*.9), kr = rnd(9,22);
    for (let r=kr; r>1; r-=2.1){
      x.strokeStyle = r/kr > .5 ? dark : light;
      x.globalAlpha = rnd(.08,.26);
      x.lineWidth = rnd(.8,2.2);
      x.beginPath(); x.ellipse(kx, ky, r*1.9, r, 0, 0, 6.283); x.stroke();
    }
  }

  x.globalAlpha = 1;
  grain(x, w, h, 14);
  return c;
}

/* ---------------------------------------------------------------
   COPERTINE
   --------------------------------------------------------------- */

// Chioma tondeggiante, per gli alberi di latifoglia
function blob(x, cx, cy, r, col){
  x.fillStyle = col;
  x.beginPath();
  for (let a=0; a<6.283; a+=.35){
    const rr = r * (.78 + Math.sin(a*3.1 + cx)*.14 + Math.random()*.08);
    const px = cx + Math.cos(a)*rr, py = cy + Math.sin(a)*rr*.86;
    a === 0 ? x.moveTo(px,py) : x.lineTo(px,py);
  }
  x.closePath(); x.fill();
}

function fir(x, cx, cy, w, h, col){
  x.fillStyle = col;
  for (let i=0;i<3;i++){
    const t = i/3, ww = w*(1-t*.45), hh = h*.5;
    x.beginPath();
    x.moveTo(cx, cy - h + t*h*.62);
    x.lineTo(cx - ww/2, cy - h + t*h*.62 + hh);
    x.lineTo(cx + ww/2, cy - h + t*h*.62 + hh);
    x.closePath(); x.fill();
  }
}

// ROOT: bosco d'autunno, radici che si allargano sul fondo
function coverRoot(){
  const S = 512, [c,x] = cnv(S,S);

  const sky = x.createLinearGradient(0,0,0,S*.72);
  sky.addColorStop(0,'#f7e8c2'); sky.addColorStop(.55,'#f0c983'); sky.addColorStop(1,'#e0a065');
  x.fillStyle = sky; x.fillRect(0,0,S,S);

  // sole basso
  const glow = x.createRadialGradient(352,152,10, 352,152,150);
  glow.addColorStop(0,'rgba(255,244,205,.95)'); glow.addColorStop(1,'rgba(255,244,205,0)');
  x.fillStyle = glow; x.fillRect(0,0,S,S);
  x.fillStyle = '#fbe6ac'; x.beginPath(); x.arc(352,152,54,0,6.283); x.fill();

  // colline lontane
  x.fillStyle = '#cf9a63';
  x.beginPath(); x.moveTo(0,300); x.quadraticCurveTo(120,236,266,296);
  x.quadraticCurveTo(390,344,512,286); x.lineTo(512,512); x.lineTo(0,512); x.fill();

  // il bosco, dal fondo verso l'osservatore
  const bands = [
    { y:308, col:'#9c6c3f', r:16, n:16 },
    { y:336, col:'#c1552c', r:24, n:12 },
    { y:366, col:'#8d3f24', r:30, n:10 },
    { y:398, col:'#46402a', r:36, n:9  }
  ];
  for (let b=0;b<bands.length;b++){
    const bd = bands[b];
    for (let i=0;i<bd.n;i++){
      const cx = (i + (b%2?.5:0)) * (S/bd.n) + rnd(-10,10);
      if (b === 0) fir(x, cx, bd.y+10, bd.r*1.1, bd.r*2.2, bd.col);
      else {
        x.fillStyle = b === 3 ? '#2e2a1c' : '#6b3c22';
        x.fillRect(cx-3, bd.y-6, 6, bd.r*.9);          // tronco
        blob(x, cx, bd.y-bd.r*.55, bd.r, bd.col);
      }
    }
  }

  // terra e radici
  x.fillStyle = '#20190f';
  x.beginPath(); x.moveTo(0,430); x.quadraticCurveTo(180,404,512,436);
  x.lineTo(512,512); x.lineTo(0,512); x.fill();
  x.strokeStyle = '#20190f'; x.lineCap = 'round';
  for (let i=0;i<11;i++){
    const x0 = 40 + i*44, spread = rnd(30,90);
    x.lineWidth = rnd(4,11);
    x.beginPath(); x.moveTo(x0, 512);
    x.quadraticCurveTo(x0 + spread*.4, 470, x0 + spread, 418 - Math.random()*22);
    x.stroke();
  }
  x.strokeStyle = 'rgba(196,120,58,.35)'; x.lineWidth = 1.6;
  for (let i=0;i<7;i++){
    const x0 = 70 + i*66;
    x.beginPath(); x.moveTo(x0,512); x.quadraticCurveTo(x0+22,466,x0+52,424); x.stroke();
  }

  // foglie sospese
  x.fillStyle = 'rgba(198,86,44,.75)';
  for (let i=0;i<14;i++){
    const lx = Math.random()*S, ly = rnd(70,300), r = rnd(3,7);
    x.save(); x.translate(lx,ly); x.rotate(Math.random()*3);
    x.beginPath(); x.ellipse(0,0,r,r*.5,0,0,6.283); x.fill(); x.restore();
  }

  // titolo
  x.fillStyle = '#f3e3bd';
  x.font = "112px 'Bebas Neue', Impact, sans-serif";
  x.textBaseline = 'alphabetic'; x.textAlign = 'left';
  x.shadowColor = 'rgba(0,0,0,.5)'; x.shadowBlur = 14; x.shadowOffsetY = 3;
  spaced(x, 'ROOT', S/2, 486, 12, 'center');
  x.shadowBlur = 0; x.shadowOffsetY = 0;

  x.fillStyle = 'rgba(243,227,189,.72)';
  x.font = "20px 'Inter', sans-serif";
  spaced(x, 'UNA GUERRA NEL BOSCO', S/2, 507, 3.6, 'center');

  x.fillStyle = 'rgba(43,32,20,.7)';
  x.font = "17px 'Inter', sans-serif";
  spaced(x, 'LEDER GAMES', 24, 40, 3, 'left');

  vignette(x, S, S, .34);
  grain(x, S, S, 12);
  x.strokeStyle = 'rgba(255,240,205,.22)'; x.lineWidth = 2;
  x.strokeRect(8,8,S-16,S-16);
  return c;
}

// SCYTHE: campi di grano, fattoria e un mech all'orizzonte
function coverScythe(){
  const S = 512, [c,x] = cnv(S,S);

  const sky = x.createLinearGradient(0,0,0,320);
  sky.addColorStop(0,'#e8bd74'); sky.addColorStop(.6,'#d99055'); sky.addColorStop(1,'#a86747');
  x.fillStyle = sky; x.fillRect(0,0,S,320);

  const glow = x.createRadialGradient(146,150,8, 146,150,170);
  glow.addColorStop(0,'rgba(255,240,206,.9)'); glow.addColorStop(1,'rgba(255,240,206,0)');
  x.fillStyle = glow; x.fillRect(0,0,S,330);
  x.fillStyle = '#f7e5b6'; x.beginPath(); x.arc(146,150,62,0,6.283); x.fill();

  // nuvole basse e lunghe
  x.fillStyle = 'rgba(247,225,182,.5)';
  const cl = [[90,96,120,11],[300,74,150,9],[400,140,110,8],[190,178,170,10]];
  for (let i=0;i<cl.length;i++){
    x.beginPath(); x.ellipse(cl[i][0],cl[i][1],cl[i][2],cl[i][3],0,0,6.283); x.fill();
  }

  // campi: bande sempre piu' alte scendendo, danno la profondita'
  const fieldCols = ['#b98d4f','#9d7440','#c39a56','#856134','#a8813f','#6d5029'];
  let y = 300, step = 8;
  for (let i=0; y < S; i++){
    x.fillStyle = fieldCols[i % fieldCols.length];
    x.fillRect(0, y, S, step + 2);
    y += step; step *= 1.34;
  }

  // solchi obliqui: convergono verso il sole
  x.strokeStyle = 'rgba(64,44,22,.22)'; x.lineWidth = 2;
  for (let i=-4;i<12;i++){
    x.beginPath(); x.moveTo(146 + i*8, 302); x.lineTo(146 + i*116, 512); x.stroke();
  }

  const dark = '#1f1913';

  // fattoria e mulino a sinistra
  x.fillStyle = dark;
  x.fillRect(40,268,54,34);                                  // stalla
  x.beginPath(); x.moveTo(36,268); x.lineTo(67,246); x.lineTo(98,268); x.closePath(); x.fill();
  x.fillRect(108,278,26,24);
  x.beginPath(); x.moveTo(104,278); x.lineTo(121,262); x.lineTo(138,278); x.closePath(); x.fill();
  x.fillRect(176,246,10,56);                                 // mulino
  x.save(); x.translate(181,250); x.rotate(.5);
  for (let i=0;i<4;i++){ x.fillRect(-2,-2,46,5); x.rotate(1.5708); }
  x.restore();

  // il mech: scafo squadrato, cabina, ciminiera e quattro zampe snodate
  x.save(); x.translate(374, 232);
  x.strokeStyle = dark; x.lineCap = 'round'; x.lineJoin = 'round';

  // zampe: coscia in avanti, stinco all'indietro, come un ragno
  const legs = [[-46,72,-30],[-20,78,-12],[18,78,12],[44,72,30]];
  for (let i=0;i<legs.length;i++){
    const kx = legs[i][0], fy = legs[i][1], hip = legs[i][2];
    x.lineWidth = i === 1 || i === 2 ? 7 : 9;
    x.beginPath();
    x.moveTo(hip, 14);
    x.lineTo(kx*1.25, 40);      // ginocchio, in fuori
    x.lineTo(kx, fy);           // piede
    x.stroke();
    x.fillStyle = dark;
    x.fillRect(kx-9, fy-4, 18, 7);   // piede piatto
  }

  x.fillStyle = dark;
  x.beginPath();                                  // scafo
  x.moveTo(-56,4); x.lineTo(-44,-20); x.lineTo(40,-20);
  x.lineTo(56,2);  x.lineTo(46,20);  x.lineTo(-46,20);
  x.closePath(); x.fill();
  x.beginPath();                                  // cabina
  x.moveTo(-26,-20); x.lineTo(-18,-42); x.lineTo(10,-42); x.lineTo(16,-20);
  x.closePath(); x.fill();
  x.fillRect(-46,-46,11,26);                      // ciminiera
  x.beginPath(); x.ellipse(-40.5,-48,9,5,0,0,6.283); x.fill();
  x.fillRect(40,-10,42,8);                        // braccio
  x.fillRect(78,-16,7,20);
  x.restore();

  // sbuffo di fumo sopra la ciminiera
  x.fillStyle = 'rgba(40,32,24,.35)';
  for (let i=0;i<4;i++){
    x.beginPath(); x.arc(332 - i*9, 176 - i*17, 7 + i*4, 0, 6.283); x.fill();
  }

  // grano in primo piano
  x.strokeStyle = '#241d13'; x.lineWidth = 2.2; x.lineCap = 'round';
  for (let i=0;i<150;i++){
    const gx = Math.random()*S, gy = rnd(432,512), hgt = rnd(16,40);
    x.beginPath(); x.moveTo(gx,gy); x.quadraticCurveTo(gx+rnd(-7,7), gy-hgt*.6, gx+rnd(-12,12), gy-hgt);
    x.stroke();
  }
  x.fillStyle = 'rgba(24,19,13,.92)';
  x.beginPath(); x.moveTo(0,470); x.quadraticCurveTo(256,452,512,474);
  x.lineTo(512,512); x.lineTo(0,512); x.fill();

  // titolo
  x.fillStyle = '#f2e3be';
  x.font = "104px 'Bebas Neue', Impact, sans-serif";
  x.textBaseline = 'alphabetic'; x.textAlign = 'left';
  x.shadowColor = 'rgba(0,0,0,.55)'; x.shadowBlur = 16; x.shadowOffsetY = 3;
  spaced(x, 'SCYTHE', S/2, 462, 14, 'center');
  x.shadowBlur = 0; x.shadowOffsetY = 0;

  x.strokeStyle = 'rgba(242,227,190,.45)'; x.lineWidth = 1.4;
  x.beginPath(); x.moveTo(148,476); x.lineTo(364,476); x.stroke();

  x.fillStyle = 'rgba(242,227,190,.72)';
  x.font = "18px 'Inter', sans-serif";
  spaced(x, 'EUROPA, 1920', S/2, 500, 4, 'center');

  x.fillStyle = 'rgba(40,28,18,.75)';
  x.font = "17px 'Inter', sans-serif";
  spaced(x, 'STONEMAIER GAMES', 24, 40, 3, 'left');

  vignette(x, S, S, .36);
  grain(x, S, S, 12);
  x.strokeStyle = 'rgba(255,238,200,.2)'; x.lineWidth = 2;
  x.strokeRect(8,8,S-16,S-16);
  return c;
}

// Copertina astratta per le scatole di contorno, quelle non cliccabili
function coverGeneric(seed){
  const S = 256, [c,x] = cnv(S,S);
  const hues = [[ '#4f5f42','#d8c795' ], [ '#7a4436','#eccb96' ], [ '#3a4a5e','#cfdbe2' ],
                [ '#5d3f61','#e2c6d8' ], [ '#75602c','#f2e0b0' ]];
  const p = hues[seed % hues.length];

  x.fillStyle = p[0]; x.fillRect(0,0,S,S);

  // fascia diagonale piu' chiara
  x.save(); x.translate(S/2,S/2); x.rotate(-.32);
  x.globalAlpha = .16; x.fillStyle = p[1];
  x.fillRect(-S, -46, S*2, 40); x.fillRect(-S, 16, S*2, 14);
  x.restore(); x.globalAlpha = 1;

  // emblema geometrico al centro
  x.save(); x.translate(S/2, 104);
  x.strokeStyle = p[1]; x.lineWidth = 5;
  x.beginPath();
  for (let i=0;i<6;i++){
    const a = i/6*6.283 - 1.57, r = 46;
    i ? x.lineTo(Math.cos(a)*r, Math.sin(a)*r) : x.moveTo(Math.cos(a)*r, Math.sin(a)*r);
  }
  x.closePath(); x.stroke();
  x.fillStyle = p[1]; x.globalAlpha = .5;
  x.beginPath(); x.moveTo(0,-22); x.lineTo(20,14); x.lineTo(-20,14); x.closePath(); x.fill();
  x.restore(); x.globalAlpha = 1;

  // blocco del titolo, senza testo: sono scatole di sfondo
  x.fillStyle = p[1];
  x.fillRect(40, 186, S-80, 12);
  x.globalAlpha = .6; x.fillRect(40, 206, (S-80)*.62, 6);
  x.globalAlpha = .35; x.fillRect(40, 218, (S-80)*.38, 6);
  x.globalAlpha = 1;

  x.strokeStyle = 'rgba(255,255,255,.18)'; x.lineWidth = 3;
  x.strokeRect(10,10,S-20,S-20);
  vignette(x, S, S, .4); grain(x, S, S, 10);
  return c;
}

/* ---------------------------------------------------------------
   FIANCHI, DORSO E INTERNO DELLA SCATOLA
   --------------------------------------------------------------- */

// Il dorso: si vede quando la scatola e' inclinata
function spine(game, vertical){
  const w = vertical ? 128 : 512, h = vertical ? 512 : 128;
  const [c,x] = cnv(w,h);
  x.fillStyle = game.wrap; x.fillRect(0,0,w,h);

  // sfumatura per non avere un colore piatto
  const g = x.createLinearGradient(0,0,w,h);
  g.addColorStop(0,'rgba(255,255,255,.10)'); g.addColorStop(1,'rgba(0,0,0,.22)');
  x.fillStyle = g; x.fillRect(0,0,w,h);

  x.save();
  x.translate(w/2, h/2);
  if (vertical) x.rotate(-Math.PI/2);
  x.fillStyle = game.ink;
  x.font = "62px 'Bebas Neue', Impact, sans-serif";
  x.textBaseline = 'middle'; x.textAlign = 'left';
  spaced(x, game.title.toUpperCase(), 0, 2, 8, 'center');
  x.restore();

  // filetti sui bordi lunghi
  x.fillStyle = 'rgba(0,0,0,.28)';
  if (vertical){ x.fillRect(0,0,4,h); x.fillRect(w-4,0,4,h); }
  else { x.fillRect(0,0,w,4); x.fillRect(0,h-4,w,4); }
  grain(x, w, h, 10);
  return c;
}

// Cartone grezzo: fondo scatola e retro
function cardboard(tone){
  const S = 128, [c,x] = cnv(S,S);
  x.fillStyle = tone || '#b39468'; x.fillRect(0,0,S,S);
  x.strokeStyle = 'rgba(90,64,38,.25)';
  for (let i=0;i<70;i++){
    x.lineWidth = rnd(.5,1.6); x.globalAlpha = rnd(.1,.5);
    const y = Math.random()*S;
    x.beginPath(); x.moveTo(0,y); x.lineTo(S,y); x.stroke();
  }
  x.globalAlpha = 1; grain(x, S, S, 16);
  return c;
}

// L'interno che si vede quando il coperchio si alza:
// regolamento, mazzo di carte, segnalini, due meeple.
function inside(){
  const S = 512, [c,x] = cnv(S,S);
  x.fillStyle = '#3a2f22'; x.fillRect(0,0,S,S);
  x.fillStyle = 'rgba(0,0,0,.35)'; x.fillRect(0,0,S,26); x.fillRect(0,0,26,S);

  // regolamento
  x.save(); x.translate(120,150); x.rotate(-.06);
  x.fillStyle = '#e8dcc0'; x.fillRect(-84,-110,168,220);
  x.fillStyle = 'rgba(60,44,26,.8)'; x.fillRect(-60,-84,120,7);
  x.fillStyle = 'rgba(60,44,26,.45)';
  for (let i=0;i<8;i++) x.fillRect(-60,-56+i*17, 120 - (i%3)*28, 4);
  x.restore();

  // mazzo di carte
  x.save(); x.translate(350,140); x.rotate(.1);
  for (let i=4;i>=0;i--){
    x.fillStyle = i === 0 ? '#8f4a2c' : '#6e3a22';
    x.fillRect(-66+i*2, -96+i*2, 132, 190);
  }
  x.fillStyle = 'rgba(240,220,180,.85)'; x.fillRect(-40,-40,80,80);
  x.restore();

  // segnalini di cartone
  const tok = ['#c1552c','#4f6b48','#b98d4f','#4b5b70','#8a5730'];
  for (let i=0;i<14;i++){
    x.fillStyle = tok[i % tok.length];
    x.beginPath(); x.arc(rnd(70,440), rnd(300,470), rnd(12,22), 0, 6.283); x.fill();
    x.strokeStyle = 'rgba(0,0,0,.3)'; x.lineWidth = 2; x.stroke();
  }

  // due meeple
  const meeple = function(mx,my,s,col){
    x.fillStyle = col; x.save(); x.translate(mx,my); x.scale(s,s);
    x.beginPath(); x.arc(0,-20,11,0,6.283); x.fill();
    x.beginPath();
    x.moveTo(-9,-8); x.lineTo(9,-8); x.lineTo(20,4); x.lineTo(20,12); x.lineTo(7,10);
    x.lineTo(11,28); x.lineTo(-11,28); x.lineTo(-7,10); x.lineTo(-20,12); x.lineTo(-20,4);
    x.closePath(); x.fill(); x.restore();
  };
  meeple(150, 400, 1.5, '#d8552c');
  meeple(240, 430, 1.2, '#e8c05f');

  vignette(x, S, S, .5);
  grain(x, S, S, 14);
  return c;
}

/* ---------------------------------------------------------------
   DADI DA SCAFFALE
   --------------------------------------------------------------- */
const PIPS = [
  [], [[0,0]],
  [[-1,-1],[1,1]],
  [[-1,-1],[0,0],[1,1]],
  [[-1,-1],[1,-1],[-1,1],[1,1]],
  [[-1,-1],[1,-1],[0,0],[-1,1],[1,1]],
  [[-1,-1],[1,-1],[-1,0],[1,0],[-1,1],[1,1]]
];

function dieFace(n, body, pip){
  const S = 128, [c,x] = cnv(S,S);
  x.fillStyle = body || '#efe3cb'; x.fillRect(0,0,S,S);
  const g = x.createLinearGradient(0,0,S,S);
  g.addColorStop(0,'rgba(255,255,255,.35)'); g.addColorStop(1,'rgba(0,0,0,.18)');
  x.fillStyle = g; x.fillRect(0,0,S,S);
  x.fillStyle = pip || '#2a1a0f';
  const p = PIPS[n], step = 30;
  for (let i=0;i<p.length;i++){
    x.beginPath(); x.arc(64 + p[i][0]*step, 64 + p[i][1]*step, 12, 0, 6.283); x.fill();
  }
  grain(x, S, S, 8);
  return c;
}

// L'ordine che vuole BoxGeometry: +X, -X, +Y, -Y, +Z, -Z.
// Le facce opposte sommano a sette, come su un dado vero.
function dieMaterials(body, pip){
  const order = [3,4,1,6,2,5];
  return order.map(function(n){
    return new THREE.MeshStandardMaterial({
      map: toTex(dieFace(n, body, pip)), roughness: .42, metalness: .02
    });
  });
}

return {
  cnv: cnv, toTex: toTex, wood: wood, spaced: spaced, grain: grain,
  coverRoot: coverRoot, coverScythe: coverScythe, coverGeneric: coverGeneric,
  spine: spine, cardboard: cardboard, inside: inside,
  dieFace: dieFace, dieMaterials: dieMaterials
};
})();
