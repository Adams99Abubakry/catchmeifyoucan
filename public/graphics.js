export const colors=['#a376ff','#f757a7','#32e1bf','#ffa854','#60aaff','#def363','#fd7876'];
const W=960,H=540;
const collections=new WeakMap();
let audio;
export function sound(kind,enabled){
 if(!enabled)return;
 const Audio=window.AudioContext||window.webkitAudioContext;if(!Audio)return;
 audio??=new Audio();if(audio.state==='suspended')audio.resume().catch(()=>{});
 const patterns={round:[320,490],go:[510,760],damage:[190,130],out:[360,220,100],win:[400,510,650,820]};
 (patterns[kind]||[]).forEach((f,i)=>{
  const t=audio.currentTime+i*.1,o=audio.createOscillator(),g=audio.createGain();
  o.type=kind==='damage'?'triangle':'sine';o.frequency.setValueAtTime(f,t);g.gain.setValueAtTime(.0001,t);g.gain.exponentialRampToValueAtTime(.16,t+.016);g.gain.exponentialRampToValueAtTime(.0001,t+.15);
  o.connect(g);g.connect(audio.destination);o.start(t);o.stop(t+.16);
 });
}
function circle(c,x,y,r,fill,stroke,width=2){
 c.beginPath();c.arc(x,y,r,0,Math.PI*2);if(fill){c.fillStyle=fill;c.fill();}if(stroke){c.strokeStyle=stroke;c.lineWidth=width;c.stroke();}
}
function ellipse(c,x,y,rx,ry,fill){
 c.beginPath();c.ellipse(x,y,rx,ry,0,0,Math.PI*2);c.fillStyle=fill;c.fill();
}
function creature(c,p,x,y,now,self,low,mode){
 const tint=p.skin?colors[p.skin]:p.color, bounce=low?0:Math.sin(now/145+p.x/95)*2.6;
 ellipse(c,x,y+13,17,7,'#0806119c');
 if(p.clue)circle(c,x,y,28,null,'#ff75cd',5);
 if(p.jammed)circle(c,x,y,24,null,'#81dcff',4);
 if(p.id===self)circle(c,x,y+2,20,null,'#f7ebff',2);
 if(mode==='team')circle(c,x,y,24,null,p.team?'#ff65b6':'#62ecd9',3);
 c.save();c.translate(x,y+bounce);c.shadowBlur=low?0:14;c.shadowColor=tint;
 const grad=c.createLinearGradient(0,-20,0,19);grad.addColorStop(0,'#f1c5ff');grad.addColorStop(.3,tint);grad.addColorStop(1,'#3f2164');
 if(p.accessory===3){
  c.fillStyle='#eea9ff';c.beginPath();c.moveTo(-13,8);c.quadraticCurveTo(-32,-15,-36,-7);c.quadraticCurveTo(-36,11,-15,15);c.moveTo(13,8);c.quadraticCurveTo(32,-15,36,-7);c.quadraticCurveTo(36,11,15,15);c.fill();
 }
 c.beginPath();c.moveTo(-15,-5);c.quadraticCurveTo(-19,-16,-11,-23);c.quadraticCurveTo(-10,-17,-5,-15);c.quadraticCurveTo(0,-17,7,-15);c.quadraticCurveTo(12,-18,13,-23);c.quadraticCurveTo(19,-14,16,-6);c.bezierCurveTo(26,13,8,22,-6,18);c.bezierCurveTo(-22,16,-24,5,-15,-5);c.fillStyle=grad;c.fill();c.shadowBlur=0;
 c.beginPath();c.moveTo(-15,-4);c.quadraticCurveTo(0,6,15,-4);c.quadraticCurveTo(15,13,0,13);c.quadraticCurveTo(-15,12,-15,-4);c.fillStyle='#160c25';c.fill();
 ellipse(c,-6,4,3,2,'#ffe1ff');ellipse(c,6,4,3,2,'#ffe1ff');
 if(p.accessory===1){c.beginPath();c.ellipse(0,-27,13,4,0,0,Math.PI*2);c.strokeStyle='#b7fcff';c.lineWidth=3;c.stroke();}
 if(p.accessory===2){c.fillStyle='#ffd568';c.beginPath();c.moveTo(-9,-19);c.lineTo(-12,-30);c.lineTo(-5,-25);c.lineTo(0,-33);c.lineTo(5,-25);c.lineTo(12,-30);c.lineTo(9,-19);c.closePath();c.fill();}
 c.fillStyle='#fff';c.textAlign='center';c.font=(p.id===self?'bold ':'')+'13px Inter, sans-serif';c.strokeStyle='#10091a';c.lineWidth=4;const name=p.id===self?'YOU':p.name+(p.bot?' · BOT':'');c.strokeText(name,0,33);c.fillText(name,0,33);
 c.font='bold 17px sans-serif';if(p.react)c.fillText(p.react,0,-36);
 if(p.reached){c.fillStyle='#99ffd3';c.fillText('✓',0,-25);}
 c.restore();
}
export function render(canvas,s,self,low=false,now=performance.now(),motion){
 if(!s)return;
 const c=canvas.getContext('2d');
 let m=collections.get(canvas);
 if(!m){m={pos:new Map(),hits:new Map(),previous:null,received:now};collections.set(canvas,m);}
 if(s!==m.previous){
  m.previous=s;m.received=now;
  for(const e of s.events||[]){const id=e.id+e.t;if(!m.hits.has(id))m.hits.set(id,{...e,created:now});}
  if(m.hits.size>75)m.hits.clear();
 }
 c.save();c.setTransform(canvas.width/W,0,0,canvas.height/H,0,0);
 c.fillStyle='#120c20';c.fillRect(0,0,W,H);
 const g=c.createRadialGradient(480,245,20,480,245,560);g.addColorStop(0,'#302047');g.addColorStop(1,'#170f27');c.fillStyle=g;c.fillRect(0,0,W,H);
 c.strokeStyle='#65478339';c.lineWidth=1;c.beginPath();
 for(let x=0;x<W;x+=40){c.moveTo(x,0);c.lineTo(x,H);}
 for(let y=0;y<H;y+=40){c.moveTo(0,y);c.lineTo(W,y);}
 c.stroke();
 c.lineWidth=3;c.strokeStyle='#7855a2';c.strokeRect(4,4,W-8,H-8);
 if(!low)for(let i=0;i<23;i++){
  const x=(i*137)%W,y=(i*73+7*Math.sin(now/750+i))%H;
  circle(c,x,y,1+i%2,'#b38aff50');
 }
 const h=s.hazards||{},k=s.challenge.kind;
 if(k==='lava'){
  if(h.hot){const lg=c.createLinearGradient(0,0,0,H);lg.addColorStop(0,'#9a1e3900');lg.addColorStop(.5,'#ce2f4659');lg.addColorStop(1,'#ff653754');c.fillStyle=lg;c.fillRect(0,0,W,H);}
  for(const p of h.pads)circle(c,p.x,p.y,h.r,'#393461','#b0acff',4);
 }
 if(k==='ring'){
  c.beginPath();c.rect(0,0,W,H);c.arc(h.x,h.y,h.r,0,Math.PI*2,true);c.fillStyle='#c5376c55';c.fill('evenodd');circle(c,h.x,h.y,h.r,null,'#f698e6',4);
 }
 if(k==='fall')for(const p of h.circles)circle(c,p.x,p.y,h.r,h.hot?'#ff5a8a86':'#ff578a30',h.hot?'#ffe1f2':'#ff789f',3);
 if(k==='sweep')for(const b of h.bands){
  c.fillStyle=h.hot?'#fa62ba70':'#fa62ba35';
  if(b.axis==='x')c.fillRect(b.n-h.w,0,h.w*2,H);else c.fillRect(0,b.n-h.w,W,h.w*2);
  c.fillStyle=h.hot?'#ffe0f5':'#d776bd';
  if(b.axis==='x')c.fillRect(b.n-2,0,4,H);else c.fillRect(0,b.n-2,W,4);
 }
 if(k==='speed'){circle(c,h.x,h.y,h.r,'#61fbb23f','#9dffd8',4);circle(c,h.x,h.y,9,'#b6ffe1');if(!low)circle(c,h.x,h.y,12+((now/22)%22),null,'#b6ffe174',2);}
 if(k==='freeze'){
  c.fillStyle=h.red?'#a0234f39':'#23594328';c.fillRect(0,0,W,H);
  c.strokeStyle=h.red?'#ff597b':'#5be6ae';c.lineWidth=4;c.strokeRect(7,7,W-14,H-14);
 }
 for(const p of [...s.players].sort((a,b)=>a.y-b.y)){
  if(!p.alive){m.pos.delete(p.id);continue;}
  let x=p.x,y=p.y;
  if(p.id===self&&s.phase==='live'&&motion&&!p.jammed&&!h.red){
   const scale=Math.min(22,8+motion.latency*.115)/Math.max(1,Math.hypot(motion.x,motion.y));
   x=Math.max(15,Math.min(W-15,x+motion.x*scale));
   y=Math.max(15,Math.min(H-15,y+motion.y*scale));
  }
  let pos=m.pos.get(p.id);
  if(!pos||Math.hypot(x-pos.x,y-pos.y)>180){pos={x,y};m.pos.set(p.id,pos);}
  else{pos.x+=(x-pos.x)*.27;pos.y+=(y-pos.y)*.27;}
  creature(c,p,pos.x,pos.y,now,self,low,s.mode);
 }
 for(const e of m.hits.values()){
  const t=(now-e.created)/750;if(t>1)continue;
  c.globalAlpha=1-t;
  circle(c,e.x,e.y,10+t*66,null,'#ff8bd7',5);
  if(!low)for(let i=0;i<12;i++){
   const a=i*Math.PI/6,r=8+t*78;circle(c,e.x+Math.cos(a)*r,e.y+Math.sin(a)*r,Math.max(1,5*(1-t)),i%2?'#f47cce':'#b28aff');
  }
  c.font='900 22px sans-serif';c.textAlign='center';c.fillStyle='#ffceec';c.fillText('CAUGHT!',e.x,e.y-20-t*42);
  c.globalAlpha=1;
 }
 if(s.phase==='done'&&s.winner?.includes(self)&&!low){
  for(let i=0;i<36;i++){
   const x=(i*191+Math.sin(now/490+i)*34)%W,y=(i*113+now*(.09+i%6*.014))%H;
   c.save();c.translate(x,y);c.rotate(now/350+i);c.fillStyle=colors[i%colors.length];c.fillRect(-3,-4,8,3);c.restore();
  }
 }
 c.restore();
}
export async function capture(frames,self){
 if(!window.MediaRecorder||!HTMLCanvasElement.prototype.captureStream)throw Error('Video export is unavailable on this browser.');
 const types=['video/mp4','video/webm;codecs=vp9','video/webm'];
 const type=types.find(t=>MediaRecorder.isTypeSupported(t));
 if(!type)throw Error('No supported recording format.');
 const stage=document.createElement('canvas');stage.width=540;stage.height=960;
 const view=document.createElement('canvas');view.width=W;view.height=H;
 const c=stage.getContext('2d'),stream=stage.captureStream(25),rec=new MediaRecorder(stream,{mimeType:type});
 const chunks=[];
 try{
  const result=new Promise((resolve,reject)=>{
   rec.ondataavailable=e=>{if(e.data.size)chunks.push(e.data);};
   rec.onstop=()=>resolve(new Blob(chunks,{type}));rec.onerror=()=>reject(Error('Recording failed.'));
  });
  rec.start();
  await new Promise(resolve=>{
   const start=performance.now();
   const step=now=>{
    const i=Math.floor((now-start)/200);
    render(view,frames[Math.min(i,frames.length-1)],self,false,now);
    c.fillStyle='#180d29';c.fillRect(0,0,540,960);
    c.fillStyle='#ddaeff';c.textAlign='center';c.font='900 49px sans-serif';c.fillText('DON’T GET',270,220);c.fillText('CAUGHT!',270,276);
    c.drawImage(view,0,325,540,304);
    c.fillStyle='#c5b4d6';c.font='600 22px sans-serif';c.fillText('ARENA HIGHLIGHT',270,712);
    if(i>=frames.length)resolve();else requestAnimationFrame(step);
   };
   requestAnimationFrame(step);
  });
  rec.stop();
  const blob=await result,u=URL.createObjectURL(blob),a=document.createElement('a');
  a.href=u;a.download='arena-highlight.'+(type.includes('mp4')?'mp4':'webm');a.click();setTimeout(()=>URL.revokeObjectURL(u),1000);
 }finally{if(rec.state!=='inactive')rec.stop();for(const track of stream.getTracks())track.stop();}
}
