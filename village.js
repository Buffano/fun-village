// Fun Village – standalone 3-screen pixel village based on locked Bot Hollow layout.
// Pure client-side, code-drawn, matching sprite size. Characters intersect; events to be added later.
const W=1200,H=240,T=8,VIEW_W=400; // 3 screens wide
const cv=document.getElementById('c'),ctx=cv.getContext('2d');
const low=document.createElement('canvas');low.width=W;low.height=H;const g=low.getContext('2d');
let S=2,camX=0;
function fit(){
  const st=document.getElementById('stage');
  const avail=st.clientWidth-16, availH=st.clientHeight-16;
  S=Math.max(1,Math.floor(Math.min(avail/VIEW_W,availH/H)));
  cv.width=VIEW_W*S;cv.height=H*S;
  cv.style.width=(VIEW_W*S)+'px';cv.style.height=(H*S)+'px';
}
window.addEventListener('resize',fit);fit();

let seed=1337;function rnd(){seed=(seed*16807)%2147483647;return (seed-1)/2147483646;}
function px(c,x,y,w=1,h=1,col){c.fillStyle=col;c.fillRect(x|0,y|0,w,h);}
const P={g1:'#5fae4a',g2:'#6fbe52',g3:'#4e9a40',d1:'#e2c387',d2:'#c9a565',w1:'#3f8fd8',out:'#2a1d14',
 t1:'#2f7a3a',t2:'#3f9446',tr:'#6b4526',skin:'#f6c9a0',stone:'#b8b0a0'};

// Expanded locked layout across 3 screens
const HOUSES={
 Friday:{x:60,y:30,w:60,h:42,name:'Friday'},
 Clima:{x:180,y:25,w:50,h:40,name:'Clima'},
 Coach:{x:320,y:20,w:55,h:40,name:'Coach'},
 Luke:{x:100,y:80,w:46,h:36,name:'Luke'},
 Mark:{x:220,y:90,w:50,h:34,name:'Mark'},
 Dos:{x:340,y:85,w:42,h:32,name:'Dos'},
 Gladdus:{x:40,y:140,w:58,h:40,name:'Gladdus'},
 ResI:{x:160,y:150,w:44,h:34,name:'ResI'},
 // Screen 2-3 extras for fun
 Inn:{x:500,y:40,w:50,h:40,name:'Inn'},
 Market:{x:650,y:70,w:60,h:36,name:'Market'},
 Park:{x:800,y:50,w:40,h:30,name:'Park'},
 Dock:{x:950,y:160,w:30,h:20,name:'Dock'},
 Cabin:{x:1050,y:80,w:48,h:38,name:'Cabin'}
};
const pond={cx:1100,cy:180,rx:40,ry:18};
const fountain={x:280,y:110};
const firepit={x:380,y:130};

function drawGround(){
 for(let x=0;x<W;x+=T)for(let y=0;y<H;y+=T){
  px(g,x,y,T,T,P.g1);
  if(rnd()<.3)px(g,x+rnd()*6,y+rnd()*6,1,1,P.g2);
 }
 // paths
 for(let x=20;x<W-20;x+=2)px(g,x,100,2,8,P.d1);
 for(let y=40;y<200;y+=2)px(g,200,y,8,2,P.d1);
 // pond
 for(let y=0;y<H;y++)for(let x=0;x<W;x++){
  const dx=(x-pond.cx)/pond.rx,dy=(y-pond.cy)/pond.ry;
  if(dx*dx+dy*dy<1)px(g,x,y,1,1,P.w1);
 }
}
function tree(x,y){
 px(g,x-1,y+4,3,6,P.tr);
 for(let dy=-6;dy<=6;dy++)for(let dx=-6;dx<=6;dx++)if(dx*dx+dy*dy<30)px(g,x+dx,y+dy-2,1,1,P.t2);
}
function drawForest(){
 for(let i=0;i<60;i++)tree(rnd()*W,10+rnd()*40);
 [[80,50],[250,40],[450,30],[700,60],[900,40],[1050,50]].forEach(([x,y])=>tree(x,y));
}
function house(h){
 const {x,y,w,h:hh}=h;
 const roofH=Math.floor(hh*0.4);
 px(g,x+2,y+roofH,w-4,hh-roofH,'#efe2c4');
 px(g,x,y,w,roofH,'#c8962a');
 px(g,x+w/2-3,y+hh-8,6,8,'#8a5228');
 px(g,x+6,y+roofH+4,6,5,'#8fd0f0');
 px(g,x+w-12,y+roofH+4,6,5,'#8fd0f0');
}
function drawProps(){
 // fountain
 px(g,fountain.x-12,fountain.y-8,24,16,P.stone);
 px(g,fountain.x-8,fountain.y-4,16,10,P.w1);
 // fire
 px(g,firepit.x-8,firepit.y-4,16,10,'#9a6a4a');
 px(g,firepit.x-3,firepit.y-1,6,4,'#ff6a3a');
 // more props on other screens
 px(g,550,100,20,10,'#a8703c'); // bench
 px(g,750,120,16,16,'#5fae4a'); // garden patch
}
function buildBG(){
 seed=1337;
 drawGround();
 drawForest();
 for(const k in HOUSES)house(HOUSES[k]);
 drawProps();
}

// Matching sized simple sprites
const LOOKS={
 Friday:{hat:'#e8b830',shirt:'#d9a020'},
 Gladdus:{hat:'#5a3e8c',shirt:'#7a5aa8'},
 Coach:{hat:'#d04030',shirt:'#e05a3a'},
 Clima:{hat:'#7d8a99',shirt:'#9fb0c0'},
 ResI:{hat:'#f0c020',shirt:'#3a72c8'},
 Dos:{hat:'#8a4cc8',shirt:'#a86ad8'},
 Mark:{hat:'#c83a50',shirt:'#d85a6a'},
 Luke:{hat:'#6b4a2a',shirt:'#3f9a7a'},
 Extra1:{hat:'#4a8a3a',shirt:'#6bb050'},
 Extra2:{hat:'#c06040',shirt:'#e08060'}
};
let bots=[],ambient=[],train={x:0,dir:1,timer:0},night=false,visitors=[];
function initAmbient(){
 for(let i=0;i<8;i++)ambient.push({type:'butterfly',x:rnd()*W,y:40+rnd()*100,vx:(rnd()-0.5)*0.6,vy:(rnd()-0.5)*0.4,phase:rnd()*10});
 for(let i=0;i<4;i++)ambient.push({type:'duck',x:pond.cx-20+rnd()*40,y:pond.cy-10,vx:(rnd()-0.5)*0.3,phase:rnd()*5});
}
function drawAmbient(c,t){
 ambient.forEach(a=>{
  if(a.type==='butterfly'){
   const wing=Math.sin(t/200+a.phase)>0?1:0;
   px(c,a.x,a.y,1,1,'#ff8fb0');
   px(c,a.x-1-wing,a.y,1,1,'#b98cf0');
   px(c,a.x+1+wing,a.y,1,1,'#b98cf0');
  }else if(a.type==='duck'){
   px(c,a.x,a.y,4,2,'#f5e050');
   px(c,a.x+3,a.y-1,2,2,'#ff6a5a');
  }
 });
 // train tracks
 for(let x=0;x<W;x+=8)px(c,x,210,6,1,'#8a5a30');
 // train
 px(c,train.x,200,24,8,'#c83a50');
 px(c,train.x+4,198,8,4,'#3a72c8');
 px(c,train.x+16,198,6,4,'#ffd34a');
 if(Math.floor(t/100)%2)px(c,train.x+22,196,2,2,'#aaa'); // smoke
}
function initBots(){
 const names=Object.keys(LOOKS);
 bots=names.map((name,i)=>({
  name,look:LOOKS[name],
  x:80+i*90,y:120+Math.sin(i)*30,
  vx:0,vy:0,dir:1,phase:Math.random()*10,
  activity:null,bubble:null,bubbleT:0
 }));
}
function drawBot(c,b,t){
 const x=Math.round(b.x),y=Math.round(b.y),L=b.look;
 const bob=Math.sin(t/300+b.phase)*1;
 px(c,x-4,y-8+bob,8,6,L.shirt);
 px(c,x-3,y-14+bob,6,6,P.skin);
 px(c,x-5,y-16+bob,10,4,L.hat);
 px(c,x-3,y-2,3,2,'#5a3a20');
 px(c,x+1,y-2,3,2,'#5a3a20');
 // activity visuals
 if(b.activity==='fishing'){px(c,x+5,y-6,10,1,'#6b4526');if(Math.floor(t/600)%5===0)px(c,x+12,y-4,2,2,'#f5e050');}
 if(b.activity==='cooking'&&Math.floor(t/150)%2){px(c,x+6,y-10,2,3,'#aaa');}
 if(b.activity==='waving'){px(c,x+4,y-12,2,4,P.skin);}
 // bubble
 if(b.bubble&&b.bubbleT>0){
  px(c,x-12,y-26,24,12,'#fff');
  px(c,x-11,y-25,22,10,'#222');
  // tiny text approximation
  px(c,x-8,y-22,2,2,'#fff');px(c,x-4,y-22,2,2,'#fff');px(c,x,y-22,2,2,'#fff');
 }
}
function updateBots(t){
 bots.forEach(b=>{
  if(b.bubbleT>0)b.bubbleT--;
  if(!b.activity&&Math.random()<0.005){
   const acts=['fishing','cooking','chatting','napping'];
   b.activity=acts[Math.floor(Math.random()*acts.length)];
   if(b.activity==='fishing'){b.vx=(pond.cx-b.x)*0.01;b.vy=(pond.cy-30-b.y)*0.01;}
   if(b.activity==='cooking'){b.vx=(firepit.x-b.x)*0.01;b.vy=(firepit.y-b.y)*0.01;}
  }
  if(Math.random()<0.015){b.vx=(Math.random()-0.5)*0.9;b.vy=(Math.random()-0.5)*0.6;}
  b.x+=b.vx;b.y+=b.vy;
  b.x=Math.max(10,Math.min(W-10,b.x));
  b.y=Math.max(40,Math.min(H-20,b.y));
  if(b.vx>0)b.dir=1;else if(b.vx<0)b.dir=-1;
  // intersection fun
  bots.forEach(other=>{
   if(other!==b&&Math.hypot(b.x-other.x,b.y-other.y)<14&&Math.random()<0.1){
    b.activity='chatting';other.activity='chatting';
    b.bubble='Hi!';b.bubbleT=120;other.bubble='Hey!';other.bubbleT=120;
    b.vx*=-0.5;other.vx*=-0.5;
   }
  });
  if(b.activity&&Math.random()<0.002)b.activity=null;
 });
}
function updateAmbient(t){
 ambient.forEach(a=>{
  a.x+=a.vx;a.y+=a.vy||0;
  if(a.x<0||a.x>W)a.vx*=-1;
  if(a.y<30||a.y>180)a.vy*=-1;
 });
 // train
 train.x+=train.dir*1.2;
 if(train.x>W-30||train.x<0){train.dir*=-1;train.timer=0;}
 train.timer++;
 if(train.timer>180&&Math.random()<0.3){
  // drop visitor
  const v={name:'Visitor',look:{hat:'#aaa',shirt:'#ccc'},x:train.x+10,y:190,vx:0,vy:-0.5,phase:Math.random(),activity:null,bubble:'Hello!',bubbleT:200,life:400};
  visitors.push(v);
  train.timer=0;
 }
 visitors=visitors.filter(v=>{
  v.life--;
  v.y+=v.vy;v.x+=v.vx;
  if(Math.random()<0.02){v.vx=(Math.random()-0.5)*0.5;}
  return v.life>0;
 });
 night=(Math.floor(t/8000)%2===1); // simple cycle
}
// click reactions
cv.addEventListener('click',e=>{
 const rect=cv.getBoundingClientRect();
 const mx=(e.clientX-rect.left)/S+camX;
 const my=(e.clientY-rect.top)/S;
 const nearest=bots.reduce((a,b)=>Math.hypot(b.x-mx,b.y-my)<Math.hypot(a.x-mx,a.y-my)?b:a);
 if(Math.hypot(nearest.x-mx,nearest.y-my)<30){
  nearest.activity='waving';
  nearest.bubble=['Hello!','Nice day!','Let’s play!'][Math.floor(Math.random()*3)];
  nearest.bubbleT=150;
  nearest.vx=(Math.random()-0.5)*1.2;
 }else{
  nearest.vx=(mx-nearest.x)*0.04;nearest.vy=(my-nearest.y)*0.04;
 }
});
function loop(t){
 updateBots(t);
 // soft camera follow average or free
 const avgX=bots.reduce((s,b)=>s+b.x,0)/bots.length;
 camX=Math.max(0,Math.min(W-VIEW_W,avgX-VIEW_W/2));
 g.clearRect?null:0; // bg is static
 // draw visible slice
 ctx.imageSmoothingEnabled=false;
 ctx.clearRect(0,0,cv.width,cv.height);
 ctx.drawImage(low,camX,0,VIEW_W,H,0,0,cv.width,cv.height);
 // bots on top (need to redraw bots each frame on low? better composite)
 // for simplicity redraw bots in view
 bots.forEach(b=>{
  if(b.x>camX-10&&b.x<camX+VIEW_W+10)drawBot(ctx,b,t); // note: this draws in screen space incorrectly
 });
 // fix: draw bots into low then blit, or adjust
 requestAnimationFrame(loop);
}
// Better loop: draw bots to a temp or adjust coordinates
function betterLoop(t){
 updateBots(t);
 updateAmbient(t);
 const avgX=bots.reduce((s,b)=>s+b.x,0)/bots.length;
 camX=Math.max(0,Math.min(W-VIEW_W,avgX-VIEW_W/2));
 const dyn=document.createElement('canvas');dyn.width=W;dyn.height=H;const d=dyn.getContext('2d');
 d.drawImage(low,0,0);
 if(night){d.fillStyle='rgba(10,20,50,0.4)';d.fillRect(0,0,W,H);px(d,fountain.x-4,fountain.y-2,8,4,'#ffd34a');}
 drawAmbient(d,t);
 bots.forEach(b=>drawBot(d,b,t));
 visitors.forEach(v=>drawBot(d,v,t));
 ctx.imageSmoothingEnabled=false;
 ctx.clearRect(0,0,cv.width,cv.height);
 ctx.drawImage(dyn,camX,0,VIEW_W,H,0,0,cv.width,cv.height);
 requestAnimationFrame(betterLoop);
}
buildBG();
initBots();
initAmbient();
fit();
requestAnimationFrame(betterLoop);
document.getElementById('info').textContent='Click bots to wave. They fish, cook, chat. Butterflies, ducks, day/night, and a train that drops visitors. Camera follows.';
