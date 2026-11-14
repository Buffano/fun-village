// Fun Village – dense single-view scene (480x320 world) with walking villagers and animals.
// Static ground + props are cached/pre-scaled; characters are animated with requestAnimationFrame
// and depth-sorted with the props by their feet (bottom) y.
const W=480,H=320;
const cv=document.getElementById('c'),ctx=cv.getContext('2d');
const DEBUG=/[?&]debug/.test(location.search);
const TS=Math.max(1,Math.min(20,+((location.search.match(/[?&]speed=(\d+)/)||[])[1])||1)); // ?speed=N fast-forwards the simulation (testing)
const K=4; // character sheets are stored at 4 px per world px
let S=2,R=2; // S = css multiple, R = backing-store scale (integer)
let groundR=null,propsR=[],sheetsR={};

// ---------- tiny helpers ----------
function mulberry32(a){return function(){a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}
const rnd=Math.random;
const rr=(a,b)=>a+rnd()*(b-a);
const pick=a=>a[(rnd()*a.length)|0];
const dist=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1]);

// ---------- walking graph (world coords = feet position) ----------
const N={
  N1:[206,137],N2:[240,139],N3:[276,141],NE:[306,152],E:[322,186],SE:[304,230],S:[240,240],SW:[186,242],SWM:[189,223],W:[172,209],
  WELL:[160,202],W2:[109,207],W3:[106,150],W4:[109,272],W5:[110,292],
  D1:[69,126],D2:[222,118],D3:[42,291],D4:[358,303],
  P1:[318,252],P2:[326,303],
  JB:[387,200]
};
const EDGES=[['N1','N2'],['N2','N3'],['N3','NE'],['NE','E'],['E','SE'],['SE','S'],['S','SW'],['SW','SWM'],['SWM','W'],
  ['N1','D2'],['W','WELL'],['WELL','W2'],['W2','W3'],['W3','D1'],['W2','W4'],['W4','W5'],['W5','D3'],
  ['SE','P1'],['P1','P2'],['P2','D4'],['E','JB']];
const SLOTS=[[367,201],[351,204],[335,207],[319,210]]; // queue at the stall, slot 0 = at the counter
const DOORS=['D1','D2','D3','D4'];
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
  {r:[330,96,432,190]},           // stall (incl. counter)
  {r:[0,0,82,112]},{r:[384,0,476,124]},{r:[436,150,480,248]} // trees
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
// stall/door/back-of-stall points are allowed inside blocks; only validate the ring/lane edges
function validateGraph(){
  const bad=[];
  for(const [a,b] of EDGES){
    if(a==='JB'||b==='JB')continue;
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
  for(const [a,b] of EDGES){if(a==='JB'||b==='JB')continue;segs.push([N[a][0],N[a][1],N[b][0],N[b][1],a==='W'||b==='WELL'||a==='W2'?4.5:4]);}
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
const PROPS=['house1','house2','tree','fountain','well','stall','pond'];
const CHARS={ // sheet meta (cell size & feet anchor in sheet px) -- sheets: 4 cols x 3 rows (front, back, side-left)
  rosie:{cw:40,ch:78,ay:76},
  theo:{cw:44,ch:84,ay:82},
  mabel:{cw:38,ch:72,ay:70},
  finn:{cw:33,ch:64,ay:62},
  juniper:{cw:38,ch:76,ay:74},
  cat:{cw:38,ch:42,ay:40},
  dog:{cw:46,ch:46,ay:44},
  duck:{cw:35,ch:49,ay:47}
};
function loadImg(src){return new Promise(r=>{const i=new Image();i.onload=()=>r(i);i.onerror=()=>r(null);i.src=src;});}
// x,y = top-left in world px, s = scale, sy = depth-sort y (feet line of the prop)
const items=[
  {k:'tree',    x:0,   y:0,   s:.9,  sy:108},
  {k:'house1',  x:30,  y:6,   s:1,   sy:118},
  {k:'house2',  x:188, y:0,   s:1,   sy:113},
  {k:'tree',    x:385, y:0,   s:1,   sy:118},
  {k:'well',    x:140, y:118, s:.85, sy:191},
  {k:'fountain',x:175, y:125, s:1,   sy:232},
  {k:'stall',   x:330, y:98,  s:.95, sy:192},
  {k:'house1',  x:8,   y:182, s:.88, sy:284},
  {k:'tree',    x:116, y:230, s:.72, sy:313},
  {k:'pond',    x:196, y:243, s:.9,  sy:254},
  {k:'house2',  x:330, y:192, s:.88, sy:299},
  {k:'tree',    x:438, y:150, s:.78, sy:240}
];
items.sort((a,b)=>a.sy-b.sy);

// ---------- scaling / layout ----------
function fit(){
  const st=document.getElementById('stage');
  const a=st.clientWidth-16, ah=st.clientHeight-16;
  const f=Math.min(a/W,ah/H);
  S=Math.max(1,Math.floor(f));
  const css=f<1?f:S;
  const dpr=Math.min(window.devicePixelRatio||1,2);
  R=Math.max(1,Math.min(3,Math.ceil(css*dpr-0.001)));
  cv.width=W*R;cv.height=H*R;
  cv.style.width=Math.floor(W*css)+'px';cv.style.height=Math.floor(H*css)+'px';
  rebuild();
}
function mk(w,h){const c=document.createElement('canvas');c.width=Math.max(1,w);c.height=Math.max(1,h);return c;}
function rebuild(){
  groundR=mk(W*R,H*R);const g=groundR.getContext('2d');g.imageSmoothingEnabled=false;g.drawImage(ground,0,0,W*R,H*R);
  propsR=items.map(o=>{const img=assets[o.k];if(!img)return null;
    const w=Math.round(img.width/2*o.s*R),h=Math.round(img.height/2*o.s*R);
    const c=mk(w,h),x=c.getContext('2d');x.imageSmoothingEnabled=true;x.imageSmoothingQuality='high';x.drawImage(img,0,0,w,h);
    return {c,x:Math.round(o.x*R),y:Math.round(o.y*R),sy:o.sy};}).filter(Boolean);
  sheetsR={};
  for(const k in CHARS){const img=assets[k];if(!img)continue;const m=CHARS[k];
    const cw=Math.round(m.cw*R/K),ch=Math.round(m.ch*R/K);
    const c=mk(cw*4,ch*3),x=c.getContext('2d');x.imageSmoothingEnabled=true;x.imageSmoothingQuality='high';x.drawImage(img,0,0,cw*4,ch*3);
    sheetsR[k]={c,cw,ch,ay:Math.round(m.ay*R/K)};}
  // two tinted duck variants (cream -> tan / grey-brown), made at load so they cost nothing per frame
  if(sheetsR.duck){
    for(const [nm,tint] of [['duck2','#c9a06a'],['duck3','#aab4c0']]){
      const b=sheetsR.duck,c=mk(b.c.width,b.c.height),x=c.getContext('2d');
      x.drawImage(b.c,0,0);x.globalCompositeOperation='multiply';x.fillStyle=tint;x.fillRect(0,0,c.width,c.height);
      x.globalCompositeOperation='destination-in';x.drawImage(b.c,0,0);
      sheetsR[nm]={c,cw:b.cw,ch:b.ch,ay:b.ay};}
  }
}

// ---------- characters ----------
const chars=[];     // everything that is drawn with depth sorting
const villagers=[];
let queue=[];       // customers at the stall, index 0 = at counter
let wellBusy=null,juniper=null,cat=null,dog=null;
const particles=[];
const ITEMS={apple:['#d83a2e','#7a1d16'],carrot:['#f08a24','#7a4a12'],pumpkin:['#f2a233','#9a5a14'],cabbage:['#8fcf5b','#3f7a2c'],bucket:['#7a5230','#4aa8e0']};

function mkVillager(id,name,role,speed,start,opt){
  const p=N[start];
  const v={id,name,role,sheet:id,x:p[0],y:p[1],dir:'down',flip:false,state:'idle',timer:rr(.5,3),route:[],speed,spd0:speed,
    animT:0,alpha:1,item:null,itemT:0,act:'out and about',node:start,opt,sy:0,squash:1,last:null,lookT:rr(2,5)};
  villagers.push(v);chars.push(v);return v;
}
function setRoute(v,names,extra){
  v.route=names.map(n=>N[n].slice());if(extra)for(const e of extra)v.route.push(e.slice());
  v.state='walk';
}
function goTo(v,target,extra){ // from the node v is standing at to a graph node (+ optional extra points)
  const names=route(v.node,target);
  if(names.length>1||extra){setRoute(v,names.slice(names.length>1?1:0),extra);}
  v.destNode=target;
}
function freeRing(v){
  const taken=new Set(villagers.filter(o=>o!==v&&o.ringNode).map(o=>o.ringNode));
  const c=RING.filter(n=>!taken.has(n));return pick(c.length?c:RING);
}
function chooseActivity(v){
  v.ringNode=null;
  const w=v.opt.w,keys=Object.keys(w);let tot=0;
  const ok=k=>{
    if(k==='stall')return juniper&&juniper.state==='post'&&queue.length<3&&!v.item;
    if(k==='well')return !wellBusy;
    return true;};
  const cand=keys.filter(ok);let r=rnd()*cand.reduce((s,k)=>s+w[k],0);
  let act=cand[0];for(const k of cand){r-=w[k];if(r<=0){act=k;break;}}
  if(act==='house'){
    const d=pick(DOORS.filter(x=>x!==v.last));v.last=d;v.targetDoor=d;v.phase='toDoor';
    v.act='heading home to '+({D1:'the north-west house',D2:'the north house',D3:'the south-west house',D4:'the south-east house'}[d]).replace('heading home to ','');
    v.act='visiting a house';goTo(v,d);
  }else if(act==='stall'){
    v.phase='toQueue';v.act='shopping at the market stall';
    const qi=queue.length;queue.push(v);v.qi=qi;
    const names=route(v.node,'E');setRoute(v,names.slice(names.length>1?1:0),[SLOTS[qi]]);v.node='E';
  }else if(act==='well'){
    v.phase='toWell';v.act='going to the well';wellBusy=v;goTo(v,'WELL');
  }else if(act==='plaza'){
    const n=freeRing(v);v.ringNode=n;v.phase='toPlaza';v.act='enjoying the fountain';goTo(v,n);
  }else{ // stroll: two random nodes
    v.phase='stroll';v.act='out for a stroll';v.strollN=pick(Object.keys(N).filter(k=>!['JB'].includes(k)&&k!==v.node));goTo(v,v.strollN);
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
  else if(ph==='toQueue'){
    v.state='queue';v.dir='side';v.flip=true;v.timer=0;
  }
  else if(ph==='toWell'){v.state='pump';v.timer=rr(4,6);v.dir='up';v.flip=false;v.node='WELL';v.act='drawing water at the well';v.pumpT=0;v.splashT=0;}
  else if(ph==='toPlaza'){v.state='idle';v.timer=rr(5,11);v.dir='down';v.node=v.destNode;v.act='enjoying the fountain';v.lookT=rr(1.5,3.5);}
  else if(ph==='stroll'){v.node=v.destNode;if(rnd()<.4){v.strollN=pick(Object.keys(N).filter(k=>!['JB'].includes(k)&&k!==v.node));goTo(v,v.strollN);}else{v.state='idle';v.timer=rr(1.5,4);v.dir='down';}}
  else {v.state='idle';v.timer=rr(1,3);v.dir='down';}
}
function updateVillager(v,dt){
  v.speed=v.spd0;
  switch(v.state){
    case 'idle':
      v.timer-=dt;v.lookT-=dt;
      if(v.lookT<=0){v.lookT=rr(2,5);if(rnd()<.5){v.dir='side';v.flip=rnd()<.5;}else{v.dir='down';}}
      if(v.timer<=0){v.last2=v.act;chooseActivity(v);}
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
        v.animT+=st/5;}
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
      if(v.qi===0&&juniper.state==='post'&&!juniper.serving&&!villagers.some(o=>o!==v&&o.alpha>0&&Math.hypot(o.x-SLOTS[0][0],o.y-SLOTS[0][1])<6)){juniper.serving=v;v.state='buy';v.timer=2.4;v.act='buying something';}
      break;
    case 'buy':
      v.timer-=dt;v.dir='side';v.flip=true;
      if(v.timer<=0){
        v.item=pick(['apple','carrot','pumpkin','cabbage']);v.itemT=rr(20,32);juniper.serving=null;
        dropFromQueue(v);v.state='idle';v.timer=.4;v.dir='down';v.node='E';v.act='heading off with a treat';
        for(let i=0;i<4;i++)particles.push({k:'coin',x:SLOTS[0][0]+rr(-3,3),y:SLOTS[0][1]-10,vx:rr(-5,5),vy:rr(-26,-16),life:.6,max:.6});
      }
      break;
    case 'pump':{
      v.timer-=dt;v.pumpT+=dt;v.splashT-=dt;v.dir='up';
      v.squash=1-.07*(.5+.5*Math.sin(v.pumpT*7));
      if(v.splashT<=0&&v.pumpT>1.2){v.splashT=.35;const wx=165,wy=192;
        for(let i=0;i<5;i++)particles.push({k:'drop',x:wx+rr(-3,3),y:wy,vx:rr(-9,9),vy:rr(-24,-10),life:.55,max:.55});}
      if(v.timer<=0){v.squash=1;v.item='bucket';v.itemT=rr(12,20);wellBusy=null;v.state='idle';v.timer=.8;v.dir='down';v.act='carrying water';}
      break;}
  }
  if(v.item){v.itemT-=dt;if(v.itemT<=0&&v.state!=='inside')v.item=null;}
}

// ---------- Juniper (shopkeeper) ----------
function updateJuniper(v,dt){
  v.speed=v.spd0;
  if(v.state==='post'){
    v.x=N.JB[0];v.y=N.JB[1];if(v.serving){v.dir='side';v.flip=false;}else{v.dir=(Math.floor(tAcc/4)%3===2)?'side':'down';v.flip=false;}v.act=v.serving?'serving a customer':'minding the stall';
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
      v.animT+=st/5;}
  }else if(v.state==='rest'){
    v.timer-=dt;
    if(v.timer<=0){v.state='walk';v.phase='return';v.route=[N.E.slice(),N.JB.slice()];v.act='heading back to the stall';}
  }
}

// ---------- animals ----------
function mkAnimal(kind,x,y){
  const a={kind,sheet:kind,x,y,dir:'down',flip:false,state:'idle',timer:rr(1,4),tx:x,ty:y,speed:kind==='cat'?17:23,animT:0,alpha:1,follow:null,followT:0,pose:null,sy:0,name:kind==='cat'?'Biscuit':'Pepper',role:kind==='cat'?'village cat':'village dog',act:'wandering',squash:1};
  chars.push(a);return a;
}
function pickWanderPoint(a){
  for(let i=0;i<30;i++){const x=rr(14,466),y=rr(150,310);
    if(!blocked(x,y,6,1)&&dist([x,y],[a.x,a.y])<120&&segClear([a.x,a.y],[x,y],3,1)){return [x,y];}}
  return [a.x,a.y];
}
function updateAnimal(a,dt){
  const slow=a.kind==='cat'?1:1;
  if(a.state==='idle'||a.state==='sit'||a.state==='sleep'){
    a.timer-=dt;
    if(a.timer<=0){
      const r=rnd();
      if(a.state==='sleep'&&r<.6){a.state='sit';a.timer=rr(2,4);a.act='waking up';}
      else if(r<.3&&a.state==='idle'){a.state='sleep';a.timer=rr(8,18);a.act='napping';}
      else if(r<.55){a.state='sit';a.timer=rr(3,7);a.act='sitting';}
      else if(r<.8&&villagers.length){ // follow a villager that is out and about
        const c=villagers.filter(v=>v.state==='walk'||v.state==='idle');
        if(c.length){a.follow=pick(c);a.state='follow';a.followT=rr(14,24);a.act='following '+a.follow.name;}
        else a.state='idle';
      }else{const p=pickWanderPoint(a);a.tx=p[0];a.ty=p[1];a.state='walk';a.act='wandering';}
      if(a.state==='idle')a.timer=rr(1,3);
    }
  }else if(a.state==='walk'||a.state==='follow'){
    let tx=a.tx,ty=a.ty;
    if(a.state==='follow'){
      a.followT-=dt;const f=a.follow;
      if(a.followT<=0||!f||f.state==='inside'||f.alpha<1){a.state='idle';a.timer=rr(1,3);a.act='wandering';return;}
      const d=dist([a.x,a.y],[f.x,f.y]);
      if(d<20){a.timer=0;a.moving=false;a.dir='down';return;}
      tx=f.x+(f.dir==='side'?(f.flip?-14:14):0);ty=f.y+(f.dir==='side'?4:(f.dir==='up'?12:-2));
    }
    const dx=tx-a.x,dy=ty-a.y,d=Math.hypot(dx,dy),sp=a.speed*(a.state==='follow'&&d>60?1.5:1),st=sp*dt;
    if(d<4&&a.state==='walk'){a.state=rnd()<.4?'sit':'idle';a.timer=rr(2,6);return;}
    const nx=a.x+dx/d*st,ny=a.y+dy/d*st;
    if(blocked(nx,ny,2,1)){ // slide along one axis or give up
      if(!blocked(a.x+dx/d*st,a.y,2,1)){a.x+=dx/d*st;}
      else if(!blocked(a.x,a.y+dy/d*st,2,1)){a.y+=dy/d*st;}
      else{a.state='idle';a.timer=rr(.5,1.5);return;}
    }else{a.x=nx;a.y=ny;}
    const ax=Math.abs(dx),ay=Math.abs(dy);
    if(a.dir==='side'){if(ay>ax*1.8)a.dir=dy>0?'down':'up';else a.flip=dx>0;}else{if(ax>ay*1.8){a.dir='side';a.flip=dx>0;}else a.dir=dy>0?'down':'up';}
    a.animT+=st/3.5;
  }
}

// ---------- ducks ----------
const ducks=[];
function mkDuck(i,x,y,sheet){
  const d={kind:'duck',sheet,x,y,dir:'side',flip:i%2===0,state:'swim',timer:rr(1,3),tx:x,ty:y,speed:rr(5,8),animT:rr(0,4),alpha:1,sy:0,name:['Pip','Dot','Waddles'][i]||'Duck',role:'pond duck',act:'paddling about',dipT:0,clipWL:3.2};
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

// ---------- drawing ----------
function drawSprite(c,row,col,x,y,o){
  const sh=sheetsR[c.sheet];if(!sh)return;
  o=o||{};
  const sx=col*sh.cw,sy=row*sh.ch;
  let dw=sh.cw,dh=sh.ch,srcH=sh.ch,dyTop=0;
  const squash=o.squash||1;
  if(o.clip){srcH=Math.max(1,Math.round(sh.ay-o.clip*R));}
  const px=Math.round(x*R),py=Math.round(y*R+(o.dy||0)*R);
  const th=Math.round(srcH*squash);
  ctx.save();
  if(o.alpha!==undefined&&o.alpha<1)ctx.globalAlpha=Math.max(0,o.alpha);
  if(o.flip){ctx.translate(px,0);ctx.scale(-1,1);ctx.drawImage(sh.c,sx,sy,sh.cw,srcH,-Math.round(sh.cw/2),py-sh.ay-(th-srcH)+ (o.clip?0:0),sh.cw,th);}
  else ctx.drawImage(sh.c,sx,sy,sh.cw,srcH,px-Math.round(sh.cw/2),py-sh.ay-(th-srcH),sh.cw,th);
  ctx.restore();
}
function shadow(x,y,w,a){
  ctx.fillStyle='rgba(30,50,20,'+(a||.22)+')';
  ctx.beginPath();ctx.ellipse(x*R,(y-.5)*R,w*R,w*.4*R,0,0,6.283);ctx.fill();
}
const ROW={down:0,up:1,side:2};
function drawItem(v,x,y){
  const it=ITEMS[v.item];if(!it)return;
  let ix,iy;
  if(v.dir==='side'){ix=x+(v.flip?-5:5)*0+(v.flip?4:-4);iy=y-7;}
  else if(v.dir==='up'){ix=x+5;iy=y-7;}else{ix=x+5.5;iy=y-6;}
  const s=R,px=Math.round(ix*R),py=Math.round(iy*R);
  if(v.item==='bucket'){
    ctx.fillStyle=it[0];ctx.fillRect(px-1.5*s,py,3*s,2.4*s);ctx.fillStyle=it[1];ctx.fillRect(px-1.2*s,py,2.4*s,.9*s);
    ctx.fillStyle='#4a3420';ctx.fillRect(px-1.8*s,py-1*s,.6*s,1.2*s);ctx.fillRect(px+1.2*s,py-1*s,.6*s,1.2*s);
  }else{
    ctx.fillStyle=it[1];ctx.fillRect(px-1.8*s,py-.4*s,3.6*s,3.2*s);ctx.fillStyle=it[0];ctx.fillRect(px-1.4*s,py,2.8*s,2.4*s);
    ctx.fillStyle='#fff8';ctx.fillRect(px-.9*s,py+.3*s,.8*s,.8*s);
    if(v.item==='apple'||v.item==='pumpkin'){ctx.fillStyle='#4a7a2a';ctx.fillRect(px,py-1*s,.8*s,.8*s);}
  }
}
function drawChar(c,t){
  if(c.alpha<=0)return;
  const x=c.x,y=c.y;
  if(c.kind==='duck'){drawDuck(c,t);return;}
  if(c.kind==='cat'||c.kind==='dog'){drawAnimal(c);return;}
  // villager
  shadow(x,y,5.2,.2*c.alpha);
  let row=ROW[c.dir]||0,col=0,dy=0;
  const walking=c.state==='walk';
  if(walking){const f=Math.floor(c.animT)&3;col=f;dy=(f&1)?-.5:0;}
  else if(c.state==='idle'||c.state==='queue'||c.state==='buy'||c.state==='pump'||c.state==='enter'||c.state==='exit'||c.state==='post'||c.state==='rest'){
    col=0;
    if(c.state==='buy'||(c===juniper&&c.serving))dy=-.4*Math.abs(Math.sin(t*5));
    else dy=0;
  }
  const breathe=walking?1:1+.012*Math.sin(t*2+c.x);
  drawSprite(c,row,col,x,y,{flip:c.dir==='side'&&c.flip,alpha:c.alpha,dy,squash:(c.squash||1)*breathe});
  if(c.item&&c.alpha>0)drawItem(c,x,y+dy);
}
function drawAnimal(a){
  const x=a.x,y=a.y;
  const sleeping=a.state==='sleep',sitting=a.state==='sit';
  shadow(x,y,sleeping?6:4,.2);
  let row,col,flip=false,dy=0;
  if(sleeping){row=2;col=3;flip=a.flip;}
  else if(sitting){row=2;col=2;flip=a.flip;}
  else{
    const moving=a.state==='walk'||(a.state==='follow'&&dist([a.x,a.y],[a.follow?a.follow.x:0,a.follow?a.follow.y:0])>=20);
    row=ROW[a.dir]||0;
    if(a.dir==='side'){col=(Math.floor(a.animT)&1);flip=a.flip;}else col=moving?(Math.floor(a.animT)&3):0;
    if(moving)dy=(Math.floor(a.animT)&1)?-.4:0;
  }
  drawSprite(a,row,col,x,y,{flip,dy});
}
function drawDuck(d,t){
  const bob=Math.sin(t*2.2+d.x)*.3;
  const x=d.x,y=d.y;
  // ripple rings at the waterline
  ctx.strokeStyle='rgba(235,248,255,.5)';ctx.lineWidth=Math.max(1,R*.6);
  const ph=(t*1.2+d.x)%1;
  ctx.beginPath();ctx.ellipse(x*R,(y-d.clipWL+1)*R,(5+ph*3)*R,(1.8+ph*1.1)*R,0,0,6.283);ctx.stroke();
  ctx.strokeStyle='rgba(235,248,255,.25)';ctx.beginPath();ctx.ellipse(x*R,(y-d.clipWL+1)*R,(7+ph*3)*R,(2.6+ph*1.1)*R,0,0,6.283);ctx.stroke();
  let row=2,col=0,dy=bob;
  const moving=Math.hypot(d.tx-d.x,d.ty-d.y)>1.5;
  if(d.state==='dip'){ // sheet: row 1 = side swim; row 2 cols 0-2 = dip, col 3 = head back up with drips
    const p=d.dipT/1.9;row=2;col=p<.18?0:p<.7?1:p<.86?2:3;dy=0;
  }else{row=1;col=moving?(Math.floor(d.animT*1.2)&3):0;}
  drawSprite(d,row,col,x,y,{flip:d.flip,dy,clip:d.clipWL});
}
function drawParticles(dt){
  for(let i=particles.length-1;i>=0;i--){
    const p=particles[i];p.life-=dt;if(p.life<=0){particles.splice(i,1);continue;}
    p.vy+=90*dt;p.x+=p.vx*dt;p.y+=p.vy*dt;
    const a=Math.min(1,p.life/p.max*1.6);
    ctx.globalAlpha=a;
    if(p.k==='drop'){ctx.fillStyle='#7fc8f0';ctx.fillRect(Math.round(p.x*R),Math.round(p.y*R),Math.max(1,R),Math.max(1,R*1.4));}
    else{ctx.fillStyle='#f6d34a';ctx.fillRect(Math.round(p.x*R),Math.round(p.y*R),Math.max(1,R*1.2),Math.max(1,R*1.2));}
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
  ctx.restore();
}

let last=0,frameN=0,tAcc=0;
function frame(ts){
  requestAnimationFrame(frame);
  if(!groundR)return;
  const t0=window.__perf?performance.now():0;
  let dt=Math.min(.05,(ts-last)/1000||0);last=ts;tAcc+=dt;
  for(let i=0;i<TS;i++){
    for(const v of villagers)v===juniper?updateJuniper(v,dt):updateVillager(v,dt);
    updateAnimal(cat,dt);updateAnimal(dog,dt);
    for(const d of ducks)updateDuck(d,dt);
  }
  // draw: cached ground, then props + characters sorted by feet y
  ctx.drawImage(groundR,0,0);
  for(const c of chars)c.sy=c.y+(c.kind==='duck'?0:0);
  const cs=chars.slice().sort((a,b)=>a.sy-b.sy);
  let ci=0;
  for(const p of propsR){
    while(ci<cs.length&&cs[ci].sy<p.sy){drawChar(cs[ci],tAcc);ci++;}
    ctx.drawImage(p.c,p.x,p.y);
  }
  while(ci<cs.length){drawChar(cs[ci],tAcc);ci++;}
  drawParticles(dt);
  if(DEBUG)drawDebug();
  frameN++;
  if(frameN%30===0)updatePanel();
  if(window.__perf)window.__perf.push(performance.now()-t0);
}

// ---------- tooltip + panel ----------
const tip=document.getElementById('tip');
function charAt(wx,wy){
  let best=null,bd=1e9;
  for(const c of chars){
    if(c.alpha<=0||c.state==='inside')continue;
    const h=c.kind==='duck'?8:(c.kind==='cat'||c.kind==='dog'?10:19);
    const d=Math.hypot(wx-c.x,(wy-(c.y-h/2))*0.8);
    if(d<(c.kind==='villager'||!c.kind?11:9)&&d<bd){bd=d;best=c;}
  }
  return best;
}
function showTip(e){
  const r=cv.getBoundingClientRect();
  const wx=(e.clientX-r.left)/r.width*W,wy=(e.clientY-r.top)/r.height*H;
  const c=charAt(wx,wy);
  if(!c){tip.style.display='none';return;}
  tip.textContent=c.name+' · '+c.role+' — '+c.act;
  tip.style.display='block';
  const sr=document.getElementById('stage').getBoundingClientRect();
  tip.style.left=Math.max(4,Math.min(sr.width-tip.offsetWidth-4,e.clientX-sr.left-tip.offsetWidth/2))+'px';
  tip.style.top=Math.max(4,e.clientY-sr.top-34)+'px';
}
cv.addEventListener('pointermove',showTip);
cv.addEventListener('pointerdown',e=>{showTip(e);clearTimeout(showTip.t);showTip.t=setTimeout(()=>tip.style.display='none',2600);});
cv.addEventListener('pointerleave',e=>{if(e.pointerType==='mouse')tip.style.display='none';});
const roster=document.getElementById('roster');
const ROSTER_SPR={};
function buildPanel(){
  if(!roster)return;
  roster.innerHTML='';
  for(const c of [...villagers,cat,dog]){
    const li=document.createElement('li');li.innerHTML='<b></b> <i></i><span></span>';
    li.children[0].textContent=c.name;li.children[1].textContent=c.role;roster.appendChild(li);c.li=li;
  }
}
function updatePanel(){for(const c of [...villagers,cat,dog]){if(c.li)c.li.children[2].textContent=c.act;}}

// ---------- start ----------
async function start(){
  const names=[...PROPS,...Object.keys(CHARS).map(k=>k+'_sheet')];
  const imgs=await Promise.all(names.map(n=>loadImg('assets/'+n+'.png')));
  names.forEach((n,i)=>{assets[n.replace('_sheet','')]=imgs[i];});
  // villagers
  mkVillager('rosie','Rosie','baker',21,'E',{w:{house:3,stall:3,well:1,plaza:3,stroll:2}});
  mkVillager('theo','Theo','farmer',20,'W',{w:{house:2,stall:2,well:4,plaza:2,stroll:3}});
  mkVillager('mabel','Mabel','elder',11,'S',{w:{house:3,stall:2,well:1,plaza:4,stroll:1}});
  const finn=mkVillager('finn','Finn','kid',31,'SE',{w:{house:1,stall:1,well:2,plaza:3,stroll:5}});
  juniper=mkVillager('juniper','Juniper','shopkeeper',20,'JB',{w:{}});
  juniper.state='post';juniper.breakT=rr(50,90);juniper.serving=null;
  juniper.act='minding the stall';
  cat=mkAnimal('cat',292,258);dog=mkAnimal('dog',298,212);
  cat.timer=rr(1,3);dog.timer=rr(.5,2);
  mkDuck(0,238,278,'duck');mkDuck(1,262,284,'duck2');mkDuck(2,254,274,'duck3');
  villagers.forEach((v,i)=>{if(v!==juniper){v.timer=.3+i*1.1;}});
  buildPanel();
  rebuild();
  requestAnimationFrame(frame);
}
window.addEventListener('resize',()=>{fit();});
window.FV={N,EDGES,OBST,SLOTS,villagers,chars,validateGraph,blocked,segClear,get R(){return R;},get S(){return S;},queue:()=>queue};
fit();
start();
