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

// Texture da un'immagine gia' caricata (le copertine vere in img/).
function imgTex(im){
  const t = new THREE.Texture(im);
  if (THREE.SRGBColorSpace) t.colorSpace = THREE.SRGBColorSpace;
  else t.encoding = THREE.sRGBEncoding;
  t.anisotropy = 8;
  t.needsUpdate = true;
  return t;
}

const rnd = (a,b) => a + Math.random()*(b-a);

// La faccia dei titoli disegnati su canvas. E' LA STESSA del CSS -- ce
// n'e' una sola in tutto il sito -- se no i titoli sulle scatole e
// quelli nella pagina sembrano di due mani diverse.
const FF = "'Poppins', system-ui, sans-serif";

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
   L'OMBRA DENTRO I CUBI  (occlusione ambientale, dipinta)

   Un cubo di libreria non e' illuminato come la stanza attorno: la
   luce entra dal davanti e si spegne verso il fondo e verso gli
   angoli. Senza, lo schienale e' una tavola uniforme e il mobile si
   legge piatto -- tre file di rettangoli invece di dodici scatole
   dentro dei vani.

   Si dipinge sullo SCHIENALE, che e' UNA tavola sola per tutto il
   mobile: una texture, un materiale, e **nessuna chiamata di disegno
   in piu'**. Una SSAO vera vorrebbe una passata di post-produzione,
   cioe' il contrario di quello che serve qui.

   `celle` sono i rettangoli dei cubi in frazioni 0..1 dello schienale.
   Il bordo ALTO e' il piu' scuro -- la luce viene da sopra e il
   ripiano la ferma -- e il basso il piu' chiaro, perche' il fondo del
   cubo un po' di luce la rimanda su. Negli angoli le sfumature si
   sommano, ed e' esattamente dove un'occlusione e' piu' fitta. */
function aoCubi(c, celle, forza){
  const x = c.getContext('2d'), w = c.width, h = c.height;
  const f = forza === undefined ? .58 : forza;
  celle.forEach(function(r){
    const X = r[0] * w, Y = r[1] * h, W = (r[2] - r[0]) * w, H = (r[3] - r[1]) * h;
    const dentro = Math.min(W, H) * .44;          // quanto entra la sfumatura
    [[X, Y, X, Y + dentro, f],                    // dall'alto: il piu' scuro
     [X, Y + H, X, Y + H - dentro, f * .42],      // dal basso: il piu' chiaro
     [X, Y, X + dentro, Y, f * .70],              // da sinistra
     [X + W, Y, X + W - dentro, Y, f * .70]       // da destra
    ].forEach(function(s){
      const g = x.createLinearGradient(s[0], s[1], s[2], s[3]);
      g.addColorStop(0, 'rgba(0,0,0,' + s[4].toFixed(3) + ')');
      g.addColorStop(1, 'rgba(0,0,0,0)');
      x.fillStyle = g;
      x.fillRect(X, Y, W, H);
    });
  });
  return c;
}

// una copia su cui dipingere senza sporcare l'originale
function copia(c){
  const [d, x] = cnv(c.width, c.height);
  x.drawImage(c, 0, 0);
  return d;
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
  x.font = "600 104px " + FF;
  x.textBaseline = 'alphabetic'; x.textAlign = 'left';
  x.shadowColor = 'rgba(0,0,0,.5)'; x.shadowBlur = 14; x.shadowOffsetY = 3;
  spaced(x, 'Root', S/2, 486, 6, 'center');
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
  x.font = "600 96px " + FF;
  x.textBaseline = 'alphabetic'; x.textAlign = 'left';
  x.shadowColor = 'rgba(0,0,0,.55)'; x.shadowBlur = 16; x.shadowOffsetY = 3;
  spaced(x, 'Scythe', S/2, 462, 6, 'center');
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

/* Copertina di ripiego per i giochi aggiunti dall'admin: quando la
   vera immagine non c'e' (proxy spento, o gioco scritto a mano) la
   scatola deve comunque sembrare una scatola, con il suo titolo.
   Proporzioni da scatola vera, non quadrata. */
function coverTitolo(game){
  const W = 720, H = 520, [c,x] = cnv(W,H);
  const base = game.wrap || '#4a4632';

  x.fillStyle = base; x.fillRect(0,0,W,H);
  const g = x.createLinearGradient(0,0,W*.4,H);
  g.addColorStop(0,'rgba(255,255,255,.20)'); g.addColorStop(1,'rgba(0,0,0,.35)');
  x.fillStyle = g; x.fillRect(0,0,W,H);

  // raggiera dietro all'emblema
  x.save(); x.translate(W/2, H*.42);
  x.globalAlpha = .10; x.fillStyle = game.ink || '#f1e2bd';
  for (let i=0;i<12;i++){
    x.rotate(6.283/12);
    x.beginPath(); x.moveTo(0,0); x.lineTo(W, -34); x.lineTo(W, 34); x.closePath(); x.fill();
  }
  x.restore(); x.globalAlpha = 1;

  // un dado in prospettiva: e' pur sempre il dado e' trap
  x.save(); x.translate(W/2, H*.40); x.rotate(-.16);
  const s = 78;
  x.fillStyle = 'rgba(0,0,0,.28)';
  x.fillRect(-s+10, -s+14, s*2, s*2);
  x.fillStyle = game.ink || '#f1e2bd';
  x.fillRect(-s, -s, s*2, s*2);
  x.fillStyle = base;
  const pips = [[-1,-1],[1,-1],[0,0],[-1,1],[1,1]];
  for (let i=0;i<pips.length;i++){
    x.beginPath(); x.arc(pips[i][0]*s*.48, pips[i][1]*s*.48, s*.15, 0, 6.283); x.fill();
  }
  x.restore();

  // titolo, rimpicciolito finche' non ci sta
  const ink = game.ink || '#f1e2bd';
  /* Il titolo resta com'e' scritto, non tutto maiuscolo: un serif
     editoriale vive di maiuscole e minuscole insieme, e un blocco di
     capitali e' esattamente quello che faceva sembrare queste copertine
     un cartello e non una scatola. */
  const title = String(game.title || '');
  let size = 104;
  x.textBaseline = 'alphabetic'; x.textAlign = 'left';
  do {
    x.font = "600 " + size + "px " + FF;
    size -= 4;
  } while (size > 30 && x.measureText(title).width + title.length*3 > W - 90);

  x.fillStyle = 'rgba(0,0,0,.45)'; x.fillRect(46, H-152, W-92, 4);
  x.fillStyle = ink;
  x.shadowColor = 'rgba(0,0,0,.5)'; x.shadowBlur = 12; x.shadowOffsetY = 3;
  spaced(x, title, W/2, H-64, 7, 'center');
  x.shadowBlur = 0; x.shadowOffsetY = 0;

  if (game.designer){
    x.fillStyle = 'rgba(255,255,255,.55)';
    x.font = "20px 'Inter', sans-serif";
    spaced(x, String(game.designer).toUpperCase(), W/2, H-30, 3, 'center');
  }

  vignette(x, W, H, .34);
  grain(x, W, H, 12);
  x.strokeStyle = 'rgba(255,255,255,.16)'; x.lineWidth = 3;
  x.strokeRect(10,10,W-20,H-20);
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
  /* Sul dorso il maiuscolo resta: e' alto sessanta pixel su una
     striscia che a schermo ne vale otto, e li' contano le sagome delle
     lettere piu' della finezza. */
  x.font = "600 52px " + FF;
  x.textBaseline = 'middle'; x.textAlign = 'left';
  spaced(x, game.title.toUpperCase(), 0, 2, 5, 'center');
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
/* L'INTERNO DI UNA SCATOLA APERTA.

   Era un fondo marrone piatto con sopra tre sagome. Adesso c'e' il
   fondo di cartone che prende luce dal davanti, le quattro pareti
   interne smussate -- e' quello che fa capire che si guarda DENTRO una
   scatola e non una figurina appoggiata -- e ogni oggetto ha la sua
   ombra a terra: senza, galleggiavano tutti sullo stesso piano.

   I meeple usano `sagomaMeeple`, la stessa curva del profilo e della
   scena 3D. Prima ne avevano una loro, fatta a spezzata: era il terzo
   meeple diverso nello stesso sito, cioe' esattamente quello contro cui
   mettono in guardia le note. */
function ombraSotto(x, cx, cy, rx, ry, forza){
  const g = x.createRadialGradient(cx, cy, 0, cx, cy, Math.max(rx, ry));
  g.addColorStop(0, 'rgba(0,0,0,' + (forza === undefined ? .42 : forza) + ')');
  g.addColorStop(1, 'rgba(0,0,0,0)');
  x.save(); x.translate(cx, cy); x.scale(1, ry / rx); x.translate(-cx, -cy);
  x.fillStyle = g; x.beginPath(); x.arc(cx, cy, Math.max(rx, ry), 0, 6.283); x.fill();
  x.restore();
}

function inside(){
  const S = 512, [c,x] = cnv(S,S);

  // il fondo: cartone, piu' chiaro davanti, dove la luce entra
  const fondo = x.createLinearGradient(0, 0, 0, S);
  fondo.addColorStop(0, '#2b2217');
  fondo.addColorStop(.42, '#3b2f21');
  fondo.addColorStop(1, '#4b3d2b');
  x.fillStyle = fondo; x.fillRect(0, 0, S, S);

  /* Le quattro pareti interne. Un trapezio per lato, piu' scuro dove il
     lato e' in ombra: e' la cosa che da' la profondita', molto piu' di
     qualunque oggetto ci si metta dentro. */
  const par = 46;
  const muro = function(punti, tinta){
    x.fillStyle = tinta; x.beginPath();
    x.moveTo(punti[0], punti[1]); x.lineTo(punti[2], punti[3]);
    x.lineTo(punti[4], punti[5]); x.lineTo(punti[6], punti[7]);
    x.closePath(); x.fill();
  };
  muro([0,0, S,0, S-par,par, par,par], 'rgba(18,13,8,.62)');            // sopra
  muro([0,0, par,par, par,S-par, 0,S], 'rgba(18,13,8,.46)');            // sinistra
  muro([S,0, S,S, S-par,S-par, S-par,par], 'rgba(18,13,8,.30)');        // destra
  muro([0,S, par,S-par, S-par,S-par, S,S], 'rgba(60,48,32,.20)');       // davanti, in luce

  // regolamento
  ombraSotto(x, 126, 168, 108, 62);
  x.save(); x.translate(120,150); x.rotate(-.06);
  x.fillStyle = '#e8dcc0'; x.fillRect(-84,-110,168,220);
  x.fillStyle = 'rgba(60,44,26,.8)'; x.fillRect(-60,-84,120,7);
  x.fillStyle = 'rgba(60,44,26,.45)';
  for (let i=0;i<8;i++) x.fillRect(-60,-56+i*17, 120 - (i%3)*28, 4);
  x.restore();

  // mazzo di carte
  ombraSotto(x, 356, 156, 96, 56);
  x.save(); x.translate(350,140); x.rotate(.1);
  for (let i=4;i>=0;i--){
    x.fillStyle = i === 0 ? '#8f4a2c' : '#6e3a22';
    x.fillRect(-66+i*2, -96+i*2, 132, 190);
  }
  x.fillStyle = 'rgba(240,220,180,.85)'; x.fillRect(-40,-40,80,80);
  x.restore();

  // segnalini di cartone, ognuno appoggiato per davvero
  const tok = ['#c1552c','#4f6b48','#b98d4f','#4b5b70','#8a5730'];
  for (let i=0;i<14;i++){
    const cx = rnd(80,430), cy = rnd(300,462), r = rnd(12,22);
    ombraSotto(x, cx + 3, cy + 5, r * 1.5, r * .9, .34);
    x.fillStyle = tok[i % tok.length];
    x.beginPath(); x.arc(cx, cy, r, 0, 6.283); x.fill();
    // il bordo del cartone: chiaro sopra, scuro sotto
    x.strokeStyle = 'rgba(255,240,215,.22)'; x.lineWidth = 2;
    x.beginPath(); x.arc(cx, cy, r - 1, 3.6, 6.0); x.stroke();
    x.strokeStyle = 'rgba(0,0,0,.34)';
    x.beginPath(); x.arc(cx, cy, r - 1, .4, 2.9); x.stroke();
  }

  /* Due dadi d'avorio: sono il soggetto del sito, e in una scatola
     aperta ci stanno sempre. */
  const dado = function(dx, dy, s, ang, pips){
    ombraSotto(x, dx + 4, dy + s * .8, s * 1.5, s * .8, .40);
    x.save(); x.translate(dx, dy); x.rotate(ang);
    const gg = x.createLinearGradient(-s, -s, s, s);
    gg.addColorStop(0, '#f6f1e4'); gg.addColorStop(1, '#d9cbb0');
    x.fillStyle = gg;
    x.beginPath();
    if (x.roundRect) x.roundRect(-s, -s, s*2, s*2, s * .28);
    else x.rect(-s, -s, s*2, s*2);
    x.fill();
    x.strokeStyle = 'rgba(70,52,30,.28)'; x.lineWidth = 1.4; x.stroke();
    x.fillStyle = '#33261a';
    pips.forEach(function(p){
      x.beginPath(); x.arc(p[0] * s * .46, p[1] * s * .46, s * .15, 0, 6.283); x.fill();
    });
    x.restore();
  };
  dado(408, 300, 26, -.18, [[-1,-1],[1,-1],[-1,1],[1,1],[0,0]]);
  dado(452, 356, 21,  .26, [[-1,-1],[1,1],[0,0]]);

  /* I meeple, con la SAGOMA VERA -- la stessa del profilo e della scena
     in tre dimensioni. Averne una terza qui dentro voleva dire tre
     meeple diversi nello stesso sito. */
  const meeple = function(mx, my, s, col){
    ombraSotto(x, mx + 4, my + s * .34, s * .62, s * .26, .44);
    x.save();
    x.fillStyle = col;
    sagomaMeeple(x, s, mx, my);
    x.fill();
    // un filo di luce sul lato da cui viene la luce
    x.globalAlpha = .22; x.fillStyle = '#fff9ec';
    sagomaMeeple(x, s * .93, mx - s * .04, my - s * .03);
    x.fill();
    x.restore();
  };
  meeple(146, 398, 62, '#d8552c');
  meeple(238, 434, 48, '#e8c05f');

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

/* Le sei facce non diventano piu' sei materiali: costavano sei
   chiamate di disegno per dado. Ora `atlanteDado` in app.js le mette
   in un atlante 3x2 e il dado e' un oggetto solo -- l'ordine delle
   facce (+X, -X, +Y, -Y, +Z, -Z, con le opposte che sommano a sette)
   e' passato di la'. */

/* --- la faccia del profilo ---------------------------------------
   Un meeple su un fondo, disegnato qui come tutto il resto: niente
   immagini caricate, niente bucket, niente moderazione. Chi entra ha
   una faccia dal primo secondo e puo' cambiarla, ma non puo' metterci
   dentro qualunque cosa -- che per un sito con degli amici dentro e'
   una semplificazione, non una rinuncia.

   La sagoma e' la stessa del meeple 3D in app.js, con la testa
   disegnata come cerchio a parte invece che con l'arco: a novantasei
   pixel non si distingue, e si evita di ragionare sull'orientamento
   dell'arco in un sistema con la y capovolta. */
/* IL MEEPLE, UNA SAGOMA SOLA.

   Il giro parte dal piede sinistro e va in senso orario: gamba su,
   fianco, sotto il braccio, la mano, sopra il braccio, spalla, collo,
   mezzo giro di testa -- e tutto specchiato dall'altra parte -- poi
   giu' per la gamba destra, la pianta, e su per la V fino al cavallo,
   che non arriva mai piu' in alto della vita.

   Tutto in curve, perche' un meeple e' tornito e non ritagliato. Il
   primo tentativo lo aveva fatto in tre pezzi separati e le gambe
   erano un triangolo col taglio in mezzo: a centoventi pixel sembrava
   un birillo.

   Le stesse coordinate stanno in js/app.js: e' lo stesso personaggio, uno
   dipinto su canvas e uno estruso in tre dimensioni, e se divergono si
   vedono due meeple diversi nella stessa schermata. */
function sagomaMeeple(x, s, cx, cy){
  const P = function(px, py){ return [cx + px*s, cy - py*s]; };
  const m = function(px, py){ const q = P(px,py); x.moveTo(q[0], q[1]); };
  const l = function(px, py){ const q = P(px,py); x.lineTo(q[0], q[1]); };
  const c = function(ax, ay, bx, by, px, py){
    const a = P(ax,ay), b = P(bx,by), q = P(px,py);
    x.bezierCurveTo(a[0],a[1], b[0],b[1], q[0],q[1]);
  };
  x.beginPath();
  m(-0.93,-1.00);
  c(-0.97,-0.72, -0.80,-0.34, -0.56,-0.06);
  c(-0.72,-0.06, -0.88,-0.05, -0.96,0.00);
  c(-1.03,0.06, -1.03,0.26, -0.94,0.34);
  c(-0.78,0.46, -0.52,0.56, -0.33,0.59);
  c(-0.34,0.66, -0.34,0.74, -0.32,0.80);
  c(-0.32,1.02, 0.32,1.02, 0.32,0.80);
  c(0.34,0.74, 0.34,0.66, 0.33,0.59);
  c(0.52,0.56, 0.78,0.46, 0.94,0.34);
  c(1.03,0.26, 1.03,0.06, 0.96,0.00);
  c(0.88,-0.05, 0.72,-0.06, 0.56,-0.06);
  c(0.80,-0.34, 0.97,-0.72, 0.93,-1.00);
  l(0.26,-1.00);
  c(0.24,-0.80, 0.12,-0.68, 0.00,-0.61);
  c(-0.12,-0.68, -0.24,-0.80, -0.26,-1.00);
  l(-0.93,-1.00);
  x.closePath();
  x.fill();
}

/* I puntini di un dado, in filigrana dietro al meeple.

   NON SI USA PIU'. Con il meeple ridisegnato -- pieno, con le braccia
   che attraversano tutto il quadrato -- della filigrana restavano due
   angoli, e nel ritaglio tondo del profilo nemmeno quelli. Si sceglieva
   un numero che nessuno poteva vedere. Resta qui perche' e' un disegno
   buono, se un giorno torna un posto dove si veda. */
function filigranaDado(x, n, S){
  if (!n) return;
  const POS = {
    1:[[1,1]], 2:[[0,0],[2,2]], 3:[[0,0],[1,1],[2,2]],
    4:[[0,0],[2,0],[0,2],[2,2]], 5:[[0,0],[2,0],[1,1],[0,2],[2,2]],
    6:[[0,0],[2,0],[0,1],[2,1],[0,2],[2,2]]
  }[n] || [];
  const passo = S * .26, marg = S * .22, r = S * .052;
  x.globalAlpha = .16;
  POS.forEach(function(p){
    x.beginPath();
    x.arc(marg + p[0]*passo, marg + p[1]*passo, r, 0, Math.PI*2);
    x.fill();
  });
  x.globalAlpha = 1;
}

function avatar(av, S){
  S = S || 160;
  av = av || {};
  const cx = cnv(S, S), c = cx[0], x = cx[1];

  x.fillStyle = av.fondo || '#efe3cb';
  x.fillRect(0, 0, S, S);

  x.fillStyle = av.corpo || '#c1552c';

  /* Il meeple sta PIU' LARGO nel quadrato di prima: a 0.40 arrivava a
     filo del bordo e dentro un ritaglio tondo -- che e' come si vede
     nel profilo -- le mani venivano tagliate via.

     Sta anche un filo PIU' IN ALTO del centro geometrico. Con la
     sagoma vecchia valeva il contrario -- era la testa tonda a tirare
     l'occhio in su, e la si compensava scendendo -- ma questa ha il
     grosso dell'inchiostro nelle braccia, che sono larghe e stanno a
     meta' altezza: il peso visivo e' piu' basso della figura, e per
     leggersi in mezzo deve salire.

     La misura non e' a occhio. Disegnando il meeple nero su bianco e
     contando i pixel, a 0.49 l'ingombro era centrato (0.494) ma il
     BARICENTRO dell'inchiostro cadeva a 0.524: le gambe sono piene e
     la testa e' piccola, quindi la massa sta in basso. A 0.475 il
     baricentro torna in mezzo, e l'ingombro resta appena alto -- che e'
     esattamente come si legge "centrato" per una figura con una testa. */
  sagomaMeeple(x, S * .31, S/2, S * .475);

  grain(x, S, S, 8);
  return c;
}

/* Un quadretto da mettere nelle cornici sugli scaffali. Astratto
   apposta: qualunque soggetto riconoscibile, a quattro centimetri di
   altezza sullo schermo, diventa una macchia sporca. Forme piatte nei
   colori della stanza si leggono anche piccole. */
/* Il nome del mobile, da appendere sopra al mobile. Sfondo trasparente:
   si legge come scritta sulla parete, non come cartello appeso -- un
   cartello vero avrebbe voluto una cornice, un'ombra e uno spessore, e
   sopra una libreria ce n'e' gia' abbastanza.

   La larghezza del canvas segue la lunghezza del testo invece di essere
   fissa: con un canvas fisso, "Party games" e "A" venivano stirati in
   modo diverso sullo stesso piano. */
/* La targhetta e' la tipografia piu' grande della scena, quindi e'
   quella che decide di che sito si tratta. Il nome ci va **come lo hai
   scritto**: un serif editoriale in maiuscole e minuscole, spaziato
   appena. Tutto maiuscolo e tracciato di sei pixel era il modo di far
   funzionare un condensato, ed era l'opposto di questo. */
/* IL NOME DEL MOBILE: UNA SCRITTA SUL MURO, E BASTA.

   Ci sono passate tre versioni prima di tornare qui. Testo scuro sulla
   parete; poi lo stesso testo con un alone chiaro dietro; poi una targa
   di carta con gli angoli tondi, l'ombra e l'icona della libreria. Ogni
   giro rispondeva allo stesso problema -- la parete cambia colore, e
   con la luce bassa diventa quasi nera, quindi una scritta scura ci
   spariva dentro.

   Ma quel problema non si risolve mettendo un foglio sotto le lettere:
   si risolve **lasciando scegliere il colore della scritta**, che e' il
   modo in cui si risolve in una stanza vera. Cosi' la scritta resta una
   scritta, senza bordo, senza ombra e senza icona -- e su un muro scuro
   la si mette chiara.

   `tinta` arriva da `STANZA.corrente().nome`. Se manca resta
   l'inchiostro di sempre, che e' come stava prima di poterlo cambiare. */
function targhetta(nome, tinta){
  const testo = String(nome || '');
  const H = 128, CORPO = 78, padX = 18;

  const mis = cnv(8, 8)[1];
  mis.font = '400 ' + CORPO + 'px "Poppins", system-ui, sans-serif';
  const larg = Math.max(120, Math.ceil(mis.measureText(testo).width) + padX * 2);

  const cx = cnv(larg, H), c = cx[0], x = cx[1];
  x.font = mis.font;
  x.letterSpacing = '0px';
  x.textAlign = 'center';
  x.textBaseline = 'middle';
  x.fillStyle = tinta || '#33352b';
  x.fillText(testo, larg / 2, H * .54);
  return c;
}

function quadro(seed){
  const S = 256, cx = cnv(S, S), c = cx[0], x = cx[1];
  const rnd = function(n){
    const v = Math.sin((seed + n) * 127.1 + 311.7) * 43758.5453;
    return v - Math.floor(v);
  };
  const FONDI = ['#efe3cb', '#e2d3b6', '#d8ddd6', '#e6d9d0'];
  const TINTE = ['#c1552c', '#9a6a15', '#3f4f63', '#4d5a48', '#6a3a3a', '#57406a'];

  x.fillStyle = FONDI[Math.floor(rnd(1) * FONDI.length) % FONDI.length];
  x.fillRect(0, 0, S, S);

  const modo = Math.floor(rnd(2) * 3);
  for (let i = 0; i < 3 + Math.floor(rnd(3) * 3); i++){
    x.fillStyle = TINTE[Math.floor(rnd(10 + i) * TINTE.length) % TINTE.length];
    x.globalAlpha = .55 + rnd(20 + i) * .4;
    if (modo === 0){                       // colline sovrapposte
      x.beginPath();
      x.moveTo(0, S);
      x.lineTo(0, S * (.4 + rnd(30 + i) * .4));
      x.quadraticCurveTo(S / 2, S * (.15 + rnd(40 + i) * .5), S, S * (.35 + rnd(50 + i) * .45));
      x.lineTo(S, S);
      x.closePath();
      x.fill();
    } else if (modo === 1){                // rettangoli
      const w = S * (.15 + rnd(30 + i) * .4), h = S * (.15 + rnd(40 + i) * .5);
      x.fillRect(rnd(50 + i) * (S - w), rnd(60 + i) * (S - h), w, h);
    } else {                               // cerchi
      x.beginPath();
      x.arc(S * (.2 + rnd(30 + i) * .6), S * (.2 + rnd(40 + i) * .6),
            S * (.08 + rnd(50 + i) * .18), 0, Math.PI * 2);
      x.fill();
    }
  }
  x.globalAlpha = 1;
  grain(x, S, S, 10);
  return c;
}

return {
  cnv: cnv, toTex: toTex, imgTex: imgTex, wood: wood, spaced: spaced, grain: grain,
  aoCubi: aoCubi, copia: copia,
  avatar: avatar, quadro: quadro, targhetta: targhetta,
  coverRoot: coverRoot, coverScythe: coverScythe, coverGeneric: coverGeneric,
  coverTitolo: coverTitolo,
  spine: spine, cardboard: cardboard, inside: inside,
  dieFace: dieFace
};
})();
