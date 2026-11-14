// Fun Village – denser environment pass using pixel assets.
// Map simplified. Bots remain simple for this round.
const W=480,H=320;
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
  return new Promise((resolve,reject)=>{
    const img=new Image();
    img.onload=()=>{assets[name]=img;resolve();};
    img.onerror=()=>resolve(); // continue even if one fails
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

// Fixed reasonable sizes and positions that fit the 480x320 view
const layout=[
  {img:'tree',x:10,y:10,w:90,h:130},
  {img:'house1',x:30,y:40,w:110,h:140},
  {img:'house2',x:200,y:20,w:110,h:140},
  {img:'tree',x:370,y:10,w:90,h:130},
  {img:'fountain',x:180,y:130,w:120,h:100},
  {img:'house1',x:20,y:170,w:100,h:130},
  {img:'house2',x:280,y:150,w:100,h:130},
  {img:'tree',x:140,y:190,w:80,h:110}
];

function drawScene(){
  ctx.imageSmoothingEnabled=false;
  // solid green ground
  ctx.fillStyle='#5fae4a';
  ctx.fillRect(0,0,cv.width,cv.height);
  // light variation
  ctx.fillStyle='#6fbe52';
  for(let i=0;i<30;i++){
    ctx.fillRect(Math.random()*cv.width,Math.random()*cv.height,3,3);
  }
  layout.forEach(o=>{
    const img=assets[o.img];
    if(!img)return;
    ctx.drawImage(img, o.x*S, o.y*S, o.w*S, o.h*S);
  });
  // simple bots
  ctx.fillStyle='#d9a020';
  ctx.fillRect(140*S,110*S,8*S,10*S);
  ctx.fillStyle='#7a5aa8';
  ctx.fillRect(260*S,130*S,8*S,10*S);
}
function loop(){
  drawScene();
  requestAnimationFrame(loop);
}
loadAssets();
document.getElementById('info').textContent='Denser environment pass. Assets loaded. Map simplified. Bots next batch.';
