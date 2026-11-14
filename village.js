// Fun Village – minimal visible denser pass
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
const items=[
  {k:'tree',x:20,y:10,w:80,h:110},
  {k:'h1',x:40,y:30,w:100,h:130},
  {k:'h2',x:210,y:15,w:100,h:130},
  {k:'tree',x:380,y:5,w:80,h:110},
  {k:'fount',x:190,y:120,w:100,h:90},
  {k:'h1',x:30,y:160,w:90,h:120},
  {k:'h2',x:290,y:140,w:90,h:120},
  {k:'tree',x:150,y:180,w:70,h:100}
];
function draw(){
  ctx.imageSmoothingEnabled=false;
  ctx.fillStyle='#5fae4a';
  ctx.fillRect(0,0,cv.width,cv.height);
  // visible marker
  ctx.fillStyle='#c0392b';
  ctx.fillRect(5*S,5*S,12*S,12*S);
  items.forEach(o=>{
    const img=assets[o.k];
    if(img) ctx.drawImage(img,o.x*S,o.y*S,o.w*S,o.h*S);
  });
}
function loop(){draw();requestAnimationFrame(loop);}
start();
document.getElementById('info').textContent='Minimal visible fix live. Green ground + assets + red marker.';
