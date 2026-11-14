// Fun Village – an enchanted, dense single-view scene (480x320 world) with walking villagers, a wizard,
// magical creatures, day/night on real Eastern time and tap-to-zoom.
// Ground + props are cached/pre-scaled per resolution; characters are animated with requestAnimationFrame
// and depth-sorted with the props by their feet (bottom) y.
'use strict';
const W=480,H=320;
const cv=document.getElementById('c'),ctx=cv.getContext('2d');
const QS=new URLSearchParams(location.search);
const DEBUG=QS.has('debug');
const TS=Math.max(1,Math.min(20,parseInt(QS.get('speed'))||1)); // ?speed=N fast-forwards the simulation (testing)
const HOUR_FLAG=(QS.has('hour')&&isFinite(parseFloat(QS.get('hour'))))?(((parseFloat(QS.get('hour'))%24)+24)%24):null; // ?hour=H pins the clock (demo/testing)
const K=4; // character sheets are stored at 4 px per world px
let R0=2,R=2,css=2; // R0 = backing-store scale, R = cache scale (2*R0 while zoomed in), css = css px per world px
let groundR=null,propsR=[],sheetsR={},broomUpR=null;

// ---------- tiny helpers ----------
function mulberry32(a){return function(){a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}
const rnd=Math.random;
const rr=(a,b)=>a+rnd()*(b-a);
const pick=a=>a[(rnd()*a.length)|0];
const dist=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1]);
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const lerp=(a,b,t)=>a+(b-a)*t;

// ---------- walking graph (world coords = feet position) ----------
const N={
  N1:[206,137],N2:[240,139],N3:[276,141],NE:[306,152],E:[322,186],SE:[304,230],S:[240,240],SW:[186,242],SWM:[189,223],W:[172,209],
  WELL:[160,202],W2:[109,207],W3:[106,150],W4:[109,272],W5:[110,292],
  D1:[69,126],D2:[222,118],D3:[42,291],D4:[358,303],TD:[309,129],
  P1:[318,252],P2:[326,303],PT:[444,313],
  JB:[387,200],
  MA:[94,168],MB:[48,309]
};
const EDGES=[['N1','N2'],['N2','N3'],['N3','NE'],['NE','E'],['E','SE'],['SE','S'],['S','SW'],['SW','SWM'],['SWM','W'],
  ['N1','D2'],['W','WELL'],['WELL','W2'],['W2','W3'],['W3','D1'],['W2','W4'],['W4','W5'],['W5','D3'],
  ['SE','P1'],['P1','P2'],['P2','D4'],['E','JB'],['NE','TD'],['P2','PT'],
  ['W3','MA'],['W5','MB']];
const HIDDEN=new Set(['W3-MA','W5-MB']); // short spurs to decor, not drawn as dirt
const SLOTS=[[369,201],[352,204],[335,207],[318,210]]; // queue at the stall, slot 0 = at the counter
const DOORS=['D1','D2','D3','D4','TD'];
const DOORNAME={D1:'the north-west cottage',D2:'the north cottage',D3:'the south-west cottage',D4:'the south-east cottage',TD:"Merrick's tower"};
const RING=['N2','N3','NE','E','SE','S','SW','SWM','W'];
const adj={};for(const k in N)adj[k]=[];
for(const [a,b] of EDGES){adj[a].push(b);adj[b].push(a);}
function route(a,b){ // Dijkstra over the small graph -> array of node names
  if(a===b)return [a];
  const d={},prev={},todo=new Set(Object.keys(N));for(const k of todo)d[k]=1e9;d[a]=0;
  while(todo.size){let u=null;for(const k of todo)if(u===null||d[k]<d[u])u=k;todo.delete(u);if(u===b)break;
    for(const v of adj[u]){const nd=d[u]+dist(N[u],N[v]);if(nd<d[v]){d[v]=nd;prev[v]=u;}}}
  const out=[b];while(out[0]!==a&&prev[out[0]])out.unshift(prev[out[0]]);return out;
}
// obstacles = what feet must not enter (props' footprints / tree canopies)
const OBST=[
  {e:[240,192,66,41]},            // fountain
  {r:[146,158,190,192]},          // well
  {e:[251,281,54,30]},            // pond
  {r:[34,0,142,116]},             // house 1
  {r:[188,0,300,112]},            // house 2
  {r:[6,184,106,284]},            // house 3
  {r:[114,226,184,320]},          // tree (canopy+trunk)
  {r:[334,204,428,300]},          // house 4
  {r:[330,96,432,190]},           // magic stall (incl. counter)
  {r:[290,0,346,122]},            // wizard's tower
  {r:[0,0,82,112]},{r:[384,0,476,124]},{r:[436,150,480,248]}, // trees
  {r:[425,266,463,308]},          // portal stone
  {r:[86,152,102,166]},{r:[447,134,466,146]},{r:[124,170,144,184]},{r:[22,298,40,312]} // mushrooms / crystals / flowers
];
function blocked(x,y,pad=0,bounds){
  if(bounds&&(x<5||x>475||y<138||y>316))return true;
  for(const o of OBST){
    if(o.r){const r=o.r;if(x>r[0]-pad&&x<r[2]+pad&&y>r[1]-pad&&y<r[3]+pad)return true;}
    else{const e=o.e;const dx=(x-e[0])/(e[2]+pad),dy=(y-e[1])/(e[3]+pad);if(dx*dx+dy*dy<1)return true;}
  }
  return false;
}
function segClear(a,b,pad=0,bounds){const n=Math.ceil(dist(a,b)/3);for(let i=0;i<=n;i++){const t=i/n;if(blocked(a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t,pad,bounds))return false;}return true;}
// door/stall/spur points are allowed inside blocks; only validate the ring/lane edges
const SKIP_VALIDATE=new Set(['JB','TD','MA','MB']);
function validateGraph(){
  const bad=[];
  for(const [a,b] of EDGES){
    if(SKIP_VALIDATE.has(a)||SKIP_VALIDATE.has(b))continue;
    if(!segClear(N[a],N[b]))bad.push(a+'-'+b);
  }
  return bad;
}

// ---------- fixed seeded ground (built once at world resolution) ----------
const ground=document.createElement('canvas');ground.width=W;ground.height=H;
(function buildGround(){
  const g=ground.getContext('2d',{willReadFrequently:true}),rnd=mulberry32(20261113);
  g.fillStyle='#5fae4a';g.fillRect(0,0,W,H);
  for(let i=0;i<70;i++){
    const x=rnd()*W|0,y=rnd()*H|0,w=6+(rnd()*14|0),h=3+(rnd()*6|0);
    g.fillStyle=rnd()<.5?'#68b84f':'#57a343';
    g.fillRect(x,y,w,h);
  }
  // dirt paths follow the walking graph so villagers really walk on them
  const segs=[];
  for(const [a,b] of EDGES){if(a==='JB'||b==='JB'||HIDDEN.has(a+'-'+b))continue;segs.push([N[a][0],N[a][1],N[b][0],N[b][1],a==='W'||b==='WELL'||a==='W2'?4.5:4]);}
  segs.push([N.E[0],N.E[1],SLOTS[3][0],SLOTS[3][1],4],[SLOTS[3][0],SLOTS[3][1],N.JB[0],N.JB[1],4]);
  const id=g.getImageData(0,0,W,H),d=id.data,hr=mulberry32(77);
  function dseg(px,py,s){const dx=s[2]-s[0],dy=s[3]-s[1],l=dx*dx+dy*dy;let t=l?((px-s[0])*dx+(py-s[1])*dy)/l:0;t=Math.max(0,Math.min(1,t));const x=s[0]+t*dx-px,y=s[1]+t*dy-py;return Math.hypot(x,y*1.3);}
  for(let y=0;y<H;y++)for(let x=0;x<W;x++){
    let best=(Math.hypot((x-240)/84,(y-192)/54)-1)*54; // plaza ellipse (signed approx distance)
    for(const s of segs){const v=dseg(x,y,s)-s[4];if(v<best)best=v;}
    const n=hr();
    if(best<-1.5+n*1.2){const k=(best<-3?0:1);const base=k?[190,160,104]:[206,178,120];const j=(n*18)|0;
      const p=(y*W+x)*4;d[p]=base[0]+j-9;d[p+1]=base[1]+j-9;d[p+2]=base[2]+j-9;}
    else if(best<1.5&&n<.55){const p=(y*W+x)*4;d[p]=150;d[p+1]=170;d[p+2]=84;}
  }
  g.putImageData(id,0,0);
  const gd=g.getImageData(0,0,W,H).data;
  for(let i=0;i<260;i++){
    const x=rnd()*W|0,y=rnd()*H|0,q=(y*W+x)*4;
    if(gd[q]<120&&gd[q+1]>150){
      const r=rnd();
      if(r<.6){g.fillStyle='#4a9438';g.fillRect(x,y,1,2);g.fillRect(x+2,y+1,1,1);}
      else if(r<.8){g.fillStyle='#7fd062';g.fillRect(x,y,2,1);}
      else{g.fillStyle=['#f4f0e0','#f2d65a','#f08ab6','#b9a4f0'][rnd()*4|0];g.fillRect(x,y,2,2);g.fillStyle='#3f8a35';g.fillRect(x,y+2,1,1);}
    }
  }
})();

// ---------- assets ----------
const assets={};
const PK={house1:2,house2:2,tree:2,fountain:2,well:2,pond:2,tower:3,magicstall:3,mushrooms:4,crystals:4,flowers:4,portal:4,lantern:4,broom:4}; // stored px per world px
const PROPS=Object.keys(PK);
const CHARS={ // sheet meta: cell w,h and feet anchor (sheet px), rows x cols; rows are front / back / side-left
  rosie:{cw:64,ch:116,ay:112,rows:3,cols:4},theo:{cw:76,ch:128,ay:124,rows:3,cols:4},mabel:{cw:68,ch:116,ay:112,rows:3,cols:4},
  finn:{cw:68,ch:100,ay:96,rows:3,cols:4},juniper:{cw:60,ch:116,ay:112,rows:3,cols:4},merrick:{cw:88,ch:140,ay:136,rows:3,cols:4},
  cat:{cw:52,ch:60,ay:56,rows:3,cols:4},dog:{cw:64,ch:68,ay:64,rows:3,cols:4},duck:{cw:44,ch:64,ay:60,rows:3,cols:4},
  dragon:{cw:72,ch:76,ay:72,rows:3,cols:4},frog:{cw:60,ch:76,ay:72,rows:3,cols:4},fairy:{cw:40,ch:52,ay:48,rows:3,cols:4},
  mabelfly:{cw:132,ch:136,ay:132,rows:1,cols:4}
};
const TIPS={merrick:{down:[-8.3,-25.6],up:[7.2,-24.4],side:[-8.5,-24.9]},finn:{down:[-7.3,-13.5],up:[-6.7,-12.8],side:[-7,-14]}}; // staff / wand tip offsets from the feet anchor (side = facing left)
function loadImg(src){return new Promise(r=>{const i=new Image();i.onload=()=>r(i);i.onerror=()=>r(null);i.src=src;});}
// x,y = top-left in world px, s = scale, sy = depth-sort y (feet line of the prop)
const items=[
  {k:'tree',    x:0,   y:0,   s:.9,  sy:108},
  {k:'house1',  x:30,  y:6,   s:1,   sy:118},
  {k:'house2',  x:188, y:0,   s:1,   sy:113},
  {k:'tower',   x:288, y:-2,  s:1,   sy:123},
  {k:'tree',    x:385, y:0,   s:1,   sy:118},
  {k:'well',    x:140, y:118, s:.85, sy:191},
  {k:'fountain',x:175, y:125, s:1,   sy:232},
  {k:'magicstall',x:330,y:95, s:1,   sy:196},
  {k:'house1',  x:8,   y:182, s:.88, sy:284},
  {k:'tree',    x:116, y:230, s:.72, sy:313},
  {k:'pond',    x:196, y:243, s:.9,  sy:254},
  {k:'house2',  x:330, y:192, s:.88, sy:299},
  {k:'tree',    x:438, y:150, s:.78, sy:240},
  // magical density
  {k:'mushrooms',x:84, y:142, s:1,  sy:166},
  {k:'crystals', x:446,y:120, s:1,  sy:146},
  {k:'mushrooms',id:'m2',x:20,y:288,s:1,sy:312},
  {k:'flowers',  x:124,y:164, s:1,  sy:184},
  {k:'portal',   x:427,y:268, s:1,  sy:306,fx:'portal'}
];
items.sort((a,b)=>a.sy-b.sy);
const ITEM={};for(const o of items){const key=o.id||o.k;if(!ITEM[key])ITEM[key]=o;}
function item(k){return ITEM[k];}

// light sources per prop (local world px at scale 1 from the prop's top-left): x,y,radius,kind(,strength). w=warm lamp/window, others magic
const LCOL={w:'255,196,104',v:'196,140,255',i:'120,226,255',g:'255,226,120',p:'255,150,200',f:'100,196,255',t:'104,255,208',r:'110,186,255',o:'255,170,90'};
const LIGHTS_BY={
  house1:[[84,89,14,'w'],[6,93,12,'w'],[12,93,12,'w'],[47,62,11,'w']],
  house2:[[40,38,12,'w'],[25,84,12,'w'],[47,87,12,'w'],[42,54,11,'w'],[86,85,11,'w']],
  tower:[[22,46,20,'w',1.3],[35,49,11,'w'],[22,71,10,'w'],[22,87,10,'w'],[8,99,12,'w'],[49,17,11,'i'],[19,29,10,'i'],[43,31,9,'i'],[27,3,10,'g']],
  magicstall:[[23,43,15,'w'],[82,58,13,'v'],[52,52,11,'v'],[66,54,11,'i'],[34,56,11,'p']],
  well:[[30,56,13,'i']],
  fountain:[[63,62,46,'f',.8],[63,14,18,'i']],
  mushrooms:[[10,13,16,'t']],crystals:[[10,14,17,'v']],flowers:[[11,11,15,'p']],portal:[[17,19,17,'r']]
};
const LIGHTS=[]; // world-space, built after layout
(function buildLights(){
  for(const o of items){const L=LIGHTS_BY[o.k];if(!L)continue;
    for(const l of L)LIGHTS.push({x:o.x+l[0]*o.s,y:o.y+l[1]*o.s,r:l[2]*o.s,c:LCOL[l[3]],magic:l[3]!=='w',a:l[4]||1,ph:Math.random()*6.28,fx:o.fx||null,k:o.k});}
})();

// ---------- scaling / layout / view ----------
const view={z:1,cx:W/2,cy:H/2,tz:1,tcx:W/2,tcy:H/2};
const MAXZ=2;
function fit(){
  const st=document.getElementById('stage');
  const a=st.clientWidth-16, ah=st.clientHeight-16;
  const f=Math.min(a/W,ah/H);
  const S=Math.max(1,Math.floor(f*4)/4);
  css=f<1?f:S;
  const dpr=Math.min(window.devicePixelRatio||1,2);
  R0=Math.max(1,Math.min(3,Math.ceil(css*dpr-0.001)));
  cv.width=W*R0;cv.height=H*R0;
  cv.style.width=Math.floor(W*css)+'px';cv.style.height=Math.floor(H*css)+'px';
  R=(view.tz>1||view.z>1.001)?R0*2:R0;
  rebuild();
  const zb2=document.getElementById('zoom');
  if(zb2){zb2.style.right='auto';zb2.style.bottom='auto';zb2.style.left=(cv.offsetLeft+cv.offsetWidth-46)+'px';zb2.style.top=(cv.offsetTop+cv.offsetHeight-46)+'px';}
}
function mk(w,h){const c=document.createElement('canvas');c.width=Math.max(1,w);c.height=Math.max(1,h);return c;}
let glowCache={};
function rebuild(){
  glowCache={};
  groundR=mk(W*R,H*R);const g=groundR.getContext('2d');g.imageSmoothingEnabled=false;g.drawImage(ground,0,0,W*R,H*R);
  propsR=items.map(o=>{const img=assets[o.k];if(!img)return null;
    const pk=PK[o.k],w=Math.round(img.width/pk*o.s*R),h=Math.round(img.height/pk*o.s*R);
    const c=mk(w,h),x=c.getContext('2d');x.imageSmoothingEnabled=true;x.imageSmoothingQuality='high';x.drawImage(img,0,0,w,h);
    return {c,x:Math.round(o.x*R),y:Math.round(o.y*R),sy:o.sy,fx:o.fx||null,o};}).filter(Boolean);
  sheetsR={};
  for(const k in CHARS){const img=assets[k];if(!img)continue;const m=CHARS[k];
    const cw=Math.round(m.cw*R/K),ch=Math.round(m.ch*R/K);
    const c=mk(cw*m.cols,ch*m.rows),x=c.getContext('2d');x.imageSmoothingEnabled=true;x.imageSmoothingQuality='high';x.drawImage(img,0,0,cw*m.cols,ch*m.rows);
    sheetsR[k]={c,cw,ch,ay:Math.round(m.ay*R/K)};}
  // two tinted duck variants (cream -> tan / grey-brown), made at load so they cost nothing per frame
  if(sheetsR.duck){
    for(const [nm,tint] of [['duck2','#c9a06a'],['duck3','#aab4c0']]){
      const b=sheetsR.duck,c=mk(b.c.width,b.c.height),x=c.getContext('2d');
      x.drawImage(b.c,0,0);x.globalCompositeOperation='multiply';x.fillStyle=tint;x.fillRect(0,0,c.width,c.height);
      x.globalCompositeOperation='destination-in';x.drawImage(b.c,0,0);
      sheetsR[nm]={c,cw:b.cw,ch:b.ch,ay:b.ay};}
  }
  // enchanted broom: flipped and rotated upright (bristles down) once per resolution; tx,ty = bristle tip from the canvas centre
  if(assets.broom){const im=assets.broom,pk=PK.broom,sc=.78,w=Math.round(im.width/pk*R*sc),h=Math.round(im.height/pk*R*sc);
    const d=Math.ceil(Math.hypot(w,h)),c=mk(d,d),x=c.getContext('2d');x.imageSmoothingQuality='high';
    x.translate(d/2,d/2);x.rotate(Math.PI/4);x.scale(1,-1);x.drawImage(im,-w/2,-h/2,w,h);
    broomUpR={c,d,tx:(w-h)/2*.7071,ty:(w+h)/2*.7071};}
}
function glowSpr(col){ // soft radial glow sprite (cached per colour)
  if(glowCache[col])return glowCache[col];
  const c=mk(64,64),x=c.getContext('2d'),g=x.createRadialGradient(32,32,0,32,32,32);
  g.addColorStop(0,'rgba('+col+',1)');g.addColorStop(.25,'rgba('+col+',.55)');g.addColorStop(.6,'rgba('+col+',.14)');g.addColorStop(1,'rgba('+col+',0)');
  x.fillStyle=g;x.fillRect(0,0,64,64);return glowCache[col]=c;
}
const holeSpr=(()=>{const c=mk(64,64),x=c.getContext('2d'),g=x.createRadialGradient(32,32,0,32,32,32);
  g.addColorStop(0,'rgba(255,255,255,1)');g.addColorStop(.35,'rgba(255,255,255,.7)');g.addColorStop(.7,'rgba(255,255,255,.22)');g.addColorStop(1,'rgba(255,255,255,0)');
  x.fillStyle=g;x.fillRect(0,0,64,64);return c;})();
function glow(x,y,r,col,a){ctx.globalAlpha=Math.max(0,Math.min(1,a));ctx.drawImage(glowSpr(col),(x-r)*R,(y-r)*R,2*r*R,2*r*R);}

// ---------- state ----------
const chars=[];     // everything that is drawn with depth sorting
const villagers=[];
let queue=[];       // customers at the stall, index 0 = at counter
let wellBusy=null,juniper=null,merrick=null,rosie=null,theo=null,mabel=null,finn=null,cat=null,dog=null,dragon=null,frog=null;
const particles=[];
const floaters=[]; // floating text {text,x,y,vy,life,max,c}
const bubbles=[];  // speech bubbles {o,text,life}
const sweepers=[],fairies=[],wisps=[],lanterns=[];
const ITEMS={apple:['#d83a2e','#7a1d16'],carrot:['#f08a24','#7a4a12'],pumpkin:['#f2a233','#9a5a14'],cabbage:['#8fcf5b','#3f7a2c'],bucket:['#7a5230','#4aa8e0'],
  potion:['#e85cc0','#7a2a66'],potionB:['#4aa8f0','#1f4a80'],potionG:['#6fe07a','#2a7a38'],crystal:['#b79cff','#5b3fa8'],scroll:['#f1e0b0','#a07a3a']};
const MAGIC=['#ffe27a','#8fe8ff','#ff9de0','#c7a4ff','#9dffc4'];
let tAcc=0;
let hourNow=0,tint=[255,255,255],nightK=0,hourT=0; // day/night state (updated each frame)

// ---------- particles / effects ----------
function spark(x,y,c,o){o=o||{};if(particles.length>520)return;
  const life=o.life||rr(.6,1.2);
  particles.push({k:'spark',x,y,vx:o.vx!==undefined?o.vx:rr(-12,12),vy:o.vy!==undefined?o.vy:rr(-24,-6),ay:o.ay!==undefined?o.ay:12,life,max:life,c:c||pick(MAGIC),s:o.s||1,add:true,ph:rnd()*6.28,gl:o.gl||0});}
function burst(x,y,n,o){o=o||{};for(let i=0;i<n;i++){const a=rnd()*6.283,v=rr(o.v0||10,o.v1||34);spark(x,y,o.c||pick(MAGIC),{vx:Math.cos(a)*v,vy:Math.sin(a)*v*.8-(o.up||8),ay:o.ay!==undefined?o.ay:18,life:rr(.5,1.3),s:o.s||1,gl:o.gl});}}
function puff(x,y,c,n){for(let i=0;i<n;i++)if(particles.length<520){const life=rr(.7,1.2);particles.push({k:'puff',x:x+rr(-2,2),y,vx:rr(-8,8),vy:rr(-16,-4),ay:-4,life,max:life,c,s:rr(1.6,3.2),add:false,ph:0});}}
function floatText(text,x,y,c){floaters.push({text,x,y,vy:-9,life:2.1,max:2.1,c:c||'#fff6c8'});}
function say(o,text,life){for(let i=bubbles.length-1;i>=0;i--)if(bubbles[i].o===o)bubbles.splice(i,1);bubbles.push({o,text,life:life||4.2,max:life||4.2});}

// ---------- characters ----------
function mkVillager(id,name,role,speed,start,opt){
  const p=N[start];
  const v={id,name,role,kind:'villager',sheet:id,x:p[0],y:p[1],dir:'down',flip:false,state:'idle',timer:rr(.5,3),route:[],speed,spd0:speed,
    animT:0,alpha:1,item:null,itemT:0,act:'out and about',node:start,opt,sy:0,squash:1,last:null,lookT:rr(2,5),h:opt.h||28,stride:opt.stride||4,shadowW:opt.sw||7.6};
  villagers.push(v);chars.push(v);return v;
}
function setRoute(v,names,extra){
  v.route=names.map(n=>N[n].slice());if(extra)for(const e of extra)v.route.push(e.slice());
  v.state='walk';
}
function goTo(v,target,extra){ // from the node v is standing at (or walking in from off-node) to a graph node (+ optional extra points)
  const far=dist([v.x,v.y],N[v.node])>3;
  const names=route(v.node,target);
  const from=far?0:(names.length>1?1:0);
  if(names.length>1||extra||far){setRoute(v,names.slice(from),extra);}
  v.destNode=target;
}
function freeRing(v){
  const taken=new Set(villagers.filter(o=>o!==v&&o.ringNode).map(o=>o.ringNode));
  const c=RING.filter(n=>!taken.has(n));return pick(c.length?c:RING);
}
const STROLL_NODES=Object.keys(N).filter(k=>!['JB','MA','MB'].includes(k));
function castPose(v,kind,t){v.state='cast';v.phase='cast';v.timer=t;v.castT=0;v.flashed=false;v.dir='down';v.castKind=kind;v.act='casting '+({stars:'a sparkle spell',ring:'a ring of light',petals:'a shower of petals'}[kind]);}
function chooseActivity(v){
  v.ringNode=null;
  const w=v.opt.w,keys=Object.keys(w);
  const ok=k=>{
    if(k==='stall')return juniper&&juniper.state==='post'&&queue.length<3&&!v.item;
    if(k==='well')return !wellBusy;
    return true;};
  const cand=keys.filter(ok);let r=rnd()*cand.reduce((s,k)=>s+w[k],0);
  let act=cand[0];for(const k of cand){r-=w[k];if(r<=0){act=k;break;}}
  if(act==='house'){
    const d=pick(DOORS.filter(x=>x!==v.last));v.last=d;v.targetDoor=d;v.phase='toDoor';
    v.act='heading to '+DOORNAME[d];goTo(v,d);
  }else if(act==='tower'){
    v.last='TD';v.targetDoor='TD';v.phase='toDoor';v.act='heading back to the tower';goTo(v,'TD');
  }else if(act==='stall'){
    v.phase='toQueue';v.act='browsing the magic shop';
    const qi=queue.length;queue.push(v);v.qi=qi;
    const names=route(v.node,'E');setRoute(v,names.slice(names.length>1?1:0),[SLOTS[qi]]);v.node='E';
  }else if(act==='well'){
    v.phase='toWell';v.act='going to the well';wellBusy=v;goTo(v,'WELL');
  }else if(act==='plaza'){
    const n=freeRing(v);v.ringNode=n;v.phase='toPlaza';v.act='enjoying the glowing fountain';goTo(v,n);
  }else if(act==='tend'){v.phase='toMush';v.act='going to the glowing mushrooms';goTo(v,pick(['MA','MB']));}
  else if(act==='brew'){const n=freeRing(v);v.ringNode=n;v.phase='toBrew';v.act='looking for a spot to brew';goTo(v,n);}
  else if(act==='cast'){castPose(v,pick(['stars','ring','petals']),rr(3,4.2));v.dir=rnd()<.5?'down':'side';v.flip=rnd()<.5;}
  else if(act==='portal'){v.phase='toPortal';v.act='off to study the portal stone';goTo(v,'PT');}
  else if(act==='fly'){startFly(v);}
  else if(act==='practice'){v.state='practice';v.timer=rr(6,9);v.dir=rnd()<.5?'down':'side';v.flip=rnd()<.5;v.pT=0;v.pN=0;v.act='practising sparks';v.misfire=rnd()<.4;v.mis=false;}
  else{ // stroll: two random nodes
    v.phase='stroll';v.act='out for a stroll';v.strollN=pick(STROLL_NODES.filter(k=>k!==v.node));goTo(v,v.strollN);
  }
}
function retargetQueue(){
  queue.forEach((c,i)=>{if(c.qi!==i){c.qi=i;
    if(c.state==='queue'||c.state==='walk'&&c.phase==='toQueue'){c.route=[SLOTS[i].slice()];c.state='walk';}}});
}
function dropFromQueue(v){const i=queue.indexOf(v);if(i>=0){queue.splice(i,1);retargetQueue();}}
function arrive(v){ // end of a route
  const ph=v.phase;
  if(ph==='toDoor'){v.state='enter';v.timer=.55;v.dir='up';v.flip=false;v.node=v.targetDoor;}
  else if(ph==='toQueue'){v.state='queue';v.dir='side';v.flip=true;v.timer=0;}
  else if(ph==='toWell'){v.state='pump';v.timer=rr(4,6);v.dir='up';v.flip=false;v.node='WELL';v.act='drawing water at the well';v.pumpT=0;v.splashT=0;}
  else if(ph==='toPlaza'){v.state='idle';v.timer=rr(5,11);v.dir='down';v.node=v.destNode;v.act='enjoying the glowing fountain';v.lookT=rr(1.5,3.5);}
  else if(ph==='toBrew'){v.node=v.destNode;v.state='brew';v.timer=rr(5,7);v.dir='down';v.act='brewing a bubbly potion';v.bT=0;}
  else if(ph==='toMush'){v.node=v.destNode;v.state='tend';v.timer=rr(6,10);v.dir='side';v.flip=v.destNode==='MB';v.act='tending the glowing mushrooms';v.tT=0;}
  else if(ph==='toPortal'){v.node='PT';v.state='inspect';v.timer=rr(7,10);v.dir='up';v.flip=false;v.act='studying the portal stone';v.iT=0;portal.want=true;}
  else if(ph==='stroll'){v.node=v.destNode;if(rnd()<.4){v.strollN=pick(STROLL_NODES.filter(k=>k!==v.node));goTo(v,v.strollN);}else{v.state='idle';v.timer=rr(1.5,4);v.dir='down';}}
  else {v.state='idle';v.timer=rr(1,3);v.dir='down';}
}
function tipOf(v){ // wand/staff tip in world coords
  const T=TIPS[v.id];if(!T)return [v.x,v.y-v.h*.6];
  const t=T[v.dir]||T.down;const fl=(v.dir==='side'&&v.flip)?-1:1;
  return [v.x+t[0]*fl,v.y+t[1]];
}
function startFly(v){ // Mabel hops onto her broom and flies to a random spot on a path
  const cand=[];
  for(const [a,b] of EDGES){if(HIDDEN.has(a+'-'+b)||['JB','TD','PT'].includes(a)||['JB','TD','PT'].includes(b))continue;
    for(let i=0;i<4;i++){const t=rnd(),p=[lerp(N[a][0],N[b][0],t),lerp(N[a][1],N[b][1],t)];const d=Math.hypot(p[0]-v.x,p[1]-v.y);if(d>45&&d<130&&!blocked(p[0],p[1],0,1))cand.push([p,t<.5?a:b]);}}
  if(!cand.length){v.state='idle';v.timer=1;return;}
  const [p,n]=pick(cand);
  v.state='fly';v.fly={x0:v.x,y0:v.y,x1:p[0],y1:p[1],t:0,dur:Math.max(1.8,dist([v.x,v.y],p)/38),n};
  v.flip=p[0]>v.x;v.act='whizzing about on her broom';v.alpha=1;v.dir='side';v.lift=0;
}
function updateVillager(v,dt){
  v.speed=v.spd0;
  switch(v.state){
    case 'idle':
      v.timer-=dt;v.lookT-=dt;
      if(v.lookT<=0){v.lookT=rr(2,5);if(rnd()<.5){v.dir='side';v.flip=rnd()<.5;}else{v.dir='down';}}
      if(v.timer<=0){chooseActivity(v);}
      break;
    case 'walk':{
      const t=v.route[0];if(!t){arrive(v);break;}
      let dx=t[0]-v.x,dy=t[1]-v.y;const d=Math.hypot(dx,dy),st=v.speed*dt;
      if(d<=st){v.x=t[0];v.y=t[1];v.route.shift();if(!v.route.length){arrive(v);}}
      else{v.x+=dx/d*st;v.y+=dy/d*st;
        // direction with hysteresis so diagonals don't flicker
        const ax=Math.abs(dx),ay=Math.abs(dy);
        if(v.dir==='side'){ if(ay>ax*1.6)v.dir=dy>0?'down':'up'; else v.flip=dx>0; }
        else{ if(ax>ay*1.6){v.dir='side';v.flip=dx>0;} else v.dir=dy>0?'down':'up'; }
        v.animT+=st/v.stride;}
      break;}
    case 'enter':
      v.timer-=dt;v.alpha=Math.max(0,v.timer/.55);v.y-=dt*4;
      if(v.timer<=0){v.state='inside';v.timer=v.id==='finn'?rr(4,8):rr(6,14);v.alpha=0;v.act='indoors';
        const p=N[v.targetDoor];v.x=p[0];v.y=p[1];}
      break;
    case 'inside':
      v.timer-=dt;
      if(v.timer<=0){v.state='exit';v.timer=.55;v.dir='down';v.flip=false;v.y=N[v.targetDoor][1]-2;}
      break;
    case 'exit':
      v.timer-=dt;v.alpha=1-Math.max(0,v.timer/.55);v.y+=dt*3.6;
      if(v.timer<=0){v.alpha=1;v.state='idle';v.timer=rr(.8,2);v.item=null;v.node=v.targetDoor;v.act='out and about';}
      break;
    case 'queue':
      v.dir='side';v.flip=true;
      if(v.qi===0&&juniper.state==='post'&&!juniper.serving&&!villagers.some(o=>o!==v&&o.alpha>0&&Math.hypot(o.x-SLOTS[0][0],o.y-SLOTS[0][1])<6)){juniper.serving=v;v.state='buy';v.timer=2.4;v.act='buying something magical';}
      break;
    case 'buy':
      v.timer-=dt;v.dir='side';v.flip=true;
      if(v.timer<=0){
        v.item=pick(['potion','potionB','potionG','crystal','scroll']);v.itemT=rr(20,32);juniper.serving=null;
        dropFromQueue(v);v.state='idle';v.timer=.4;v.dir='down';v.node='E';v.act='heading off with a treasure';
        for(let i=0;i<5;i++)spark(SLOTS[0][0]+rr(-3,3),SLOTS[0][1]-12,pick(['#ffe27a','#fff6c8']),{vx:rr(-8,8),vy:rr(-28,-14),ay:50,life:.7});
      }
      break;
    case 'pump':{
      v.timer-=dt;v.pumpT+=dt;v.splashT-=dt;v.dir='up';
      v.squash=1-.07*(.5+.5*Math.sin(v.pumpT*7));
      if(v.splashT<=0&&v.pumpT>1.2){v.splashT=.35;const wx=165,wy=192;
        for(let i=0;i<5;i++)particles.push({k:'drop',x:wx+rr(-3,3),y:wy,vx:rr(-9,9),vy:rr(-24,-10),ay:90,life:.55,max:.55});}
      if(v.timer<=0){v.squash=1;v.item='bucket';v.itemT=rr(12,20);wellBusy=null;v.state='idle';v.timer=.8;v.dir='down';v.act='carrying water';if(rnd()<.22)wellWish();}
      break;}
    case 'cast':{ // Merrick: sparkle spells
      v.timer-=dt;v.castT+=dt;const tp=tipOf(v);
      if(v.castKind==='stars'){if(rnd()<dt*26)spark(tp[0],tp[1],pick(MAGIC),{vx:rr(-26,26),vy:rr(-38,-8),ay:14,life:rr(.7,1.3),gl:1});}
      else if(v.castKind==='ring'){const rad=Math.min(26,v.castT*13);for(let i=0;i<2;i++){const a=rnd()*6.283;spark(v.x+Math.cos(a)*rad,v.y-1+Math.sin(a)*rad*.45,pick(MAGIC),{vx:0,vy:rr(-14,-5),ay:-2,life:rr(.6,1),gl:1});}if(rnd()<dt*14)spark(tp[0],tp[1],'#ffffff',{vx:rr(-6,6),vy:rr(-14,-4),life:.5});}
      else{if(rnd()<dt*20){const px=v.x+rr(-22,22),py=v.y-rr(40,56);spark(px,py,pick(['#ffb7d5','#ffd1e6','#fff0f6','#ffe08a']),{vx:rr(-5,5),vy:rr(14,24),ay:2,life:rr(1.2,2),s:1.2});}}
      if(v.castT>.7&&!v.flashed){v.flashed=true;burst(tp[0],tp[1],18,{c:pick(MAGIC),v0:8,v1:30,gl:1});}
      if(v.timer<=0){v.flashed=false;v.state='idle';v.timer=rr(1,2.5);v.dir='down';v.act='out and about';}
      break;}
    case 'practice':{ // Finn: practice sparks, sometimes misfire
      v.timer-=dt;v.pT+=dt;
      if(!v.mis){
        if(v.pT>(v.pN+1)*1.05&&v.pN<4){v.pN++;const tp=tipOf(v);
          if(v.misfire&&v.pN===3){v.mis=true;v.misT=1.5;v.act='oops! misfired';puff(tp[0],tp[1]-2,'#3a3a44',9);puff(tp[0],tp[1]-2,'#7a7a8a',5);burst(tp[0],tp[1],10,{c:'#ff7a5a',v0:10,v1:40});floatText('Oops!',v.x,v.y-v.h-4,'#ffd0c0');v.soot=2.4;v.timer=Math.max(v.timer,2.2);}
          else burst(tp[0],tp[1],8,{c:pick(MAGIC),v0:6,v1:20,gl:1});}
        else if(rnd()<dt*8){const tp=tipOf(v);spark(tp[0],tp[1],'#fff2a0',{vx:rr(-6,6),vy:rr(-18,-6),life:.5});}
      }else{v.misT-=dt;if(rnd()<dt*18){const q=tipOf(v);puff(q[0],q[1]-4,'#55555f',1);}if(v.misT<=0)v.mis=false;}
      if(v.timer<=0){if(!v.misfire){const tp=tipOf(v);burst(tp[0],tp[1]-6,26,{c:pick(MAGIC),v0:10,v1:36,gl:1});floatText('Ta-da!',v.x,v.y-v.h-4,'#fff6c8');}v.mis=false;v.state='idle';v.timer=rr(1,2.5);v.dir='down';v.act='out and about';}
      break;}
    case 'brew':{ // Rosie: bubbling potion
      v.timer-=dt;v.bT+=dt;
      if(rnd()<dt*9){const col=pick(['#ff8fd6','#8fe0ff','#9dffb0','#d4a8ff']);spark(v.x+rr(-6,6),v.y-rr(8,14),col,{vx:rr(-3,3),vy:rr(-14,-7),ay:-2,life:rr(.9,1.5),s:1.4,gl:1});}
      if(v.timer<=0){v.item=pick(['potion','potionB','potionG']);v.itemT=rr(15,26);burst(v.x,v.y-14,12,{c:pick(MAGIC),gl:1,v0:6,v1:22});v.state='idle';v.timer=rr(.8,2);v.dir='down';v.act='proudly holding a fresh potion';}
      break;}
    case 'tend':{ // Theo: glowing mushrooms
      v.timer-=dt;v.tT+=dt;
      if(rnd()<dt*7){const o=v.destNode==='MA'?item('mushrooms'):item('m2');spark(o.x+10+rr(-8,8),o.y+13-rr(0,14),pick(['#7affd0','#b49cff','#8fe8ff']),{vx:rr(-2,2),vy:rr(-12,-5),ay:-1,life:rr(1,1.8),s:1});}
      if(v.timer<=0){v.state='idle';v.timer=rr(.8,2);v.dir='down';v.act='out and about';v.item=null;}
      break;}
    case 'inspect':{ // Merrick at the portal
      v.timer-=dt;v.iT+=dt;
      if(v.timer<=0){v.state='idle';v.timer=rr(1,2.5);v.dir='down';v.act='out and about';portal.want=false;}
      break;}
    case 'fly':{
      const f=v.fly;f.t+=dt;const u=clamp(f.t/f.dur,0,1);
      const e=u*u*(3-2*u);v.x=lerp(f.x0,f.x1,e);v.y=lerp(f.y0,f.y1,e);
      v.lift=11*clamp(Math.min(u*5,(1-u)*5),0,1);
      if(rnd()<dt*30)spark(v.x+(v.flip?-14:14),v.y-v.lift-2,pick(['#e0b0ff','#ffe27a','#ffffff']),{vx:rr(-5,5)+(v.flip?-14:14),vy:rr(-4,6),ay:20,life:rr(.5,.9),gl:1});
      v.dir='side';
      if(u>=1){v.lift=0;v.node=f.n;v.x=f.x1;v.y=f.y1;v.state='idle';v.timer=rr(.8,2);v.dir='down';v.act='straightening her hat';burst(v.x,v.y-4,8,{c:'#e0b0ff',v0:6,v1:18});}
      break;}
  }
  if(v.soot>0)v.soot-=dt;
  if(v.item){v.itemT-=dt;if(v.itemT<=0&&v.state!=='inside')v.item=null;}
}

// ---------- Juniper (shopkeeper) ----------
function updateJuniper(v,dt){
  v.speed=v.spd0;
  if(v.state==='post'){
    v.x=N.JB[0];v.y=N.JB[1];if(v.serving){v.dir='side';v.flip=false;}else{v.dir=(Math.floor(tAcc/4)%3===2)?'side':'down';v.flip=false;}v.act=v.serving?'serving a customer':'minding the magic shop';
    v.breakT-=dt;
    if(v.breakT<=0&&!v.serving&&queue.length===0){
      v.state='walk';v.phase='break';v.node='JB';v.act='taking a short break';
      v.route=[N.E.slice(),N[v.breakNode=pick(['N3','E','S','W'])].slice()];
    }
  }else if(v.state==='walk'){
    const t=v.route[0];
    if(!t){
      if(v.phase==='break'){v.state='rest';v.timer=rr(5,9);v.dir='down';v.act='stretching her legs';}
      else{v.state='post';v.breakT=rr(70,130);}
      return;}
    const dx=t[0]-v.x,dy=t[1]-v.y,d=Math.hypot(dx,dy),st=v.speed*dt;
    if(d<=st){v.x=t[0];v.y=t[1];v.route.shift();}
    else{v.x+=dx/d*st;v.y+=dy/d*st;const ax=Math.abs(dx),ay=Math.abs(dy);
      if(v.dir==='side'){if(ay>ax*1.6)v.dir=dy>0?'down':'up';else v.flip=dx>0;}else{if(ax>ay*1.6){v.dir='side';v.flip=dx>0;}else v.dir=dy>0?'down':'up';}
      v.animT+=st/v.stride;}
  }else if(v.state==='rest'){
    v.timer-=dt;
    if(v.timer<=0){v.state='walk';v.phase='return';v.route=[N.E.slice(),N.JB.slice()];v.act='heading back to the shop';}
  }
}

// ---------- animals (cat, dog, baby dragon) ----------
const ANIMAL={cat:{name:'Biscuit',role:'village cat',speed:17,h:14,sw:6,stride:3.2},dog:{name:'Pepper',role:'village dog',speed:23,h:15.5,sw:7,stride:3.4},
  dragon:{name:'Ember',role:'baby dragon',speed:21,h:17,sw:7.5,stride:3.2}};
function mkAnimal(kind,x,y){
  const A=ANIMAL[kind];
  const a={kind,sheet:kind,x,y,dir:'down',flip:false,state:'idle',timer:rr(1,4),tx:x,ty:y,speed:A.speed,animT:0,alpha:1,follow:null,followT:0,sy:0,name:A.name,role:A.role,act:'wandering',squash:1,h:A.h,shadowW:A.sw,stride:A.stride,lift:0,hoverT:0};
  chars.push(a);return a;
}
function pickWanderPoint(a){
  for(let i=0;i<30;i++){const x=rr(14,466),y=rr(150,310);
    if(!blocked(x,y,6,1)&&dist([x,y],[a.x,a.y])<130&&segClear([a.x,a.y],[x,y],3,1)){return [x,y];}}
  return [a.x,a.y];
}
function flame(a){ // tiny flame puff from the dragon's mouth
  const fl=a.flip?1:-1;a.flameT=.9;a.state='flame';a.dir='side';a.act='puffing a tiny flame';a.timer=1.5;a.lift=0;
  a.fx=a.x+fl*10;a.fy=a.y-8;a.fdx=fl;
}
function updateAnimal(a,dt){
  if(a.state==='idle'||a.state==='sit'||a.state==='sleep'){
    a.timer-=dt;
    if(a.kind==='dragon'&&a.state==='sleep'&&rnd()<dt*1.2)puff(a.x+(a.flip?5:-5),a.y-9,'rgba(210,210,220,.5)',1);
    if(a.timer<=0){
      const r=rnd();
      if(a.state==='sleep'&&r<.6){a.state='sit';a.timer=rr(2,4);a.act='waking up';}
      else if(r<.3&&a.state==='idle'){a.state='sleep';a.timer=rr(8,18);a.act='napping';}
      else if(a.kind==='dragon'&&r<.42&&a.state!=='sleep'){flame(a);}
      else if(a.kind==='dragon'&&r<.54&&a.state!=='sleep'){const p=pickWanderPoint(a);a.tx=p[0];a.ty=p[1];a.state='hover';a.hoverT=0;a.act='fluttering about';}
      else if(r<.58){a.state='sit';a.timer=rr(3,7);a.act='sitting';}
      else if(r<.82&&villagers.length){ // follow a villager that is out and about
        const c=villagers.filter(v=>v.state==='walk'||v.state==='idle');
        if(c.length){a.follow=pick(c);a.state='follow';a.followT=rr(14,24);a.act='following '+a.follow.name;}
        else a.state='idle';
      }else{const p=pickWanderPoint(a);a.tx=p[0];a.ty=p[1];a.state='walk';a.act='wandering';}
      if(a.state==='idle')a.timer=rr(1,3);
    }
  }else if(a.state==='flame'){
    a.timer-=dt;a.flameT-=dt;
    if(a.flameT>0&&particles.length<500){for(let i=0;i<2;i++)particles.push({k:'flame',x:a.fx+rr(-.5,.5),y:a.fy+rr(-.5,.5),vx:a.fdx*rr(14,30),vy:rr(-9,-1),ay:-8,life:rr(.3,.55),max:.5,add:true,s:rr(1.2,2.2),ph:0});}
    if(a.flameT>0&&rnd()<dt*8)puff(a.fx+a.fdx*8,a.fy-2,'rgba(90,80,80,.55)',1);
    if(a.timer<=0){a.state='sit';a.timer=rr(1.5,3);a.act='sitting';}
  }else if(a.state==='walk'||a.state==='follow'||a.state==='hover'){
    let tx=a.tx,ty=a.ty;
    if(a.state==='follow'){
      a.followT-=dt;const f=a.follow;
      if(a.followT<=0||!f||f.state==='inside'||f.alpha<1||f.state==='fly'){a.state='idle';a.timer=rr(1,3);a.act='wandering';return;}
      const d=dist([a.x,a.y],[f.x,f.y]);
      if(d<22){a.timer=0;a.dir='down';return;}
      tx=f.x+(f.dir==='side'?(f.flip?-17:17):0);ty=f.y+(f.dir==='side'?4:(f.dir==='up'?14:-2));
    }
    const dx=tx-a.x,dy=ty-a.y,d=Math.hypot(dx,dy),sp=a.speed*(a.state==='follow'&&d>60?1.5:1)*(a.state==='hover'?1.7:1),st=sp*dt;
    if(a.state==='hover'){a.hoverT+=dt;a.lift=Math.min(6,a.hoverT*14,d*.5)+Math.sin(a.hoverT*9)*.7;}
    if(d<4&&(a.state==='walk'||a.state==='hover')){a.state=rnd()<.4?'sit':'idle';a.timer=rr(2,6);return;}
    const nx=a.x+dx/d*st,ny=a.y+dy/d*st;
    if(a.state!=='hover'&&blocked(nx,ny,2,1)){ // slide along one axis or give up
      if(!blocked(a.x+dx/d*st,a.y,2,1)){a.x+=dx/d*st;}
      else if(!blocked(a.x,a.y+dy/d*st,2,1)){a.y+=dy/d*st;}
      else{a.state='idle';a.timer=rr(.5,1.5);return;}
    }else{a.x=nx;a.y=ny;}
    const ax=Math.abs(dx),ay=Math.abs(dy);
    if(a.dir==='side'){if(ay>ax*1.8)a.dir=dy>0?'down':'up';else a.flip=dx>0;}else{if(ax>ay*1.8){a.dir='side';a.flip=dx>0;}else a.dir=dy>0?'down':'up';}
    a.animT+=st/a.stride;
  }
  if(a.state!=='hover'&&a.lift>0){a.lift=Math.max(0,a.lift-dt*20);}
}

// ---------- ducks ----------
const ducks=[];
function mkDuck(i,x,y,sheet){
  const d={kind:'duck',sheet,x,y,dir:'side',flip:i%2===0,state:'swim',timer:rr(1,3),tx:x,ty:y,speed:rr(5,8),animT:rr(0,4),alpha:1,sy:0,name:['Pip','Dot','Waddles'][i]||'Duck',role:'pond duck',act:'paddling about',dipT:0,clipWL:4.2,h:12.5};
  ducks.push(d);chars.push(d);return d;
}
function updateDuck(d,dt){
  const PX=251,PY=281,RX=26,RY=10;
  if(d.state==='swim'){
    const dx=d.tx-d.x,dy=d.ty-d.y,dd=Math.hypot(dx,dy);
    if(dd<1.5){d.timer-=dt;
      if(d.timer<=0){
        if(rnd()<.35){d.state='dip';d.dipT=0;d.act='dipping for snacks';}
        else{const a=rnd()*6.283,r=Math.sqrt(rnd());d.tx=PX+Math.cos(a)*RX*r;d.ty=PY+Math.sin(a)*RY*r;d.timer=rr(1,4);d.speed=rr(5,9);}
      }
    }else{const st=d.speed*dt;d.x+=dx/dd*st;d.y+=dy/dd*st;
      if(Math.abs(dx)>1.2)d.flip=dx>0; d.animT+=dt*3;}
    d.animT+=dt*1.5;
  }else{
    d.dipT+=dt;
    if(d.dipT>1.9){d.state='swim';d.timer=rr(1,3);d.act='paddling about';}
  }
}

// ---------- talking frog (on the pond's lily pads) ----------
const PADS=[[223,274],[266,271],[274,289],[228,292]];
const FROG_LINES=["Ribbit. Have you tried turning the pond off and on again?","I was a prince once. The commute was worse.","Please don't kiss me. I've heard how that goes.",
  "Fly of the day: delicious. Ten out of ten.","Merrick calls me a toad. I'm a frog. Words matter.","The water's enchanted. Mostly. Swim at your own risk.",
  "I saw what Finn did. The pond saw everything.","Lily pads: the original comfy chair.","Pip, Dot and Waddles are great roommates. Loud, though.",
  "Toll to cross my pond: one fly or one compliment.","I'd tell you a secret, but the koi gossip.","Hot take: Tuesdays are just short Mondays."];
function mkFrog(){
  const p=PADS[0];
  const f={kind:'frog',sheet:'frog',x:p[0],y:p[1],pad:0,state:'sit',timer:rr(3,6),alpha:1,sy:0,name:'Sir Ribbit',role:'talking frog',act:'sitting on a lily pad',h:11,flip:false,talkT:0,hop:null,blinkT:rr(2,4),lift:0,lineI:(rnd()*FROG_LINES.length)|0};
  chars.push(f);return f;
}
function frogTalk(f){
  if(f.state==='hop')return;
  f.lineI=(f.lineI+1+((rnd()*3)|0))%FROG_LINES.length;
  f.state='talk';f.talkT=4.2;f.act='talking';say(f,FROG_LINES[f.lineI],4.2);
}
function updateFrog(f,dt){
  if(f.state==='sit'){
    f.timer-=dt;f.blinkT-=dt;
    if(f.timer<=0){const np=(f.pad+1+((rnd()*3)|0))%PADS.length;f.hop={x0:f.x,y0:f.y,x1:PADS[np][0],y1:PADS[np][1],t:0,dur:.8,np};f.state='hop';f.act='hopping to another pad';f.flip=PADS[np][0]>f.x;}
  }else if(f.state==='talk'){f.talkT-=dt;if(f.talkT<=0){f.state='sit';f.timer=rr(5,9);f.act='sitting on a lily pad';}}
  else if(f.state==='hop'){
    const h=f.hop;h.t+=dt;const u=clamp(h.t/h.dur,0,1);f.x=lerp(h.x0,h.x1,u);f.y=lerp(h.y0,h.y1,u);f.lift=Math.sin(u*Math.PI)*9;
    if(u>=1){f.pad=h.np;f.lift=0;f.state='sit';f.timer=rr(5,10);f.act='sitting on a lily pad';
      for(let i=0;i<5;i++)particles.push({k:'drop',x:f.x+rr(-4,4),y:f.y-1,vx:rr(-10,10),vy:rr(-18,-8),ay:90,life:.5,max:.5});}
  }
}

// ---------- fairies, wisps, lanterns, sweeping brooms ----------
function fairySpots(){return [[item('flowers').x+11,item('flowers').y+4],[item('mushrooms').x+10,item('mushrooms').y+2],[item('crystals').x+10,item('crystals').y+3],[240,138],[310,70],[160,128],[60,100],[400,230],[250,250],[330,160]];}
function mkFairy(i){const sp=pick(fairySpots());return {row:i,x:sp[0]+rr(-10,10),y:sp[1]+rr(-10,10),tx:sp[0],ty:sp[1],ph:rnd()*9,spd:rr(13,20),t:rr(2,5),col:['255,160,220','150,215,255','255,226,130'][i]};}
function updateFairy(f,dt){
  f.t-=dt;const dx=f.tx-f.x,dy=f.ty-f.y,d=Math.hypot(dx,dy);
  if(f.t<=0||d<3){const sp=pick(fairySpots());f.tx=sp[0]+rr(-14,14);f.ty=sp[1]+rr(-14,10);f.t=rr(4,8);}
  const st=f.spd*dt;if(d>1){f.x+=dx/d*st;f.y+=dy/d*st;}
  f.x+=Math.sin(tAcc*2.2+f.ph)*.12;f.y+=Math.cos(tAcc*1.7+f.ph)*.1;
  if(nightK>.25&&rnd()<dt*7)spark(f.x+rr(-2,2),f.y+4,['#ffc8ee','#c8e8ff','#fff0b0'][f.row],{vx:rr(-3,3),vy:rr(2,8),ay:4,life:rr(.5,1),s:.9});
}
function mkWisp(){return {x:rr(20,460),y:rr(30,300),ph:rnd()*9,sp:rr(.15,.45),r:rr(.7,1.6),col:pick(['110,255,208','196,140,255','150,220,255','255,226,150'])};}
function updateWisp(w,dt){w.x+=Math.cos(tAcc*w.sp+w.ph)*dt*5;w.y+=Math.sin(tAcc*w.sp*1.3+w.ph*1.7)*dt*4;if(w.x<8)w.x=472;if(w.x>472)w.x=8;if(w.y<10)w.y=310;if(w.y>312)w.y=10;}
const LANTERN_ANCHORS=[[150,52,6],[372,66,5],[52,168,7],[428,244,6],[168,106,8],[250,98,6]];
function mkLantern(a){return {x:a[0],y:a[1],ax:a[0],ay:a[1],ar:a[2],ph:rnd()*9,sp:rr(.18,.32)};}

function mkSweeper(ax,ay,bx,by,sp){
  const s={kind:'sweeper',x:ax,y:ay,ax,ay,bx,by,sp,dir:1,pause:rr(0,2),animT:0,alpha:1,sy:0,name:'Enchanted broom',role:'sweeps all by itself',act:'sweeping the path',h:22,shadowW:3.2,swish:0};
  chars.push(s);sweepers.push(s);return s;
}
function updateSweeper(s,dt){
  if(s.pause>0){s.pause-=dt;s.swish+=dt*3;return;}
  const tx=s.dir>0?s.bx:s.ax,ty=s.dir>0?s.by:s.ay;
  const dx=tx-s.x,dy=ty-s.y,d=Math.hypot(dx,dy),st=s.sp*dt;
  s.swish+=dt*9;
  if(d<=st){s.x=tx;s.y=ty;s.dir*=-1;s.pause=rr(.6,2.4);}
  else{s.x+=dx/d*st;s.y+=dy/d*st;}
  if(rnd()<dt*10){const life=rr(.5,.9);particles.push({k:'puff',x:s.x+rr(-3,3)+(s.dir>0?-1:1)*2,y:s.y+rr(-1,1),vx:rr(-6,6),vy:rr(-8,-2),ay:6,life,max:life,c:pick(['rgba(205,176,120,.55)','rgba(170,200,110,.55)']),s:rr(1,1.8),add:false,ph:0});}
}

// ---------- portal stone ----------
const portal={state:'closed',open:0,t:0,next:rr(10,22),want:false,hold:6,hole:[0,0,4.6,10.5]};
function updatePortal(dt){
  const it=item('portal');portal.hole=[it.x+17,it.y+20,4.4,10.4];
  portal.t+=dt;
  if(portal.state==='closed'){portal.open=Math.max(0,portal.open-dt*3);portal.next-=dt;
    if(portal.next<=0||portal.want){portal.state='opening';portal.t=0;portal.hold=portal.want?9:rr(5,8);}}
  else if(portal.state==='opening'){portal.open=Math.min(1,portal.open+dt*1.2);
    if(portal.open>=1){portal.state='open';portal.t=0;burst(portal.hole[0],portal.hole[1],14,{c:'#9fd8ff',v0:8,v1:28,gl:1});}}
  else if(portal.state==='open'){
    if(rnd()<dt*12){const a=rnd()*6.283;spark(portal.hole[0]+Math.cos(a)*3,portal.hole[1]+Math.sin(a)*8,pick(['#9fd8ff','#d9b8ff','#ffffff']),{vx:rr(-8,8),vy:rr(-14,-4),ay:2,life:rr(.8,1.4),gl:1});}
    if(portal.t>portal.hold&&!portal.want){portal.state='closing';portal.t=0;}}
  else if(portal.state==='closing'){portal.open=Math.max(0,portal.open-dt*1.4);if(portal.open<=0){portal.state='closed';portal.next=rr(35,70);}}
}
function portalPulse(){ // 0..1 flicker used by the runes + swirl
  if(portal.state==='closed')return .08*(.5+.5*Math.sin(tAcc*1.3));
  let f=portal.open;
  if(portal.state==='opening')f*=.6+.4*Math.sin(tAcc*38)*Math.sin(tAcc*23);
  return clamp(f,0,1);
}
function drawPortalFx(){
  const o=portal.open;if(o<=.02)return;
  const [hx,hy,rx,ry]=portal.hole;const t=tAcc;
  ctx.save();
  ctx.beginPath();ctx.ellipse(hx*R,hy*R,rx*R,ry*R*o,0,0,6.283);ctx.clip();
  const g=ctx.createRadialGradient(hx*R,hy*R,0,hx*R,hy*R,ry*R);
  g.addColorStop(0,'rgba(240,250,255,'+(.95*o)+')');g.addColorStop(.35,'rgba(130,190,255,'+(.85*o)+')');g.addColorStop(.75,'rgba(120,70,220,'+(.85*o)+')');g.addColorStop(1,'rgba(40,20,110,'+(.9*o)+')');
  ctx.fillStyle=g;ctx.fillRect((hx-rx-2)*R,(hy-ry-2)*R,(rx*2+4)*R,(ry*2+4)*R);
  ctx.globalCompositeOperation='lighter';
  for(let i=0;i<5;i++){ // swirling rings
    const ph=t*1.6+i*1.26;const rr2=((ph%1.6)/1.6);
    ctx.strokeStyle='rgba('+(i%2?'190,150,255':'140,230,255')+','+(.7*(1-rr2)*o)+')';ctx.lineWidth=Math.max(1,R*.7);
    ctx.beginPath();ctx.ellipse(hx*R,hy*R,rx*R*(1-rr2)*.95,ry*R*(1-rr2)*.95,t*.6,0,6.283);ctx.stroke();
  }
  for(let i=0;i<6;i++){const a=t*2.4+i*1.05,r=.3+.55*((t*.5+i*.17)%1);
    ctx.fillStyle='rgba(255,255,255,'+(.8*o)+')';ctx.fillRect((hx+Math.cos(a)*rx*r)*R,(hy+Math.sin(a)*ry*r)*R,Math.max(1,R*.9),Math.max(1,R*.9));}
  ctx.restore();
}

// ---------- fountain and well magic ----------
let fountainT=0,wishT=rr(25,50);
function updateFountain(dt){
  fountainT+=dt;
  const F=item('fountain'),sx=F.x+63,sy=F.y+14;
  if(rnd()<dt*7.5)spark(sx+rr(-1.5,1.5),sy+rr(0,4),MAGIC[((fountainT*1.7)|0)%MAGIC.length],{vx:rr(-6,6),vy:rr(-34,-20),ay:30,life:rr(.7,1.1),gl:1});
  if(rnd()<dt*2.5){const a=rnd()*6.283;spark(sx+Math.cos(a)*30,sy+30+Math.sin(a)*13,pick(['#bff3ff','#e5d4ff']),{vx:0,vy:rr(-12,-6),ay:-1,life:rr(.9,1.5),s:.9});}
}
function wellWish(){
  const w=item('well'),x=w.x+30*w.s,y=w.y+57*w.s;
  burst(x,y,26,{c:pick(['#fff3a8','#ffffff','#ffd86a']),v0:10,v1:44,up:20,ay:26,gl:1});
  for(let i=0;i<10;i++)spark(x+rr(-2,2),y,pick(MAGIC),{vx:rr(-8,8),vy:rr(-60,-36),ay:60,life:rr(.7,1.1),gl:1});
  floatText(pick(['A wish!','Wish granted!','Make a wish…','Ooh, shiny!']),x,y-22,'#fff6c8');
  if(rnd()<.7)particles.push({k:'item',item:pick(['potion','potionB','potionG','crystal','scroll','coin']),x,y,vx:rr(-14,14),vy:-58,ay:130,life:1.6,max:1.6,land:y+8,add:false});
}

// ---------- day / night (America/New_York) ----------
const tzFmt=(()=>{try{return new Intl.DateTimeFormat('en-US',{timeZone:'America/New_York',hour:'numeric',minute:'numeric',second:'numeric',hourCycle:'h23'});}catch(e){return null;}})();
function etHour(){
  if(HOUR_FLAG!==null)return HOUR_FLAG;
  const d=new Date();
  if(tzFmt){const p={};for(const x of tzFmt.formatToParts(d))p[x.type]=+x.value;return (p.hour%24)+p.minute/60+p.second/3600;}
  return d.getHours()+d.getMinutes()/60;
}
const TINT=[[0,[74,88,150]],[5,[76,90,152]],[6,[150,122,170]],[7,[255,200,156]],[8.5,[255,255,255]],[16.5,[255,255,255]],[17.5,[255,216,166]],[18.5,[240,156,136]],[19.5,[132,106,156]],[20.5,[78,92,152]],[24,[74,88,150]]];
function skyTint(h){
  for(let i=1;i<TINT.length;i++){if(h<=TINT[i][0]){const a=TINT[i-1],b=TINT[i],t=(h-a[0])/(b[0]-a[0]);return [lerp(a[1][0],b[1][0],t),lerp(a[1][1],b[1][1],t),lerp(a[1][2],b[1][2],t)];}}
  return TINT[0][1];
}
hourNow=etHour();
function updateTime(dt){
  hourT-=dt;if(hourT<=0){hourT=.5;hourNow=etHour();}
  tint=skyTint(hourNow);
  const lum=.3*tint[0]+.59*tint[1]+.11*tint[2];
  nightK=clamp((250-lum)/(250-98),0,1);
}
const lcv=document.createElement('canvas');lcv.width=W;lcv.height=H;const lctx=lcv.getContext('2d');
function drawNight(){
  if(nightK<.01&&tint[0]>252&&tint[2]>252)return;
  lctx.globalCompositeOperation='source-over';lctx.globalAlpha=1;
  lctx.fillStyle='rgb('+(tint[0]|0)+','+(tint[1]|0)+','+(tint[2]|0)+')';lctx.fillRect(0,0,W,H);
  lctx.globalCompositeOperation='destination-out';
  const hole=(x,y,r,a)=>{lctx.globalAlpha=clamp(a,0,1);lctx.drawImage(holeSpr,x-r,y-r,2*r,2*r);};
  const nk=nightK;
  for(const l of LIGHTS){const k=l.magic?(.22+.78*nk):nk;const fl=l.magic?1:.88+.12*Math.sin(tAcc*7+l.ph);
    let a=k*fl*l.a*.9;if(l.fx==='portal')a=Math.max(a,portalPulse()*.9);hole(l.x,l.y,l.r*1.7,a);}
  for(const c of chars){if(c.kind==='sweeper'||c.alpha<=0)continue;hole(c.x,c.y-c.h*.4,13,nk*.22);}
  for(const l of lanterns)hole(l.x,l.y,20,nk*.8);
  for(const f of fairies)hole(f.x,f.y,16,nk*.8);
  for(const w of wisps)hole(w.x,w.y,10,nk*.6);
  if(merrick&&merrick.alpha>0){const tp=tipOf(merrick);hole(tp[0],tp[1],18,nk*.8);}
  hole(238,150,56,nk*.55);
  lctx.globalAlpha=1;lctx.globalCompositeOperation='source-over';
  ctx.save();ctx.globalCompositeOperation='multiply';ctx.imageSmoothingEnabled=true;ctx.drawImage(lcv,0,0,W*R,H*R);ctx.restore();
}
function drawGlows(){ // additive colour glows (after the night overlay)
  ctx.save();ctx.globalCompositeOperation='lighter';
  const nk=nightK;
  for(const l of LIGHTS){
    const base=l.magic?(.16+.84*nk):nk;if(base<.02&&l.fx!=='portal')continue;
    let a=base*l.a*(l.magic?.7:.62);
    if(!l.magic)a*=.85+.15*Math.sin(tAcc*7+l.ph);
    if(l.magic)a*=.85+.15*Math.sin(tAcc*2.3+l.ph);
    if(l.fx==='portal'){a=.08*nk+portalPulse()*(.8+.2*Math.sin(tAcc*9));}
    if(l.k==='fountain'&&l.r>30){const hue=.5+.5*Math.sin(tAcc*.35);glow(l.x,l.y,l.r*.8,(hue>.5?LCOL.f:LCOL.v),a*.55);continue;}
    glow(l.x,l.y,l.r,l.c,a);
  }
  for(const l of lanterns)glow(l.x,l.y,15,LCOL.o,.15+.55*nk);
  for(const f of fairies){const k=Math.min(1,nk*1.4);if(k>.02)glow(f.x,f.y,13,f.col,.7*k);}
  for(const w of wisps){const k=Math.min(1,nk*1.5);if(k>.02)glow(w.x,w.y,5+w.r*3,w.col,.85*k*(.7+.3*Math.sin(tAcc*3+w.ph)));}
  if(merrick&&merrick.alpha>0){const tp=tipOf(merrick);glow(tp[0],tp[1],9,'120,200,255',.25+.55*nk+(merrick.state==='cast'?.35:0));}
  if(finn&&finn.alpha>0&&finn.state==='practice'){const tp=tipOf(finn);glow(tp[0],tp[1],8,'255,230,140',.7);}
  ctx.restore();ctx.globalAlpha=1;
}

// ---------- drawing ----------
function drawSprite(sheetKey,row,col,x,y,o){
  const sh=sheetsR[sheetKey];if(!sh)return;
  o=o||{};
  const sx=col*sh.cw,sy=row*sh.ch;
  let srcH=sh.ch;
  const squash=o.squash||1;
  if(o.clip){srcH=Math.max(1,Math.round(sh.ay-o.clip*R));}
  const px=Math.round(x*R),py=Math.round(y*R+(o.dy||0)*R);
  const th=Math.round(srcH*squash);
  ctx.save();
  if(o.alpha!==undefined&&o.alpha<1)ctx.globalAlpha=Math.max(0,o.alpha);
  if(o.flip){ctx.translate(px,0);ctx.scale(-1,1);}
  const bx=o.flip?-Math.round(sh.cw/2):px-Math.round(sh.cw/2);
  const top=py-sh.ay-(th-srcH);
  if(o.sway){ // upper body shifts a pixel or two (weight shift) while the legs stay planted
    const split=Math.round(srcH*.52),sw=Math.round(o.sway*R)*(o.flip?-1:1),hi=Math.round(th*split/srcH);
    ctx.drawImage(sh.c,sx,sy,sh.cw,split,bx+sw,top,sh.cw,hi);
    ctx.drawImage(sh.c,sx,sy+split,sh.cw,srcH-split,bx,top+hi,sh.cw,th-hi);
  }else ctx.drawImage(sh.c,sx,sy,sh.cw,srcH,bx,top,sh.cw,th);
  if(o.tint){ctx.filter='brightness(.4) saturate(.6)';ctx.globalAlpha=(o.alpha===undefined?1:o.alpha)*o.tint;
    ctx.drawImage(sh.c,sx,sy,sh.cw,srcH,bx,top,sh.cw,th);ctx.filter='none';}
  ctx.restore();
}
function shadow(x,y,w,a){
  ctx.fillStyle='rgba(30,50,20,'+(a||.22)+')';
  ctx.beginPath();ctx.ellipse(x*R,(y-.5)*R,w*R,w*.4*R,0,0,6.283);ctx.fill();
}
const ROW={down:0,up:1,side:2};
function drawItem(v,x,y){
  const k=v.item;const it=ITEMS[k];if(!it)return;
  let ix,iy;
  if(v.dir==='side'){ix=x+(v.flip?5:-5);iy=y-11;}
  else if(v.dir==='up'){ix=x+7;iy=y-11;}else{ix=x+7.5;iy=y-10;}
  const s=R*1.2,px=Math.round(ix*R),py=Math.round(iy*R);
  if(k==='bucket'){
    ctx.fillStyle=it[0];ctx.fillRect(px-1.8*s,py,3.6*s,2.8*s);ctx.fillStyle=it[1];ctx.fillRect(px-1.4*s,py,2.8*s,1*s);
    ctx.fillStyle='#4a3420';ctx.fillRect(px-2.1*s,py-1.2*s,.7*s,1.4*s);ctx.fillRect(px+1.4*s,py-1.2*s,.7*s,1.4*s);
  }else if(k==='scroll'){
    ctx.fillStyle=it[1];ctx.fillRect(px-2.2*s,py-.4*s,4.4*s,2.2*s);ctx.fillStyle=it[0];ctx.fillRect(px-1.8*s,py,3.6*s,1.5*s);ctx.fillStyle='#c0392b';ctx.fillRect(px-.4*s,py-.5*s,.8*s,2.4*s);
  }else if(k==='crystal'){
    ctx.fillStyle=it[1];ctx.fillRect(px-1.4*s,py-1.4*s,2.8*s,4*s);ctx.fillStyle=it[0];ctx.fillRect(px-.9*s,py-2.2*s,1.8*s,4*s);ctx.fillStyle='rgba(255,255,255,.55)';ctx.fillRect(px-.5*s,py-1.6*s,.6*s,1.6*s);
  }else if(k.startsWith('potion')){
    ctx.fillStyle=it[1];ctx.fillRect(px-1.6*s,py,3.2*s,3.2*s);ctx.fillStyle=it[0];ctx.fillRect(px-1.2*s,py+.4*s,2.4*s,2.4*s);
    ctx.fillStyle='#d8c8a0';ctx.fillRect(px-.5*s,py-1.2*s,1*s,1.4*s);ctx.fillStyle='rgba(255,255,255,.6)';ctx.fillRect(px-.9*s,py+.7*s,.6*s,.9*s);
  }else{
    ctx.fillStyle=it[1];ctx.fillRect(px-2*s,py-.4*s,4*s,3.4*s);ctx.fillStyle=it[0];ctx.fillRect(px-1.5*s,py,3*s,2.6*s);
    ctx.fillStyle='rgba(255,255,255,.55)';ctx.fillRect(px-1*s,py+.3*s,.9*s,.9*s);
    if(k==='apple'||k==='pumpkin'){ctx.fillStyle='#4a7a2a';ctx.fillRect(px,py-1*s,.9*s,.9*s);}
  }
}
function drawChar(c,t){
  if(c.alpha<=0)return;
  switch(c.kind){
    case 'duck':return drawDuck(c,t);
    case 'cat':case 'dog':case 'dragon':return drawAnimal(c,t);
    case 'frog':return drawFrog(c,t);
    case 'sweeper':return drawSweeper(c,t);
  }
  const x=c.x,y=c.y;
  if(c.state==='fly'){
    shadow(x,y,Math.max(2,7-c.lift*.3),.2*c.alpha*(1-c.lift/22));
    const f=Math.floor(t*9)&3;
    drawSprite('mabelfly',0,f,x,y,{flip:c.flip,dy:-c.lift+Math.sin(t*7)*.6,alpha:c.alpha});
    return;
  }
  shadow(x,y,c.shadowW,.2*c.alpha);
  let row=ROW[c.dir]||0,col=0,dy=0,sway=0;
  const walking=c.state==='walk';
  if(walking){const f=Math.floor(c.animT)&3;col=f;dy=(f&1)?-1.1:0;if(c.dir!=='side'&&!(f&1))sway=(f===0?.6:-.6);}
  else{
    if(c.state==='buy'||(c===juniper&&c.serving))dy=-.5*Math.abs(Math.sin(t*5));
    else if(c.state==='cast'&&c.castT>.6&&c.castT<1.1)dy=-1.4;
    else if(c.state==='tend')dy=-.35*Math.abs(Math.sin(t*3));
    else if(c.state==='brew')dy=-.3*Math.abs(Math.sin(t*6));
  }
  let dx=0;
  if(c.state==='practice'&&c.mis)dx=Math.sin(t*50)*.5;
  const breathe=walking?1:1+.012*Math.sin(t*2+c.x);
  drawSprite(c.sheet,row,col,x+dx,y,{flip:c.dir==='side'&&c.flip,alpha:c.alpha,dy,squash:(c.squash||1)*breathe,sway,tint:c.soot>0?Math.min(.65,c.soot*.5):0});
  if(c.item&&c.alpha>0)drawItem(c,x,y+dy);
}
function drawAnimal(a,t){
  const x=a.x,y=a.y;
  const sleeping=a.state==='sleep',sitting=a.state==='sit'||a.state==='flame';
  shadow(x,y,(sleeping?1.35:1)*a.shadowW*(1-a.lift*.04),.2);
  let row,col,flip=false,dy=-a.lift;
  if(sleeping){row=2;col=3;flip=a.flip;}
  else if(sitting){row=2;col=2;flip=a.flip;}
  else{
    const moving=a.state==='walk'||a.state==='hover'||(a.state==='follow'&&dist([a.x,a.y],[a.follow?a.follow.x:0,a.follow?a.follow.y:0])>=22);
    row=ROW[a.dir]||0;
    if(a.state==='hover'){row=0;col=Math.floor(t*10)&3;}
    else if(a.dir==='side'){col=(Math.floor(a.animT)&1);flip=a.flip;}else col=moving?(Math.floor(a.animT)&3):0;
    if(moving&&a.state!=='hover')dy-=(Math.floor(a.animT)&1)?.7:0;
  }
  drawSprite(a.sheet,row,col,x,y,{flip,dy});
}
function drawFrog(f,t){
  shadow(f.x,f.y,5*(1-f.lift*.03),.14);
  let row=0,col=0;
  if(f.state==='talk'){row=1;col=Math.floor(t*7)&3;}
  else if(f.state==='hop'){row=2;const u=f.hop.t/f.hop.dur;col=u<.15?0:u<.55?1:u<.9?2:3;}
  else{row=0;col=f.blinkT<.18?1:(((Math.floor(t*.7+f.x))&7)===0?2:0);if(f.blinkT<=0)f.blinkT=rr(2.2,5);}
  const bob=f.state==='sit'?Math.sin(t*2)*.18:0;
  drawSprite('frog',row,col,f.x,f.y,{dy:-f.lift+bob,flip:f.flip&&f.state==='hop'});
}
function drawSweeper(s,t){
  if(!broomUpR)return;
  shadow(s.x,s.y,s.shadowW,.18);
  const ang=Math.sin(s.swish)*(s.pause>0?.05:.2);
  ctx.save();ctx.translate(Math.round(s.x*R),Math.round((s.y-.5)*R));ctx.rotate(ang);
  const B=broomUpR;ctx.drawImage(B.c,Math.round(-B.d/2-B.tx),Math.round(-B.d/2-B.ty));
  ctx.restore();
}
function drawDuck(d,t){
  const bob=Math.sin(t*2.2+d.x)*.3;
  const x=d.x,y=d.y;
  // ripple rings at the waterline
  ctx.strokeStyle='rgba(235,248,255,.5)';ctx.lineWidth=Math.max(1,R*.6);
  const ph=(t*1.2+d.x)%1;
  ctx.beginPath();ctx.ellipse(x*R,(y-d.clipWL+1)*R,(6.5+ph*3.5)*R,(2.3+ph*1.3)*R,0,0,6.283);ctx.stroke();
  ctx.strokeStyle='rgba(235,248,255,.25)';ctx.beginPath();ctx.ellipse(x*R,(y-d.clipWL+1)*R,(9+ph*3.5)*R,(3.2+ph*1.3)*R,0,0,6.283);ctx.stroke();
  let row=2,col=0,dy=bob;
  const moving=Math.hypot(d.tx-d.x,d.ty-d.y)>1.5;
  if(d.state==='dip'){ // sheet: row 1 = side swim; row 2 cols 0-2 = dip, col 3 = head back up with drips
    const p=d.dipT/1.9;row=2;col=p<.18?0:p<.7?1:p<.86?2:3;dy=0;
  }else{row=1;col=moving?(Math.floor(d.animT*1.2)&3):0;}
  drawSprite(d.sheet,row,col,x,y,{flip:d.flip,dy,clip:d.clipWL});
}
function drawParticles(dt,pass){ // pass 0 = ordinary, 1 = additive
  for(let i=particles.length-1;i>=0;i--){
    const p=particles[i];
    if(pass===0){p.life-=dt;if(p.life<=0){particles.splice(i,1);continue;}p.vy+=p.ay*dt;p.x+=p.vx*dt;p.y+=p.vy*dt;
      if(p.k==='item'&&p.y>=p.land&&p.vy>0){p.vy=0;p.vx=0;p.ay=0;p.y=p.land;if(p.life>.5)p.life=.5;}}
    if(!!p.add!==(pass===1))continue;
    const a=Math.min(1,p.life/p.max*1.6);
    ctx.globalAlpha=a;
    if(p.k==='drop'){ctx.fillStyle='#7fc8f0';ctx.fillRect(Math.round(p.x*R),Math.round(p.y*R),Math.max(1,R),Math.max(1,R*1.4));}
    else if(p.k==='spark'){
      const tw=.65+.35*Math.sin(tAcc*22+p.ph);ctx.globalAlpha=a*tw;
      const s=Math.max(1,Math.round(R*p.s)),px=Math.round(p.x*R),py=Math.round(p.y*R);
      ctx.fillStyle=p.c;ctx.fillRect(px,py,s,s);
      if(p.s>=.9){ctx.fillRect(px-s,py,s,s);ctx.fillRect(px+s,py,s,s);ctx.fillRect(px,py-s,s,s);ctx.fillRect(px,py+s,s,s);}
      if(p.gl&&nightK>.2){ctx.globalAlpha=a*tw*.35*nightK;ctx.drawImage(glowSpr('255,240,200'),px-4*R,py-4*R,8*R,8*R);}
    }else if(p.k==='flame'){
      const u=1-p.life/p.max;ctx.fillStyle=u<.3?'#fff4a8':u<.65?'#ffb040':'#e8542a';
      const s=Math.max(1,Math.round(R*p.s*(1-u*.4)));ctx.fillRect(Math.round(p.x*R),Math.round(p.y*R),s,s);
    }else if(p.k==='puff'){
      ctx.fillStyle=p.c;const s=Math.max(1,Math.round(R*p.s*(1+(1-p.life/p.max))));ctx.fillRect(Math.round(p.x*R-s/2),Math.round(p.y*R-s/2),s,s);
    }else if(p.k==='item'){
      ctx.globalAlpha=Math.min(1,p.life*2);
      if(p.item==='coin'){ctx.fillStyle='#f6d34a';ctx.fillRect(Math.round(p.x*R),Math.round(p.y*R),Math.max(2,R*2),Math.max(2,R*2));}
      else drawItem({item:p.item,dir:'down',flip:false},p.x-7.5,p.y+10);
    }else{ctx.fillStyle='#f6d34a';ctx.fillRect(Math.round(p.x*R),Math.round(p.y*R),Math.max(1,R*1.2),Math.max(1,R*1.2));}
    ctx.globalAlpha=1;
  }
}
function drawDebug(){
  ctx.save();ctx.lineWidth=1;
  ctx.strokeStyle='rgba(255,0,0,.8)';ctx.fillStyle='rgba(255,0,0,.12)';
  for(const o of OBST){ctx.beginPath();if(o.r){ctx.rect(o.r[0]*R,o.r[1]*R,(o.r[2]-o.r[0])*R,(o.r[3]-o.r[1])*R);}else{ctx.ellipse(o.e[0]*R,o.e[1]*R,o.e[2]*R,o.e[3]*R,0,0,6.283);}ctx.fill();ctx.stroke();}
  ctx.strokeStyle='rgba(0,80,255,.9)';
  for(const [a,b] of EDGES){ctx.beginPath();ctx.moveTo(N[a][0]*R,N[a][1]*R);ctx.lineTo(N[b][0]*R,N[b][1]*R);ctx.stroke();}
  ctx.fillStyle='#fff';for(const k in N){ctx.fillRect(N[k][0]*R-2,N[k][1]*R-2,4,4);}
  ctx.fillStyle='#ff0';for(const s of SLOTS)ctx.fillRect(s[0]*R-2,s[1]*R-2,4,4);
  ctx.fillStyle='#0f0';for(const l of LIGHTS)ctx.fillRect(l.x*R-1,l.y*R-1,3,3);
  ctx.restore();
}
// air layer: floating lanterns and fairies (drawn above the night overlay, they are light sources)
function drawAir(t){
  const lan=assets.lantern;
  if(lan){const pk=PK.lantern,w=Math.round(lan.width/pk*R),h=Math.round(lan.height/pk*R);
    for(const l of lanterns)ctx.drawImage(lan,Math.round(l.x*R-w/2),Math.round(l.y*R-h/2),w,h);}
  const fs=sheetsR.fairy;
  if(fs&&nightK>.04){for(const f of fairies){
    ctx.globalAlpha=Math.min(1,nightK*1.5);
    const col=Math.floor(t*10+f.ph)&3;
    const px=Math.round(f.x*R),py=Math.round((f.y+5+Math.sin(t*3+f.ph)*.8)*R);
    ctx.drawImage(fs.c,col*fs.cw,f.row*fs.ch,fs.cw,fs.ch,px-(fs.cw>>1),py-fs.ay,fs.cw,fs.ch);ctx.globalAlpha=1;}}
}
// screen-space overlays: sky chip, speech bubbles, floating text
function toScreen(wx,wy){const k=view.z*R0/R;return [Math.round(W*R0/2-view.cx*R*k)+wx*R*k,Math.round(H*R0/2-view.cy*R*k)+wy*R*k];}
function bubbleBox(text,sx,sy,fs,max){
  ctx.font='600 '+fs+'px system-ui,sans-serif';
  const words=text.split(' '),lines=[];let cur='';
  for(const w of words){const t=cur?cur+' '+w:w;if(ctx.measureText(t).width>max&&cur){lines.push(cur);cur=w;}else cur=t;}
  lines.push(cur);
  const lw=Math.max(...lines.map(l=>ctx.measureText(l).width)),pad=fs*.55,lh=fs*1.25,bw=lw+pad*2,bh=lines.length*lh+pad*1.4;
  const bx=clamp(sx-bw/2,fs*.4,cv.width-bw-fs*.4),by=Math.max(fs*.4,sy-bh-fs*.9);
  return {lines,bx,by,bw,bh,pad,lh};
}
function rrect(x,y,w,h,r){ctx.beginPath();ctx.moveTo(x+r,y);ctx.arcTo(x+w,y,x+w,y+h,r);ctx.arcTo(x+w,y+h,x,y+h,r);ctx.arcTo(x,y+h,x,y,r);ctx.arcTo(x,y,x+w,y,r);ctx.closePath();}
function drawScreen(dt){
  const bpc=cv.width/Math.max(1,cv.clientWidth); // backing px per css px
  const fs=12*bpc;
  for(let i=floaters.length-1;i>=0;i--){const f=floaters[i];f.life-=dt;if(f.life<=0){floaters.splice(i,1);continue;}f.y+=f.vy*dt;f.vy*=.985;
    const [sx,sy]=toScreen(f.x,f.y);ctx.globalAlpha=Math.min(1,f.life/f.max*2);
    ctx.font='700 '+(13*bpc)+'px system-ui,sans-serif';ctx.textAlign='center';ctx.lineWidth=3*bpc;ctx.strokeStyle='rgba(40,20,80,.85)';ctx.strokeText(f.text,sx,sy);ctx.fillStyle=f.c;ctx.fillText(f.text,sx,sy);ctx.globalAlpha=1;ctx.textAlign='left';}
  for(let i=bubbles.length-1;i>=0;i--){const b=bubbles[i];b.life-=dt;if(b.life<=0){bubbles.splice(i,1);continue;}
    const [sx,sy]=toScreen(b.o.x,b.o.y-(b.o.lift||0)-b.o.h-1);
    const bx=bubbleBox(b.text,sx,sy,fs,cv.width*.34);ctx.globalAlpha=Math.min(1,b.life*3);
    ctx.fillStyle='rgba(255,252,238,.97)';ctx.strokeStyle='#5a3d7a';ctx.lineWidth=1.5*bpc;rrect(bx.bx,bx.by,bx.bw,bx.bh,fs*.6);ctx.fill();ctx.stroke();
    const tx=clamp(sx,bx.bx+fs,bx.bx+bx.bw-fs);
    ctx.beginPath();ctx.moveTo(tx-fs*.4,bx.by+bx.bh);ctx.lineTo(sx,bx.by+bx.bh+fs*.7);ctx.lineTo(tx+fs*.4,bx.by+bx.bh);ctx.closePath();ctx.fill();ctx.stroke();
    ctx.fillStyle='rgba(255,252,238,1)';ctx.fillRect(tx-fs*.38,bx.by+bx.bh-1.5*bpc,fs*.76,3*bpc);
    ctx.fillStyle='#3a2a52';ctx.textBaseline='top';bx.lines.forEach((l,j)=>ctx.fillText(l,bx.bx+bx.pad,bx.by+bx.pad*.7+j*bx.lh));ctx.textBaseline='alphabetic';ctx.globalAlpha=1;}
  drawSkyChip(bpc);
}
function drawSkyChip(bpc){
  const w=74*bpc,h=32*bpc,x=8*bpc,y=8*bpc,h24=hourNow;
  ctx.save();rrect(x,y,w,h,7*bpc);ctx.clip();
  const g=ctx.createLinearGradient(0,y,0,y+h),day=1-nightK;
  const top=[lerp(18,92,day)|0,lerp(24,170,day)|0,lerp(60,236,day)|0],bot=[lerp(40,170,day)|0,lerp(36,214,day)|0,lerp(90,255,day)|0];
  g.addColorStop(0,'rgb('+top+')');g.addColorStop(1,'rgb('+bot+')');ctx.fillStyle=g;ctx.fillRect(x,y,w,h);
  if(nightK>.1){ctx.fillStyle='#fff';for(let i=0;i<9;i++){const sx=x+((i*37+11)%70)*bpc,sy=y+((i*53+7)%22)*bpc;ctx.globalAlpha=nightK*(.4+.6*Math.abs(Math.sin(tAcc*1.7+i*2.1)));ctx.fillRect(sx,sy,Math.max(1,1.4*bpc),Math.max(1,1.4*bpc));}ctx.globalAlpha=1;}
  const isDay=h24>=6&&h24<18;const u=isDay?(h24-6)/12:(((h24-18+24)%24)/12);
  const cx=x+(8+58*u)*bpc,cy=y+(26-Math.sin(Math.PI*u)*19)*bpc,r=5.2*bpc;
  if(isDay){const gl=ctx.createRadialGradient(cx,cy,0,cx,cy,r*2.6);gl.addColorStop(0,'rgba(255,240,170,.9)');gl.addColorStop(1,'rgba(255,240,170,0)');ctx.fillStyle=gl;ctx.fillRect(cx-r*3,cy-r*3,r*6,r*6);ctx.fillStyle='#ffd94a';ctx.beginPath();ctx.arc(cx,cy,r,0,6.283);ctx.fill();}
  else{ctx.fillStyle='#f3f0d8';ctx.beginPath();ctx.arc(cx,cy,r,0,6.283);ctx.fill();ctx.fillStyle='rgb('+top+')';ctx.beginPath();ctx.arc(cx+r*.55,cy-r*.25,r*.9,0,6.283);ctx.fill();}
  ctx.restore();
  ctx.strokeStyle='rgba(255,255,255,.35)';ctx.lineWidth=bpc;rrect(x,y,w,h,7*bpc);ctx.stroke();
}

// ---------- main loop ----------
let last=0,frameN=0;
function applyView(dt){
  const kk=1-Math.exp(-dt*11);
  view.z+=(view.tz-view.z)*kk;view.cx+=(view.tcx-view.cx)*kk;view.cy+=(view.tcy-view.cy)*kk;
  if(Math.abs(view.tz-view.z)<.002)view.z=view.tz;
  if(Math.abs(view.tcx-view.cx)<.05)view.cx=view.tcx;if(Math.abs(view.tcy-view.cy)<.05)view.cy=view.tcy;
  const hw=W/(2*view.z),hh=H/(2*view.z); // clamp so the world always fills the canvas
  view.cx=clamp(view.cx,hw,W-hw);view.cy=clamp(view.cy,hh,H-hh);
  view.tcx=clamp(view.tcx,W/(2*view.tz),W-W/(2*view.tz));view.tcy=clamp(view.tcy,H/(2*view.tz),H-H/(2*view.tz));
  const want=(view.tz>1||view.z>1.001)?R0*2:R0; // hi-res cache while zoomed in, 1:1 once fully zoomed out
  if(want!==R){R=want;rebuild();}
}
function frame(ts){
  requestAnimationFrame(frame);
  if(!groundR)return;
  const t0=window.__perf?performance.now():0;
  const dt=Math.min(.05,(ts-last)/1000||0);last=ts;tAcc+=dt;
  updateTime(dt);applyView(dt);
  for(let i=0;i<TS;i++){
    for(const v of villagers)v===juniper?updateJuniper(v,dt):updateVillager(v,dt);
    updateAnimal(cat,dt);updateAnimal(dog,dt);updateAnimal(dragon,dt);
    for(const d of ducks)updateDuck(d,dt);
    updateFrog(frog,dt);
    for(const s of sweepers)updateSweeper(s,dt);
    updatePortal(dt);updateFountain(dt);
    wishT-=dt;if(wishT<=0){wishT=rr(45,90);wellWish();}
    if(nightK>.02)for(const f of fairies)updateFairy(f,dt);
    for(const w of wisps)updateWisp(w,dt);
    for(const l of lanterns){l.x=l.ax+Math.cos(tAcc*l.sp+l.ph)*l.ar;l.y=l.ay+Math.sin(tAcc*l.sp*1.4+l.ph)*l.ar*.6+Math.sin(tAcc*1.3+l.ph)*.8;}
    if(rnd()<dt*.9){const o=pick([item('crystals'),item('flowers'),item('mushrooms')]); // gentle idle sparkle
      spark(o.x+rr(3,17),o.y+rr(2,16),pick(MAGIC),{vx:rr(-2,2),vy:rr(-8,-3),ay:-1,life:rr(.8,1.4),s:.9});}
  }
  // base transform: world cache px -> canvas px (zoom/pan)
  ctx.setTransform(1,0,0,1,0,0);ctx.fillStyle='#4a8f3b';ctx.fillRect(0,0,cv.width,cv.height);
  const k=view.z*R0/R;
  ctx.setTransform(k,0,0,k,Math.round(W*R0/2-view.cx*R*k),Math.round(H*R0/2-view.cy*R*k));
  ctx.imageSmoothingEnabled=Math.abs(k-1)>.001;
  ctx.globalAlpha=1;ctx.globalCompositeOperation='source-over';
  ctx.drawImage(groundR,0,0);
  for(const c of chars)c.sy=c.y;
  const cs=chars.slice().sort((a,b)=>a.sy-b.sy);
  let ci=0;
  for(const p of propsR){
    while(ci<cs.length&&cs[ci].sy<p.sy){drawChar(cs[ci],tAcc);ci++;}
    ctx.drawImage(p.c,p.x,p.y);
    if(p.fx==='portal')drawPortalFx();
  }
  while(ci<cs.length){drawChar(cs[ci],tAcc);ci++;}
  drawParticles(dt,0);
  drawNight();
  drawGlows();
  drawAir(tAcc);
  ctx.save();ctx.globalCompositeOperation='lighter';drawParticles(dt,1);ctx.restore();
  if(DEBUG)drawDebug();
  ctx.setTransform(1,0,0,1,0,0);
  drawScreen(dt);
  frameN++;
  if(frameN%30===0)updatePanel();
  if(window.__perf)window.__perf.push(performance.now()-t0);
}

// ---------- pointer: tooltip, tap reactions, zoom + pan ----------
const tip=document.getElementById('tip');
function toWorld(e){
  const r=cv.getBoundingClientRect();
  const sx=(e.clientX-r.left)/r.width,sy=(e.clientY-r.top)/r.height; // 0..1 across the canvas
  return [view.cx+(sx-.5)*W/view.z,view.cy+(sy-.5)*H/view.z];
}
function charAt(wx,wy){
  let best=null,bd=1e9;
  for(const c of chars){
    if(c.alpha<=0||c.state==='inside')continue;
    const h=c.h||19;
    const d=Math.hypot(wx-c.x,(wy-(c.y-(c.lift||0)-h/2))*0.85);
    const rad=Math.max(8,h*.5+3);
    if(d<rad&&d<bd){bd=d;best=c;}
  }
  return best;
}
function propAt(wx,wy){ // interactive scenery
  const w=item('well');if(wx>w.x+4&&wx<w.x+58*w.s&&wy>w.y+30&&wy<w.y+88*w.s)return 'well';
  if(Math.hypot((wx-238)/54,(wy-176)/42)<1)return 'fountain';
  const p=item('portal');if(wx>p.x&&wx<p.x+36&&wy>p.y&&wy<p.y+40)return 'portal';
  return null;
}
function showTipFor(e,c){
  if(!c){tip.style.display='none';return;}
  tip.textContent=c.name+' · '+c.role+' — '+c.act;
  tip.style.display='block';
  const sr=document.getElementById('stage').getBoundingClientRect();
  tip.style.left=Math.max(4,Math.min(sr.width-tip.offsetWidth-4,e.clientX-sr.left-tip.offsetWidth/2))+'px';
  tip.style.top=Math.max(4,e.clientY-sr.top-34)+'px';
}
function react(c){ // tap reactions
  if(c===frog)frogTalk(frog);
  else if(c===merrick&&merrick.state!=='inside'&&merrick.state!=='fly'){castPose(merrick,pick(['stars','ring','petals']),3);}
  else if(c===dragon){flame(dragon);}
  else if(c===finn&&(finn.state==='idle')){finn.state='practice';finn.timer=4;finn.pT=0;finn.pN=0;finn.misfire=true;finn.mis=false;finn.act='practising sparks';}
  else if(c===mabel&&mabel.state==='idle'){startFly(mabel);}
}
const ptr={down:false,id:null,sx:0,sy:0,px:0,py:0,moved:false,lastTap:null};
function syncZoomUI(){const b=document.getElementById('zoom');if(b){b.textContent=view.tz>1?'−':'+';b.setAttribute('aria-label',view.tz>1?'Zoom out':'Zoom in');b.title=view.tz>1?'Zoom out (Esc)':'Zoom in';}cv.classList.toggle('zoomed',view.tz>1);}
function zoomAt(wx,wy,z){view.tz=z;view.tcx=wx;view.tcy=wy;if(z>1&&R<R0*2){R=R0*2;rebuild();}syncZoomUI();}
function zoomOut(){view.tz=1;view.tcx=W/2;view.tcy=H/2;syncZoomUI();}
function onTap(e){
  const [wx,wy]=toWorld(e);
  const now=performance.now(),lt=ptr.lastTap,wasZoomed=view.tz>1;
  const dbl=lt&&now-lt.t<360&&Math.hypot(e.clientX-lt.x,e.clientY-lt.y)<34&&lt.zoomed;
  ptr.lastTap={t:now,x:e.clientX,y:e.clientY,zoomed:wasZoomed};
  if(dbl){zoomOut();tip.style.display='none';return;}
  const c=charAt(wx,wy);
  if(c){showTipFor(e,c);clearTimeout(showTipFor.t);showTipFor.t=setTimeout(()=>tip.style.display='none',2600);react(c);return;}
  const p=propAt(wx,wy);
  if(p==='well'){wellWish();return;}
  if(p==='fountain'){const F=item('fountain');burst(F.x+63,F.y+16,30,{v0:12,v1:48,up:26,ay:30,gl:1});floatText('Splash!',F.x+63,F.y+2,'#cfeeff');return;}
  if(p==='portal'){portal.want=false;portal.state='opening';portal.t=0;portal.hold=7;return;}
  if(!wasZoomed)zoomAt(wx,wy,MAXZ); // tap empty ground: zoom in around that point
}
cv.addEventListener('pointerdown',e=>{
  ptr.down=true;ptr.id=e.pointerId;ptr.sx=ptr.px=e.clientX;ptr.sy=ptr.py=e.clientY;ptr.moved=false;
  try{cv.setPointerCapture(e.pointerId);}catch(_){}
});
cv.addEventListener('pointermove',e=>{
  if(ptr.down&&e.pointerId===ptr.id){
    const dx=e.clientX-ptr.px,dy=e.clientY-ptr.py;
    if(!ptr.moved&&Math.hypot(e.clientX-ptr.sx,e.clientY-ptr.sy)>7)ptr.moved=true;
    if(ptr.moved&&view.tz>1){ // drag to pan
      const cpw=cv.clientWidth/W*view.z;view.tcx-=dx/cpw;view.tcy-=dy/cpw;view.cx=view.tcx;view.cy=view.tcy;tip.style.display='none';
    }
    ptr.px=e.clientX;ptr.py=e.clientY;return;
  }
  if(e.pointerType==='mouse'){const [wx,wy]=toWorld(e);showTipFor(e,charAt(wx,wy));}
});
function endPtr(e,cancel){
  if(!ptr.down||e.pointerId!==ptr.id)return;ptr.down=false;
  try{cv.releasePointerCapture(e.pointerId);}catch(_){}
  if(!cancel&&!ptr.moved)onTap(e);
}
cv.addEventListener('pointerup',e=>endPtr(e,false));
cv.addEventListener('pointercancel',e=>endPtr(e,true));
cv.addEventListener('pointerleave',e=>{if(e.pointerType==='mouse')tip.style.display='none';});
cv.addEventListener('wheel',e=>{e.preventDefault();const [wx,wy]=toWorld(e);if(e.deltaY<0&&view.tz<=1)zoomAt(wx,wy,MAXZ);else if(e.deltaY>0&&view.tz>1)zoomOut();},{passive:false});
const zb=document.getElementById('zoom');
if(zb)zb.addEventListener('click',()=>{if(view.tz>1)zoomOut();else zoomAt(view.cx,view.cy,MAXZ);});
window.addEventListener('keydown',e=>{if(e.key==='Escape')zoomOut();});

// ---------- roster panel ----------
const roster=document.getElementById('roster');
let rosterList=[];
function buildPanel(){
  if(!roster)return;
  roster.innerHTML='';
  rosterList=[merrick,rosie,theo,mabel,finn,juniper,dragon,frog,cat,dog];
  for(const c of rosterList){
    const li=document.createElement('li');li.innerHTML='<b></b> <i></i><span></span>';
    li.children[0].textContent=c.name;li.children[1].textContent=c.role;roster.appendChild(li);c.li=li;
  }
}
const clockEl=document.getElementById('clock');
function updatePanel(){
  for(const c of rosterList){if(c.li)c.li.children[2].textContent=c.act;}
  if(clockEl){const h=Math.floor(hourNow),m=Math.floor((hourNow-h)*60),ap=h>=12?'PM':'AM',hh=((h+11)%12)+1;
    const phase=hourNow>=20.5||hourNow<5?'night':hourNow<7?'dawn':hourNow<17.5?'daytime':'dusk';
    clockEl.textContent=hh+':'+String(m).padStart(2,'0')+' '+ap+' ET · '+phase+(HOUR_FLAG!==null?' (demo clock)':'');}
}

// ---------- start ----------
async function start(){
  const names=[...PROPS,...Object.keys(CHARS).map(k=>k+'_sheet')];
  const imgs=await Promise.all(names.map(n=>loadImg('assets/'+n+'.png')));
  names.forEach((n,i)=>{assets[n.replace('_sheet','')]=imgs[i];});
  merrick=mkVillager('merrick','Merrick the Grey','wizard',17,'TD',{h:34,stride:4.4,sw:8.4,w:{cast:5,tower:3,portal:2,plaza:2,stroll:3,house:1,well:1,stall:1}});
  rosie=mkVillager('rosie','Rosie','potion brewer',23,'E',{h:28,stride:4,w:{house:3,stall:3,well:1,plaza:2,stroll:2,brew:3}});
  theo=mkVillager('theo','Theo','mushroom grower',21,'W',{h:30,stride:4.2,w:{house:2,stall:2,well:3,plaza:2,stroll:3,tend:4}});
  mabel=mkVillager('mabel','Mabel','hedge witch',12,'S',{h:28,stride:3.4,w:{house:3,stall:2,well:1,plaza:3,stroll:1,fly:2.5}});
  finn=mkVillager('finn','Finn','apprentice mage',31,'SE',{h:24,stride:3.2,sw:6.4,w:{house:1,stall:1,well:2,plaza:2,stroll:4,practice:4}});
  juniper=mkVillager('juniper','Juniper','magic-item seller',21,'JB',{h:28,stride:4,w:{}});
  juniper.state='post';juniper.breakT=rr(50,90);juniper.serving=null;juniper.act='minding the magic shop';
  cat=mkAnimal('cat',292,258);dog=mkAnimal('dog',298,212);dragon=mkAnimal('dragon',300,170);
  cat.timer=rr(1,3);dog.timer=rr(.5,2);dragon.timer=rr(.5,2);
  mkDuck(0,238,278,'duck');mkDuck(1,262,284,'duck2');mkDuck(2,254,274,'duck3');
  frog=mkFrog();
  mkSweeper(252,146,288,148,7);mkSweeper(204,243,232,243,6);
  for(let i=0;i<3;i++)fairies.push(mkFairy(i));
  for(let i=0;i<16;i++)wisps.push(mkWisp());
  for(const a of LANTERN_ANCHORS)lanterns.push(mkLantern(a));
  villagers.forEach((v,i)=>{if(v!==juniper){v.timer=.3+i*1.1;}});
  buildPanel();
  rebuild();
  syncZoomUI();
  requestAnimationFrame(frame);
}
function trigger(what){ // test hooks: FV.trigger('portal'|'wish'|'flame'|'misfire'|'fly'|'cast'|'talk')
  if(what==='portal'){portal.want=false;portal.state='opening';portal.t=0;portal.hold=8;}
  else if(what==='wish')wellWish();
  else if(what==='flame')flame(dragon);
  else if(what==='misfire'){finn.state='practice';finn.timer=5;finn.pT=0;finn.pN=2;finn.misfire=true;finn.mis=false;finn.act='practising sparks';finn.dir='side';finn.flip=false;}
  else if(what==='fly')startFly(mabel);
  else if(what==='cast')castPose(merrick,'stars',3.5);
  else if(what==='talk')frogTalk(frog);
}
window.addEventListener('resize',()=>{fit();});
window.FV={N,EDGES,OBST,SLOTS,villagers,chars,validateGraph,blocked,segClear,get R(){return R;},get R0(){return R0;},queue:()=>queue,view,items,LIGHTS,trigger,portal,particles,
  setHour(h){hourNow=h;},get nightK(){return nightK;},zoomAt,zoomOut,fairies,wisps,lanterns,sweepers,get frog(){return frog;},get dragon(){return dragon;},get merrick(){return merrick;},get cat(){return cat;},get dog(){return dog;}};
fit();
start();
