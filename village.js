// Fun Village – dense single-view scene (480x320 world, integer-scaled)
const W=480,H=320;
const cv=document.getElementById('c'),ctx=cv.getContext('2d');
let S=2;
function fit(){
  const st=document.getElementById('stage');
  const a=st.clientWidth-16, ah=st.clientHeight-16;
  const f=Math.min(a/W,ah/H);
  S=Math.max(1,Math.floor(f));
  cv.width=W*S;cv.height=H*S;
  // on small screens (f<1) shrink with CSS so the whole scene stays visible
  const css=f<1?f:S;
  cv.style.width=Math.floor(W*css)+'px';cv.style.height=Math.floor(H*css)+'px';
  dirty=true;
}

// ---------- fixed seeded ground (built once at world resolution) ----------
function mulberry32(a){return function(){a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}
const ground=document.createElement('canvas');ground.width=W;ground.height=H;
(function buildGround(){
  const g=ground.getContext('2d',{willReadFrequently:true}),rnd=mulberry32(20261113);
  g.fillStyle='#5fae4a';g.fillRect(0,0,W,H);
  // soft patches of lighter / darker grass
  for(let i=0;i<70;i++){
    const x=rnd()*W|0,y=rnd()*H|0,w=6+(rnd()*14|0),h=3+(rnd()*6|0);
    g.fillStyle=rnd()<.5?'#68b84f':'#57a343';
    g.fillRect(x,y,w,h);
  }
  // dirt paths: plaza around the fountain plus lanes to each side (per-pixel, no antialiasing)
  const segs=[[240,178,240,178,0],[240,178,195,95,5],[240,178,65,135,5],[240,185,45,225,5],[240,195,240,320,5],[250,182,335,172,5],[335,172,480,160,5],[255,192,292,232,5]];
  const id=g.getImageData(0,0,W,H),d=id.data,hr=mulberry32(77);
  function dseg(px,py,s){const dx=s[2]-s[0],dy=s[3]-s[1],l=dx*dx+dy*dy;let t=l?((px-s[0])*dx+(py-s[1])*dy)/l:0;t=Math.max(0,Math.min(1,t));const x=s[0]+t*dx-px,y=s[1]+t*dy-py;return Math.hypot(x,y*1.5);}
  for(let y=0;y<H;y++)for(let x=0;x<W;x++){
    let dist=Math.hypot((x-240)/74,(y-178)/38)*74*0.78; // plaza ellipse (approx. distance)
    let m=dist-74*0.78+0; // negative inside
    let best=m;
    for(let i=1;i<segs.length;i++){const v=dseg(x,y,segs[i])-segs[i][4];if(v<best)best=v;}
    const n=hr();
    if(best<-1.5+n*1.2){const k=(best<-3?0:1);const base=k?[190,160,104]:[206,178,120];const j=(n*18)|0;
      const p=(y*W+x)*4;d[p]=base[0]+j-9;d[p+1]=base[1]+j-9;d[p+2]=base[2]+j-9;}
    else if(best<1.5&&n<.55){const p=(y*W+x)*4;d[p]=150;d[p+1]=170;d[p+2]=84;}
  }
  g.putImageData(id,0,0);
  // grass tufts and tiny flowers (fixed positions)
  const gd=g.getImageData(0,0,W,H).data;
  for(let i=0;i<260;i++){
    const x=rnd()*W|0,y=rnd()*H|0,q=(y*W+x)*4;
    if(gd[q]<120&&gd[q+1]>150){ // only on grass
      const r=rnd();
      if(r<.6){g.fillStyle='#4a9438';g.fillRect(x,y,1,2);g.fillRect(x+2,y+1,1,1);}
      else if(r<.8){g.fillStyle='#7fd062';g.fillRect(x,y,2,1);}
      else{g.fillStyle=['#f4f0e0','#f2d65a','#f08ab6','#b9a4f0'][rnd()*4|0];g.fillRect(x,y,2,2);g.fillStyle='#3f8a35';g.fillRect(x,y+2,1,1);}
    }
  }
})();

// ---------- assets (stored at 2x, drawn at 1/2 * scale) ----------
const assets={};
const NAMES=['house1','house2','tree','fountain','well','stall','pond'];
function load(name){
  return new Promise(r=>{
    const img=new Image();
    img.onload=()=>{assets[name]=img;r();};
    img.onerror=()=>r();
    img.src='assets/'+name+'.png';
  });
}
// x,y = top-left in world px, s = extra scale. Drawn sorted by bottom edge (depth).
const items=[
  {k:'tree',    x:0,   y:0,   s:.9},
  {k:'house1',  x:30,  y:6,   s:1},
  {k:'house2',  x:188, y:0,   s:1},
  {k:'tree',    x:385, y:0,   s:1},
  {k:'well',    x:140, y:118, s:.85},
  {k:'fountain',x:175, y:125, s:1},
  {k:'stall',   x:336, y:108, s:.95},
  {k:'house1',  x:8,   y:182, s:.88},
  {k:'tree',    x:118, y:195, s:.82},
  {k:'pond',    x:196, y:243, s:.9},
  {k:'house2',  x:330, y:192, s:.88},
  {k:'tree',    x:438, y:150, s:.78}
];
function bottom(o){const i=assets[o.k];return o.y+(i?i.height/2*o.s:0);}
let order=[];
let dirty=true;
function draw(){
  if(!dirty)return;
  dirty=false;
  ctx.imageSmoothingEnabled=false;
  ctx.drawImage(ground,0,0,W*S,H*S);
  ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality='high';
  for(const o of order){
    const img=assets[o.k];
    ctx.drawImage(img,Math.round(o.x*S),Math.round(o.y*S),Math.round(img.width/2*o.s*S),Math.round(img.height/2*o.s*S));
  }
}
function loop(){draw();requestAnimationFrame(loop);}
async function start(){
  await Promise.all(NAMES.map(load));
  order=items.filter(o=>assets[o.k]).sort((a,b)=>bottom(a)-bottom(b));
  dirty=true;loop();
}
window.addEventListener('resize',fit);fit();
start();
document.getElementById('info').textContent='Environment upgrade in progress. Villagers and animals coming next.';
