// Fun Village – denser approved-style scene
const W=480,H=320;
const cv=document.getElementById('c'),ctx=cv.getContext('2d');
let S=2;
function fit(){
  const st=document.getElementById('stage');
  const a=st.clientWidth-16, ah=st.clientHeight-16;
  S=Math.max(1,Math.floor(Math.min(a/W,ah/H)));
  cv.width=W*S;cv.height=H*S;
  cv.style.width=(W*S)+'px';cv.style.height=(H*S)+'px';
}
window.addEventListener('resize',fit);fit();

const assets={};
function load(src,name){
  return new Promise(r=>{
    const img=new Image();
    img.onload=()=>{assets[name]=img;r();};
    img.onerror=()=>r();
    img.src=src;
  });
}
async function start(){
  await Promise.all([
    load('assets/house1.png','h1'),
    load('assets/house2.png','h2'),
    load('assets/tree.png','tree'),
    load('assets/fountain.png','fount')
  ]);
  loop();
}
// denser placement closer to approved scene
const items=[
  {k:'tree',x:8,y:8,w:95,h:130},
  {k:'h1',x:25,y:25,w:115,h:145},
  {k:'h2',x:195,y:10,w:115,h:145},
  {k:'tree',x:365,y:5,w:95,h:130},
  {k:'fount',x:175,y:115,w:130,h:110},
  {k:'h1',x:15,y:155,w:105,h:135},
  {k:'h2',x:275,y:140,w:105,h:135},
  {k:'tree',x:130,y:175,w:85,h:115},
  {k:'tree',x:390,y:160,w:80,h:110}
];
function drawImageKnockout(img,x,y,w,h){
  // draw to offscreen to remove near-white
  const oc=document.createElement('canvas');
  oc.width=img.width;oc.height=img.height;
  const octx=oc.getContext('2d');
  octx.drawImage(img,0,0);
  const id=octx.getImageData(0,0,oc.width,oc.height);
  const d=id.data;
  for(let i=0;i<d.length;i+=4){
    if(d[i]>230&&d[i+1]>230&&d[i+2]>230) d[i+3]=0;
  }
  octx.putImageData(id,0,0);
  ctx.drawImage(oc,x,y,w,h);
}
function draw(){
  ctx.imageSmoothingEnabled=false;
  ctx.fillStyle='#5fae4a';
  ctx.fillRect(0,0,cv.width,cv.height);
  // soft variation
  ctx.fillStyle='#6fbe52';
  for(let i=0;i<25;i++) ctx.fillRect(Math.random()*cv.width,Math.random()*cv.height,4,4);
  items.forEach(o=>{
    const img=assets[o.k];
    if(img) drawImageKnockout(img,o.x*S,o.y*S,o.w*S,o.h*S);
  });
}
function loop(){draw();requestAnimationFrame(loop);}
start();
document.getElementById('info').textContent='Denser scene live. White backgrounds removed.';
