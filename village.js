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
let bots=[];
function initBots(){
 const names=Object.keys(LOOKS);
 bots=names.map((name,i)=>({
  name,look:LOOKS[name],
  x:80+i*90,y:120+Math.sin(i)*30,
  vx:0,vy:0,dir:1,phase:Math.random()*10
 }));
}
function drawBot(c,b,t){
 const x=Math.round(b.x),y=Math.round(b.y),L=b.look;
 const bob=Math.sin(t/300+b.phase)*1;
 px(c,x-4,y-8+bob,8,6,L.shirt);
 px(c,x-3,y-14+bob,6,6,P.skin);
 px(c,x-5,y-16+bob,10,4,L.hat);
 // simple legs
 px(c,x-3,y-2,3,2,'#5a3a20');
 px(c,x+1,y-2,3,2,'#5a3a20');
}
function updateBots(t){
 bots.forEach(b=>{
  // gentle wander
  if(Math.random()<0.02){b.vx=(Math.random()-0.5)*0.8;b.vy=(Math.random()-0.5)*0.5;}
  b.x+=b.vx;b.y+=b.vy;
  b.x=Math.max(10,Math.min(W-10,b.x));
  b.y=Math.max(40,Math.min(H-20,b.y));
  if(b.vx>0)b.dir=1;else if(b.vx<0)b.dir=-1;
  // simple intersection check (for future events)
  bots.forEach(other=>{
   if(other!==b&&Math.hypot(b.x-other.x,b.y-other.y)<12){
    // future: trigger event here
   }
  });
 });
}
// click to move camera or focus
cv.addEventListener('click',e=>{
 const rect=cv.getBoundingClientRect();
 const mx=(e.clientX-rect.left)/S+camX;
 const my=(e.clientY-rect.top)/S;
 // optional: move nearest bot toward click
 const nearest=bots.reduce((a,b)=>Math.hypot(b.x-mx,b.y-my)<Math.hypot(a.x-mx,a.y-my)?b:a);
 nearest.vx=(mx-nearest.x)*0.05;nearest.vy=(my-nearest.y)*0.05;
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
 const avgX=bots.reduce((s,b)=>s+b.x,0)/bots.length;
 camX=Math.max(0,Math.min(W-VIEW_W,avgX-VIEW_W/2));
 // redraw dynamic layer
 const dyn=document.createElement('canvas');dyn.width=W;dyn.height=H;const d=dyn.getContext('2d');
 d.drawImage(low,0,0);
 bots.forEach(b=>drawBot(d,b,t));
 ctx.imageSmoothingEnabled=false;
 ctx.clearRect(0,0,cv.width,cv.height);
 ctx.drawImage(dyn,camX,0,VIEW_W,H,0,0,cv.width,cv.height);
 requestAnimationFrame(betterLoop);
}
buildBG();
initBots();
fit();
requestAnimationFrame(betterLoop);
document.getElementById('info').textContent='Click near a bot to nudge it. They wander and can intersect. 3 screens wide – camera follows the group.';
