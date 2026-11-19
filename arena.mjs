export const W=960,H=540;
const groups=[
 ['freeze','Stop moving when the signal turns red.','Red Light','Statue Club','Freeze Frame','Silent Disco','Stop Clock'],
 ['lava','Get inside a glowing pad before the floor erupts.','Floor Is Lava','Hot Foot','Crater Hop','Magma Grid','Last Island'],
 ['sweep','Dodge the moving laser bands.','Laser Sweep','Crossfire','Neon Scissors','Disco Grid','Signal Jam'],
 ['fall','Get clear of the marked impact zones.','Meteor Rain','Bomb Drop','Skyfall','Aftershock','Crate Crash'],
 ['speed','Reach the glowing beacon before time runs out.','Beacon Rush','Sprint Circuit','Checkpoint Chase','Corner Dash','Last Call'],
 ['ring','Stay inside the shrinking ring.','Closing Time','Eye of the Storm','Pressure Cooker','Tiny Planet','Zero Space'],
 ['hunt','Watch for the pink flicker. Vote near the suspect before time runs out.','Imposter Hunt','Ghost Protocol','Double Agent','Hidden Signal','Undercover']
];
export const challenges=groups.flatMap(([kind,tip,...names])=>names.map((name,variant)=>({kind,tip,name,variant})));
export const modes={classic:'Last Player Standing',freeze:"Don’t Move",lava:'Floor Is Lava',hunt:'Imposter Hunt',speed:'Speed Challenge',chaos:'Chaos Mode',team:'Team Battle',daily:'Daily Challenge'};
export const palette=['#a376ff','#f757a7','#32e1bf','#ffa854','#60aaff','#def363','#fd7876'];
const botNames=['Hex','Zip','Glitch','Pixel','Nova','Bloop','Pip','Echo','Orbit'];
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const dist=(x,y,a,b)=>Math.hypot(x-a,y-b);
export function seeded(seed){return ()=>{seed=(Math.imul(1664525,seed)+1013904223)>>>0;return seed/4294967296}}
export function player(id,name,index=0,bot=false){return {id,name,bot,color:palette[index%palette.length],team:index%2,skin:0,x:480,y:270,dx:0,dy:0,last:0,hp:3,alive:true,score:0,react:'',reactUntil:0};}
export function createMatch(roster,mode='classic',solo=false,seed=Date.now(),now=Date.now(),disabled=[]){
 const rng=seeded(seed);
 const available=challenges.filter(c=>mode===c.kind||(mode==='classic'||mode==='chaos'||mode==='daily'||mode==='team')&&c.kind!=='hunt');
 const selected=available.filter(c=>!disabled.includes(c.name));
 const pool=selected.length?selected:available;
 for(let i=pool.length-1;i>0;i--){const j=Math.floor(rng()*(i+1));[pool[i],pool[j]]=[pool[j],pool[i]];}
 const players=roster.map((p,i)=>({...player(p.id,p.name,i),skin:p.skin||0,accessory:p.accessory||0}));
 if(solo)botNames.forEach((name,i)=>players.push(player('bot-'+i,name,i+1,true)));
 players.forEach(p=>p.tiebreak=rng());
 const m={players,mode,round:0,rng,pool,phase:'intro',since:now,frames:[],events:[],winner:[],started:now};
 begin(m,now);
 return m;
}
function begin(m,now){
 m.round++;m.since=now;m.phase='intro';m.c=m.pool[(m.round-1)%m.pool.length];m.duration=m.mode==='chaos'?9500:17600;m.intro=m.mode==='chaos'?1800:3000;
 const seed=m.rng();m.zone={x:220+seed*520,y:155+m.rng()*230};m.pads=Array.from({length:7},(_,i)=>({x:120+(i%4)*238,y:153+Math.floor(i/4)*218+(i%2)*38}));
 m.players.forEach((p,i)=>{const a=i*2.39996;p.x=480+Math.cos(a)*(65+i*8);p.y=270+Math.sin(a)*(62+i*5);p.hit=false;p.danger=0;p.reached=false;p.arrival=Infinity;p.voted=false;p.votes=0;p.jamUntil=0;p.jamUsed=false;p.dx=0;p.dy=0;});
 const alive=m.players.filter(p=>p.alive);
 m.saboteur=alive[Math.floor(m.rng()*alive.length)]?.id;
}
export function hazards(m,t){
 const {kind,variant:v}=m.c, s=t/1000;
 if(kind==='freeze')return {red:s>1.2&&(s+v*.32)%(3.7-v*.23)>2.05-v*.12};
 if(kind==='lava'){const wave=Math.floor(s/(3.9-v*.26));return {pads:m.pads.filter((_,i)=>(i+wave+v)%3!==0),r:76-v*5,hot:s>2.4&&s%(3.9-v*.26)>1.5};}
 if(kind==='sweep')return {bands:[{axis:'x',n:480+Math.sin(s*(.64+v*.16))*535},{axis:'y',n:270+Math.sin(s*(.76+v*.14)+1.8)*320},...(v>1?[{axis:'x',n:480+Math.sin(s*.79+2.6)*530}]:[])],w:14+v*2,hot:s>1.1};
 if(kind==='fall'){
  const wave=Math.floor(s/3),r=62+v*7;
  return {circles:Array.from({length:7+v},(_,i)=>({x:70+(i*169+wave*107+m.zone.x)%820,y:65+(i*147+wave*67+m.zone.y)%410})),r,hot:s%3>2.48};
 }
 if(kind==='speed')return {...m.zone,r:57-v*4};
 if(kind==='ring')return {...m.zone,r:Math.max(36,335-s*(13+v)),hot:s>1.3};
 return {};
}
function dangerous(c,h,p){
 if(c.kind==='freeze')return h.red&&Math.hypot(p.dx,p.dy)>.22;
 if(c.kind==='lava')return h.hot&&!h.pads.some(q=>dist(p.x,p.y,q.x,q.y)<h.r);
 if(c.kind==='sweep')return h.hot&&h.bands.some(b=>Math.abs(p[b.axis]-b.n)<h.w+9);
 if(c.kind==='fall')return h.hot&&h.circles.some(q=>dist(p.x,p.y,q.x,q.y)<h.r);
 if(c.kind==='ring')return h.hot&&dist(p.x,p.y,h.x,h.y)>h.r;
 return false;
}
function steer(m,p,h,now){
 const toward=q=>[q.x-p.x,q.y-p.y];
 let v=[Math.cos(now/760+p.id.length+p.x/145),Math.sin(now/970+p.y/131)];
 if(m.c.kind==='freeze'&&h.red)return [0,0];
 if(m.c.kind==='ring'||m.c.kind==='speed')v=dist(p.x,p.y,h.x,h.y)>Math.max(10,h.r*.35)?toward(h):[0,0];
 if(m.c.kind==='lava'){
  const q=h.pads.reduce((a,b)=>dist(p.x,p.y,a.x,a.y)<dist(p.x,p.y,b.x,b.y)?a:b);
  v=dist(p.x,p.y,q.x,q.y)>17?toward(q):[0,0];
 }
 if(m.c.kind==='fall'){
  const close=h.circles.find(q=>dist(p.x,p.y,q.x,q.y)<h.r+20);
  if(close)v=[p.x-close.x,p.y-close.y];
 }
 if(m.c.kind==='sweep')for(const b of h.bands)if(Math.abs(p[b.axis]-b.n)<70)v=b.axis==='x'?[Math.sign(p.x-b.n),p.y>270?-1:1]:[p.x>480?-1:1,Math.sign(p.y-b.n)];
 if(m.c.kind==='hunt'){
  const target=m.players.find(q=>q.id===m.saboteur);
  if(target!==p){v=toward(target);if(dist(p.x,p.y,target.x,target.y)<76&&m.rng()<.018)vote(m,p);}
 }
 const n=Math.max(1,Math.hypot(...v));return v.map(a=>a/n);
}
export function vote(m,p){
 if(m.phase!=='live'||m.c.kind!=='hunt'||!p.alive||p.voted)return;
 const target=m.players.filter(q=>q.alive&&q!==p).sort((a,b)=>dist(p.x,p.y,a.x,a.y)-dist(p.x,p.y,b.x,b.y))[0];
 if(!target||dist(p.x,p.y,target.x,target.y)>=82)return;
 if(m.saboteur===p.id){if(!p.jamUsed){target.jamUntil=m.now+950;p.jamUsed=true;}}
 else {target.votes++;p.voted=true;}
}
function hit(m,p,now){
 if(p.hit)return;
 p.hp--;p.hit=true;
 if(p.hp<=0){p.alive=false;m.events.push({id:p.id,x:p.x,y:p.y,t:now,name:p.name});}
}
function end(m,now){
 const remaining=m.players.filter(p=>p.alive);
 if(m.mode==='team'&&remaining.length&&remaining.every(p=>p.team===remaining[0].team))m.winner=remaining.map(p=>p.id);
 else {
  const sorted=[...(remaining.length?remaining:m.players)].sort((a,b)=>b.hp-a.hp||b.score-a.score||a.tiebreak-b.tiebreak);
  m.winner=[sorted[0].id];
  if(m.mode==='team')m.winner=m.players.filter(p=>p.team===sorted[0].team).map(p=>p.id);
 }
 m.phase='done';m.since=now;
}
export function tick(m,now,dt=.05){
 if(m.phase==='done')return;
 m.now=now;
 let t=now-m.since;
 if(m.phase==='intro'){if(t<m.intro)return;m.phase='live';m.since=now;t=0;}
 const h=hazards(m,t);
 for(const p of m.players){
  if(!p.alive)continue;
  if(p.bot&&m.c.kind==='hunt'&&m.saboteur===p.id&&m.rng()<.018)vote(m,p);
  let [dx,dy]=p.bot?steer(m,p,h,now):now-p.last<850?[p.dx,p.dy]:[0,0];
  if(p.jamUntil>now){dx=0;dy=0;}
  const n=Math.max(1,Math.hypot(dx,dy));dx/=n;dy/=n;
  const speed=p.bot?120+Number(p.id.slice(4))*10:231;
  p.x=clamp(p.x+dx*speed*dt,15,W-15);p.y=clamp(p.y+dy*speed*dt,15,H-15);
  if(m.c.kind==='freeze'){p.dx=dx;p.dy=dy;}
  const danger=dangerous(m.c,h,p);
  p.danger=danger?p.danger+dt:0;
  if(p.danger>(m.c.kind==='lava'?.52:m.c.kind==='freeze'?.14:.22))hit(m,p,now);
  if(!danger)p.score+=dt;
  if(m.c.kind==='speed'&&!p.reached&&dist(p.x,p.y,h.x,h.y)<h.r){p.reached=true;p.arrival=t;p.score+=Math.max(0,3-t/9000);}
 }
 const living=m.players.filter(p=>p.alive);
 if(living.length<=1||(m.mode==='team'&&living.every(p=>p.team===living[0].team))){end(m,now);return;}
 if(t<m.duration)return;
 const finishers=m.c.kind==='speed'?[...living].filter(p=>p.reached).sort((a,b)=>a.arrival-b.arrival):[];
 const cutoff=m.mode==='speed'&&finishers.length===living.length?Math.max(1,Math.floor(living.length*.75)):finishers.length;
 for(const p of living){
  if(m.c.kind==='speed'&&!finishers.slice(0,cutoff).includes(p))hit(m,p,now);
  if(m.c.kind==='hunt'){
   const suspect=[...living].sort((a,b)=>b.votes-a.votes)[0];
   const caught=suspect.votes>0&&suspect.id===m.saboteur;
   if(caught===(p.id===m.saboteur))hit(m,p,now);
  }
 }
 const max=m.mode==='chaos'?18:10;
 if(m.round===max||m.players.filter(p=>p.alive).length<=1){end(m,now);return;}
 begin(m,now);
}
export function snapshot(m,now,self){
 const t=now-m.since;
 return {phase:m.phase,round:m.round,mode:m.mode,left:Math.max(0,(m.phase==='intro'?m.intro:m.duration)-t),challenge:m.c,hazards:hazards(m,m.phase==='intro'?0:t),events:m.events.slice(-20),winner:m.winner,role:m.c.kind==='hunt'&&self===m.saboteur?'saboteur':'',players:m.players.map(({id,name,bot,skin,accessory,color,team,x,y,hp,alive,score,reached,react,reactUntil,jamUntil})=>({id,name,bot,skin,color,team,x:Math.round(x),y:Math.round(y),hp,alive,score:Math.round(score),reached,jammed:jamUntil>now,clue:m.c.kind==='hunt'&&m.phase==='live'&&id===m.saboteur&&t>3200&&t%3900<360,react:reactUntil>now?react:''}))};
}
