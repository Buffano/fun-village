// Fun Village – denser environment pass using pixel assets.
// Map simplified. Bots remain simple for this round.
const W=480,H=320,VIEW_W=480;
const cv=document.getElementById('c'),ctx=cv.getContext('2d');
let S=2;
function fit(){
  const st=document.getElementById('stage');
  const avail=st.clientWidth-16, availH=st.clientHeight-16;
  S=Math.max(1,Math.floor(Math.min(avail/W,availH/H)));
  cv.width=W*S;cv.height=H*S;
  cv.style.width=(W*S)+'px';cv.style.height=(H*S)+'px';
}
window.addEventListener('resize',fit);fit();

const assets={};
function load(src,name){
  return new Promise(r=>{
    const img=new Image();
    img.onload=()=>{assets[name]=img;r();};
    img.src=src;
  });
}
async function loadAssets(){
  await Promise.all([
    load('assets/house1.png','house1'),
    load('assets/house2.png','house2'),
    load('assets/tree.png','tree'),
    load('assets/fountain.png','fountain')
  ]);
  loop();
}

// Simplified denser layout positions
const layout=[
  {img:'tree',x:40,y:30,s:0.35},
  {img:'house1',x:80,y:60,s:0.28},
  {img:'house2',x:220,y:50,s:0.28},
  {img:'tree',x:360,y:20,s:0.35},
  {img:'fountain',x:190,y:140,s:0.4},
  {img:'house1',x:40,y:180,s:0.26},
  {img:'house2',x:280,y:170,s:0.26},
  {img:'tree',x:150,y:200,s:0.3},
  {img:'tree',x:400,y:150,s:0.32}
];

function drawScene(t){
  ctx.imageSmoothingEnabled=false;
  ctx.fillStyle='#5fae4a';
  ctx.fillRect(0,0,cv.width,cv.height);
  // simple ground variation
  for(let i=0;i<40;i++){
    ctx.fillStyle=Math.random()>0.5?'#6fbe52':'#4e9a40';
    ctx.fillRect(Math.random()*cv.width,Math.random()*cv.height,4,4);
  }
  layout.forEach(o=>{
    const img=assets[o.img];
    if(!img)return;
    const dw=img.width*o.s*S, dh=img.height*o.s*S;
    ctx.drawImage(img,o.x*S,o.y*S,dw,dh);
  });
  // simple bots placeholder
  ctx.fillStyle='#d9a020';
  ctx.fillRect(120*S,100*S,8*S,10*S);
  ctx.fillStyle='#7a5aa8';
  ctx.fillRect(250*S,120*S,8*S,10*S);
}
function loop(){
  drawScene(performance.now());
  requestAnimationFrame(loop);
}
loadAssets();
document.getElementById('info').textContent='Denser environment pass. Assets loaded. Map simplified. Bots next batch.';
