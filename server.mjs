import {createServer} from 'node:http';
import {randomBytes,randomUUID,createHash,scrypt,timingSafeEqual} from 'node:crypto';
import {promisify} from 'node:util';
import {pathToFileURL} from 'node:url';
import {readFileSync,readdirSync,createReadStream,statSync} from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import {commerce} from './commerce.mjs';
import {WebSocketServer} from 'ws';
import {createMatch,tick,snapshot,vote,modes,challenges} from './arena.mjs';

const hash=s=>createHash('sha256').update(s).digest('hex');
const pwd=promisify(scrypt);
export const skins=['Rift Runner','Bubblegum','Acid Byte','Solar Flare','Ice Core','Golden Glitch','Cherry Bomb'];
const reactions=['🔥','😂','💀','👏','😱','🫡','👻','⚡','👑'];
const reactionCount=xp=>Math.min(reactions.length,6+Math.floor(xp/320));
const accessories=[{name:'None',level:1},{name:'Neon Halo',level:3},{name:'Pixel Crown',level:6},{name:'Rift Wings',level:10}];
const codes='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const daily=()=>new Date().toISOString().slice(0,10);
const week=()=>Math.floor((Date.now()+3*86400000)/604800000);
const season=()=>daily().slice(0,7);
const settings=['announcement','tournament','disabledModes','cosmeticPrices','disabledChallenges'];
const mime={html:'text/html; charset=utf-8',css:'text/css',js:'text/javascript',svg:'image/svg+xml',webp:'image/webp',png:'image/png',webmanifest:'application/manifest+json'};
const root=new URL('./public/',import.meta.url);
function requestOrigin(req){
 const host=process.env.TRUST_PROXY==='1'?(req.headers['x-forwarded-host']||req.headers.host):req.headers.host;
 const https=process.env.TRUST_PROXY==='1'&&req.headers['x-forwarded-proto']==='https';
 return process.env.PUBLIC_ORIGIN||`${https?'https':'http'}://${host}`;
}
const clean=s=>String(s??'').trim();
function fail(e,status=400){throw Object.assign(Error(e),{status});}
async function rawBody(req,max=8192){
 let size=0,parts=[];
 for await(const part of req){size+=part.length;if(size>max)fail('Request too large',413);parts.push(part);}
 return Buffer.concat(parts);
}
async function body(req){
 const raw=await rawBody(req);
 try {const b=JSON.parse(raw);if(!b||Array.isArray(b)||typeof b!=='object')throw Error();return b;}catch{fail('Invalid request');}
}
export function createApp({database=process.env.DB_PATH||'game.sqlite',origin=process.env.PUBLIC_ORIGIN,adminKey=process.env.ADMIN_KEY,clock=Date.now}={}){
 const shop=commerce(process.env,origin);
 const db=new DatabaseSync(database);
 db.exec('PRAGMA foreign_keys=ON; PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000; CREATE TABLE IF NOT EXISTS schema_version(version TEXT PRIMARY KEY);');
 const q=(sql,...p)=>db.prepare(sql).all(...p), get=(sql,...p)=>db.prepare(sql).get(...p), run=(sql,...p)=>db.prepare(sql).run(...p);
 const transaction=fn=>{db.exec('BEGIN IMMEDIATE');try{const result=fn();db.exec('COMMIT');return result;}catch(e){db.exec('ROLLBACK');throw e;}};
 const migrations=new URL('./migrations/',import.meta.url);
 for(const f of readdirSync(migrations).filter(f=>f.endsWith('.sql')).sort())if(!get('SELECT 1 FROM schema_version WHERE version=?',f))transaction(()=>{db.exec(readFileSync(new URL(f,migrations),'utf8'));run('INSERT INTO schema_version VALUES (?)',f);});
 const rooms=new Map(),memberships=new Map(),sockets=new Map(),rates=new Map();
 const ip=req=>process.env.TRUST_PROXY==='1'?String(req.headers['x-forwarded-for']||req.socket.remoteAddress).split(',').at(-1).trim():req.socket.remoteAddress;
 function limit(key,max=100,window=60000){
  const now=Date.now(),r=rates.get(key);
  if(!r||r.end<now){rates.set(key,{n:1,end:now+window});return true;}
  return ++r.n<=max;
 }
 const setting=(key,fallback='')=>get('SELECT value FROM settings WHERE key=?',key)?.value??fallback;
 const enabled=mode=>Object.hasOwn(modes,mode)&&!setting('disabledModes').split(',').map(x=>x.trim()).includes(mode);
 const user=id=>get('SELECT * FROM users WHERE id=?',id);
 function auth(req){
  const token=(req.headers.cookie||'').match(/(?:^|; )dgc=([a-f0-9]{64})(?:;|$)/)?.[1];
  return token&&get('SELECT users.* FROM sessions JOIN users ON uid=users.id WHERE token=? AND expires>? AND banned=0',hash(token),Date.now());
 }
 function issue(res,id){
  const token=randomBytes(32).toString('hex'),ttl=30*86400;
  run('INSERT INTO sessions VALUES (?,?,?)',hash(token),id,Date.now()+ttl*1000);
  res.setHeader('Set-Cookie',`dgc=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${ttl}${origin?.startsWith('https:')?'; Secure':''}`);
 }
 function profile(id){
  const {name,country,xp,coins,skin,accessory,email}=user(id);
  const totals=get('SELECT COUNT(*) matches, COALESCE(SUM(win),0) wins FROM results WHERE uid=?',id);
  const level=1+Math.floor(xp/160);
  const rankPoints=get('SELECT COALESCE(SUM(12 + win * 48),0) AS points FROM results WHERE uid=? AND online=1',id).points;
  const rank=['Rookie','Bronze','Silver','Gold','Platinum','Diamond','Legendary'][[0,60,180,420,900,1800,3600].findLastIndex(n=>n<=rankPoints)];
  const history=q('SELECT mode,win,rounds,score,online,created FROM results WHERE uid=? ORDER BY created DESC,rowid DESC LIMIT 20',id);
  const pass=!!get('SELECT 1 FROM passes WHERE uid=? AND season=?',id,season());
  const seasonWins=get('SELECT COALESCE(SUM(win),0) n FROM results WHERE uid=? AND online=1 AND substr(created,1,7)=?',id,season()).n;
  const unlocked=[0,...q('SELECT skin FROM unlocks WHERE uid=?',id).map(r=>r.skin)];
  const missions=[
   {id:'daily',period:daily(),title:'Enter the arena',goal:2,reward:35,progress:get('SELECT COUNT(*) n FROM results WHERE uid=? AND date(created)=?',id,daily()).n},
   {id:'weekly',period:String(week()),title:'Win three matches',goal:3,reward:100,progress:get("SELECT COUNT(*) n FROM results WHERE uid=? AND win=1 AND CAST((unixepoch(created)+259200)/604800 AS INTEGER)=?",id,week()).n}
  ].map(m=>({...m,claimed:!!get('SELECT 1 FROM claims WHERE uid=? AND mission=? AND period=?',id,m.id,m.period)}));
  const friends=q('SELECT users.id,users.name FROM friends JOIN users ON friend=users.id WHERE uid=?',id);
  return {id,name,country,xp,coins,skin,accessory,emotes:reactions.slice(0,reactionCount(xp)),registered:!!email,level,rank,rankPoints,matches:totals.matches,wins:totals.wins,losses:totals.matches-totals.wins,history,unlocked,pass,seasonWins,missions,friends,achievements:[{name:'First Blood',earned:totals.wins>=1},{name:'Arena Regular',earned:totals.matches>=10},{name:'Uncatchable',earned:totals.wins>=25}],season:season()};
 }
 const prices=()=>{try{return JSON.parse(setting('cosmeticPrices','[0,60,95,130,180,240,320]'));}catch{return [0,60,95,130,180,240,320];}};
 const send=(ws,data)=>{if(ws?.readyState===1&&ws.bufferedAmount<524288)ws.send(JSON.stringify(data));};
 const tell=(id,data)=>send(sockets.get(id),data);
 function roomView(r,id){return {type:'room',code:r.code,mode:r.mode,solo:r.solo,private:r.private,started:!!r.match,host:r.host,self:id,players:[...r.roster.values()].map(p=>({id:p.id,name:p.name,online:sockets.has(p.id)})),countdown:r.startAt?Math.max(0,r.startAt-Date.now()):null};}
 function broadcast(r){for(const id of new Set([...r.roster.keys(),...r.watch]))tell(id,roomView(r,id));}
 function queue(r){
  if(r.private||r.solo||r.match)return;
  const count=[...r.roster.keys()].filter(id=>r.online.has(id)).length;
  if(count<2)r.startAt=null;
  else r.startAt??=Date.now()+9000;
 }
 function leave(id){
  const r=memberships.get(id);if(!r)return;
  memberships.delete(id);r.watch.delete(id);
  r.online.delete(id);
  if(!r.match||r.match.phase==='done')r.roster.delete(id);
  else {const p=r.match.players.find(p=>p.id===id);if(p){p.dx=0;p.dy=0;}}
  if(!r.match&&r.host===id)r.host=r.roster.keys().next().value;
  if(!r.online.size)r.emptyAt=Date.now();
  queue(r);broadcast(r);
 }
 function enter(u,message){
  const tournament=message.tournament&&get('SELECT * FROM tournaments WHERE id=? AND cancelled=0 AND opens<=? AND closes>?',clean(message.tournament),Date.now(),Date.now());
  if(message.tournament&&(!tournament||message.action!=='find'))fail('This tournament is closed.');
  const mode=tournament?.mode||message.mode||'classic';const action=message.action;
  let r;
  if(action==='join'||action==='watch'){
   r=rooms.get(clean(message.code).toUpperCase());
   if(!r||r.solo)fail('Room code not found.');
   if(action==='join'&&r.match&&!r.roster.has(u.id))fail('Match in progress. You can spectate.');
   if(!r.roster.has(u.id)&&action==='join'&&r.roster.size>=20)fail('Room is full.');
   if(action==='watch'&&r.watch.size>=40&&!r.watch.has(u.id))fail('Spectator seats are full.');
  }else{
   if(!['solo','create','find'].includes(action)||!enabled(mode))fail('This mode is unavailable.');
   if(action==='find')r=[...rooms.values()].find(x=>!x.match&&!x.private&&!x.solo&&x.mode===mode&&x.tournament===(tournament?.id??null)&&x.roster.size<20);
   if(!r){
    if(rooms.size>=500)fail('The arena is at capacity. Try again shortly.',503);
    let code;do{code=Array.from(randomBytes(6),n=>codes[n%32]).join('');}while(rooms.has(code));
    r={code,mode,tournament:tournament?.id??null,private:action==='create',solo:action==='solo',roster:new Map(),watch:new Set(),online:new Set(),host:u.id,id:randomUUID(),created:Date.now()};
    rooms.set(code,r);
   }
  }
  if(memberships.get(u.id)!==r)leave(u.id);
  memberships.set(u.id,r);r.online.add(u.id);r.emptyAt=null;
  if(action==='watch'&&!r.roster.has(u.id))r.watch.add(u.id);
  else {r.watch.delete(u.id);r.roster.set(u.id,{id:u.id,name:u.name,skin:u.skin,accessory:u.accessory});}
  if(r.solo&&!r.match)start(r);
  queue(r);broadcast(r);
 }
 function start(r){
  if(r.match)return;
  if(r.tournament&&!get('SELECT 1 FROM tournaments WHERE id=? AND cancelled=0 AND closes>?',r.tournament,Date.now()))fail('This tournament is closed.');
  if([...r.roster.keys()].filter(id=>r.online.has(id)).length<(r.solo?1:2))fail('At least two players must be connected.');
  for(const id of r.roster.keys())if(!r.online.has(id)){r.roster.delete(id);memberships.delete(id);}
  r.match=createMatch([...r.roster.values()],r.mode,r.solo,r.mode==='daily'?Number(daily().replaceAll('-','')):randomBytes(4).readUInt32BE(),clock(),setting('disabledChallenges').split(',').map(x=>x.trim()));
  r.startAt=null;r.replay=[];broadcast(r);
 }
 function record(r){
  transaction(()=>{
   for(const p of r.match.players.filter(p=>!p.bot)){
    const win=Number(r.match.winner.includes(p.id));
    const first=!get('SELECT 1 FROM results WHERE uid=? AND online=1',p.id);
    const inserted=run('INSERT OR IGNORE INTO results(match,uid,mode,win,rounds,score,online,tournament) VALUES(?,?,?,?,?,?,?,?)',r.id,p.id,r.mode,win,r.match.round,Math.round(p.score),Number(!r.solo),r.tournament);
    if(!inserted.changes)continue;
    run('UPDATE users SET xp=xp+?,coins=coins+? WHERE id=?',15+r.match.round*9+win*36,8+r.match.round*2+win*20,p.id);
    const ref=user(p.id).ref;
    if(ref&&first&&!r.solo)run('INSERT OR IGNORE INTO unlocks VALUES (?,?)',ref,6);
   }
  });
  r.recorded=true;
 }
 let frame=0;
 const loop=setInterval(()=>{
  const now=clock();frame++;
  for(const [code,r] of rooms){
   if((r.emptyAt&&Date.now()-r.emptyAt>120000)||(r.finished&&Date.now()-r.finished>900000)||(!r.match&&Date.now()-r.created>3600000)){
    for(const id of new Set([...r.roster.keys(),...r.watch]))if(memberships.get(id)===r){memberships.delete(id);tell(id,{type:'left'});}
    rooms.delete(code);continue;
   }
   if(!r.match){
    for(const id of r.roster.keys())if(!r.online.has(id)&&Date.now()-(r.disconnected?.get(id)||0)>45000){r.roster.delete(id);if(memberships.get(id)===r)memberships.delete(id);if(r.host===id)r.host=r.roster.keys().next().value;broadcast(r);}
   }
   if(r.startAt&&Date.now()>=r.startAt){try{start(r);}catch{r.startAt=null;broadcast(r);}}
   if(!r.match)continue;
   const before=r.match.phase;
   tick(r.match,now);
   if(r.match.phase==='done'&&!r.recorded)try{record(r);r.finished=Date.now();}catch(e){console.error('Result persistence failed',e.message);continue;}
   if(frame%2===0||before!==r.match.phase){
    if((r.match.phase!=='done'&&frame%4===0)||before!==r.match.phase&&r.match.phase==='done'){const s=snapshot(r.match,now,'');r.replay.push({phase:s.phase,challenge:s.challenge,hazards:s.hazards,events:s.events.slice(-1),players:s.players});if(r.replay.length>45)r.replay.shift();}
    if(r.match.phase==='done'&&before==='done')continue;
    for(const id of r.online)tell(id,{type:'state',...snapshot(r.match,now,id)});
   }
  }
  if(frame%1200===0){for(const [key,r] of rates)if(r.end<Date.now())rates.delete(key);run('DELETE FROM sessions WHERE expires<?',Date.now());}
 },50);
 loop.unref();
 const server=createServer(async(req,res)=>{
  const url=new URL(req.url,'http://localhost');
  res.setHeader('X-Content-Type-Options','nosniff');
  res.setHeader('Referrer-Policy','same-origin');
  res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: blob:; media-src 'self' blob:; connect-src 'self' ws: wss:; object-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'");
  if(origin?.startsWith('https:'))res.setHeader('Strict-Transport-Security','max-age=31536000');
  const json=(status,data)=>{res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify(data));};
  try{
   if(url.pathname==='/health'){json(200,{ok:true});return;}
   if(!url.pathname.startsWith('/api/')){
    const file=url.pathname==='/'||url.pathname==='/admin'?'index.html':url.pathname.slice(1);
    if(!['GET','HEAD'].includes(req.method)||!/^[a-z0-9.-]+$/i.test(file)||!mime[file.split('.').at(-1)])fail('Not found',404);
    const path=new URL(file,root);let st;try{st=statSync(path);}catch{fail('Not found',404);}
    res.writeHead(200,{'Content-Type':mime[file.split('.').at(-1)],'Content-Length':st.size,'Cache-Control':file.endsWith('.webp')?'public,max-age=86400':'no-cache'});
    if(req.method==='HEAD')res.end();else createReadStream(path).pipe(res);return;
   }
   if(!limit('http:'+ip(req),220))fail('Slow down and try again.',429);
   if(req.method==='POST'&&req.headers.origin&&req.headers.origin!==(origin||requestOrigin(req)))fail('Invalid origin',403);
   const route=req.method+' '+url.pathname;
   let u=auth(req);
   if(route==='POST /api/stripe-webhook'){
    const event=shop.verify(await rawBody(req,262144),req.headers['stripe-signature']);
    if(!event)fail('Invalid webhook signature.',400);
    const x=event.data?.object,m=x?.metadata;
    if(event.type==='checkout.session.completed'&&x.payment_status==='paid'&&x.mode==='payment'&&typeof x.id==='string'&&typeof x.client_reference_id==='string'&&user(x.client_reference_id)&&m&&['premium','pass'].includes(m.sku)&&/^\d{4}-\d{2}$/.test(m.season)&&x.amount_total===Number(m.amount)&&x.currency===m.currency){
     transaction(()=>{
      if(!run('INSERT OR IGNORE INTO purchases(checkout,uid,sku,amount,currency) VALUES(?,?,?,?,?)',x.id,x.client_reference_id,m.sku,x.amount_total,x.currency).changes)return;
      if(m.sku==='premium')run('INSERT OR IGNORE INTO unlocks VALUES (?,?)',x.client_reference_id,5);
      else run('INSERT OR IGNORE INTO passes VALUES (?,?)',x.client_reference_id,m.season);
     });
    }
    json(200,{ok:true});return;
   }
   if(route==='POST /api/guest'){
    if(!u){
     if(!limit('guest:'+ip(req),15))fail('Too many new sessions',429);
     const b=await body(req),id=randomUUID(),ref=user(clean(b.ref))?.id??null;
     run('INSERT INTO users(id,name,ref) VALUES(?,?,?)',id,'Runner '+id.slice(0,4).toUpperCase(),ref);issue(res,id);u=user(id);
    }
    json(200,profile(u.id));return;
   }
   if(route==='POST /api/logout'){
    const token=(req.headers.cookie||'').match(/(?:^|; )dgc=([a-f0-9]{64})(?:;|$)/)?.[1];
    if(token)run('DELETE FROM sessions WHERE token=?',hash(token));
    if(u){leave(u.id);sockets.get(u.id)?.close(4003,'Signed out');}
    res.setHeader('Set-Cookie','dgc=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0');
    json(200,{ok:true});return;
   }
   if(route==='POST /api/login'||route==='POST /api/register'){
    if(!limit('auth:'+ip(req),8))fail('Try again in a minute.',429);
    const b=await body(req),email=clean(b.email).toLowerCase(),password=String(b.password??'');
    if(!/^[^ @]+@[^ @]+\.[^ @]+$/.test(email)||email.length>180||password.length<10||password.length>128)fail('Enter an email and a password of 10–128 characters.');
    if(route.endsWith('register')){
     if(!u||u.email)fail('Start with a guest profile first.');
     const salt=randomBytes(16).toString('hex'),digest=(await pwd(password,salt,64)).toString('hex');
     if(get('SELECT 1 FROM users WHERE email=?',email))fail('This email is already registered.',409);
     run('UPDATE users SET email=?,password=? WHERE id=? AND email IS NULL',email,salt+':'+digest,u.id);issue(res,u.id);
    }else{
     const account=get('SELECT * FROM users WHERE email=?',email),[salt,digest]=(account?.password||'dummy:'+('0'.repeat(128))).split(':');
     const check=await pwd(password,salt,64);
     if(!timingSafeEqual(check,Buffer.from(digest,'hex'))||!account||account.banned)fail('Invalid email or password.',401);
     u=account;issue(res,u.id);
    }
    json(200,profile(u.id));return;
   }
   if(route==='GET /api/config'){json(200,{modes:Object.fromEntries(Object.entries(modes).filter(([mode])=>enabled(mode))),challenges:challenges.filter(x=>!setting('disabledChallenges').split(',').map(y=>y.trim()).includes(x.name)),skins,accessories,prices:prices(),products:shop.products,announcement:setting('announcement'),tournament:setting('tournament'),events:q('SELECT id,name,mode,opens,closes FROM tournaments WHERE cancelled=0 ORDER BY opens DESC LIMIT 12'),rooms:[...rooms.values()].filter(r=>!r.private&&!r.solo&&!r.match).length});return;}
   if(!u)fail('Sign in to continue.',401);
   if(route==='GET /api/profile'){json(200,profile(u.id));return;}
   if(route==='GET /api/tournament'){
    const id=url.searchParams.get('id');
    if(!get('SELECT 1 FROM tournaments WHERE id=? AND cancelled=0',id))fail('Tournament unavailable.',404);
    json(200,q('SELECT users.id,name,SUM(win) wins,COUNT(*) matches,SUM(score) score FROM results JOIN users ON uid=users.id WHERE tournament=? AND banned=0 GROUP BY users.id ORDER BY wins DESC,score DESC,users.id LIMIT 50',id));return;
   }
   if(route==='GET /api/leaderboard'){
    const filter=url.searchParams.get('scope'),period=url.searchParams.get('period');
    const where=filter==='national'?'AND country=?':filter==='friends'?'AND (users.id=? OR users.id IN (SELECT friend FROM friends WHERE uid=?))':'';
    const args=filter==='national'?[u.country]:filter==='friends'?[u.id,u.id]:[];
    const time=period==='daily'?"AND mode='daily' AND date(results.created)=?":period==='season'?'AND substr(results.created,1,7)=?':'';
    if(time)args.unshift(period==='daily'?daily():season());
    json(200,q(`SELECT users.id,name,country,SUM(win) wins,COUNT(*) matches,SUM(score) score FROM results JOIN users ON uid=users.id WHERE online=1 AND banned=0 ${time} ${where} GROUP BY users.id ORDER BY wins DESC,score DESC,users.id LIMIT 50`,...args));return;
   }
   if(route==='GET /api/admin'||route==='POST /api/admin'){
    const key=req.headers['x-admin-key'];
    if(!u.email||!adminKey||!key||!timingSafeEqual(Buffer.from(hash(adminKey)),Buffer.from(hash(key))))fail('Admin access denied',403);
    if(req.method==='POST'){
     const b=await body(req);
     if(b.action==='setting'&&settings.includes(b.key)&&typeof b.value==='string'&&b.value.length<2000){
      if(b.key==='disabledChallenges'&&b.value.split(',').map(x=>x.trim()).filter(Boolean).some(name=>!challenges.some(c=>c.name===name)))fail('Enter existing challenge names separated by commas.');
      if(b.key==='disabledModes'&&b.value.split(',').map(x=>x.trim()).filter(Boolean).some(mode=>!Object.hasOwn(modes,mode)))fail('Enter existing mode IDs separated by commas.');
      if(b.key==='cosmeticPrices'){let list;try{list=JSON.parse(b.value);}catch{fail('Enter a JSON list of prices.');}if(!Array.isArray(list)||list.length!==skins.length||list.some(n=>!Number.isInteger(n)||n<0||n>100000))fail('Enter one integer price per cosmetic.');}
      run('INSERT INTO settings VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value',b.key,b.value);
     }else if(b.action==='create-tournament'){
      const name=clean(b.name),opens=Date.parse(b.opens),closes=Date.parse(b.closes);
      if(name.length<3||name.length>70||!enabled(b.mode)||!Number.isFinite(opens)||!Number.isFinite(closes)||closes<=Math.max(Date.now(),opens+300000)||closes-opens>31*86400000)fail('Enter a name, enabled mode, and a schedule lasting 5 minutes to 31 days.');
      run('INSERT INTO tournaments(id,name,mode,opens,closes) VALUES(?,?,?,?,?)',randomUUID(),name,b.mode,opens,closes);
     }else if(b.action==='cancel-tournament'){
      run('UPDATE tournaments SET cancelled=1 WHERE id=?',clean(b.id));
     }else if(b.action==='ban'){
      const target=user(clean(b.id));if(!target||target.id===u.id)fail('Invalid player.');
      run('UPDATE users SET banned=? WHERE id=?',Number(!!b.ban),target.id);
      if(b.ban){run('DELETE FROM sessions WHERE uid=?',target.id);leave(target.id);sockets.get(target.id)?.close(4003,'Account suspended');}
     }else if(b.action==='resolve'){run("UPDATE reports SET status='closed' WHERE id=?",Number(b.id)||0);}
     else fail('Unknown admin action.');
    }
    json(200,{players:get('SELECT COUNT(*) n FROM users').n,active:sockets.size,rooms:rooms.size,matches:get('SELECT COUNT(DISTINCT match) n FROM results').n,events:q('SELECT * FROM tournaments ORDER BY opens DESC LIMIT 30'),revenueEnabled:!!shop.products.length,revenue:q('SELECT currency, SUM(amount) amount, COUNT(*) purchases FROM purchases GROUP BY currency'),users:q('SELECT id,name,country,banned,created FROM users ORDER BY created DESC LIMIT 100'),reports:q('SELECT * FROM reports ORDER BY id DESC LIMIT 100'),engagement:q("SELECT mode,COUNT(DISTINCT match) matches,COUNT(DISTINCT uid) players FROM results WHERE created>=datetime('now','-7 days') GROUP BY mode ORDER BY matches DESC"),settings:Object.fromEntries(settings.map(k=>[k,setting(k)]))});return;
   }
   if(req.method!=='POST')fail('Not found',404);
   const b=await body(req);
   if(route==='POST /api/checkout'){
    if(!u.email)fail('Secure your guest account before purchasing.',403);
    if(!limit('purchase:'+u.id,4))fail('Please wait before opening another checkout.',429);
    if(b.sku==='premium'&&get('SELECT 1 FROM unlocks WHERE uid=? AND skin=5',u.id)||b.sku==='pass'&&get('SELECT 1 FROM passes WHERE uid=? AND season=?',u.id,season()))fail('You already own this item.',409);
    json(200,{url:await shop.checkout(u,b.sku,season())});return;
   }else if(route==='POST /api/pass-reward'){
    const skin=Number(b.skin),goal={4:1,6:5}[skin],p=profile(u.id);
    if(!goal||!p.pass||p.seasonWins<goal)fail('Season reward is locked.');
    run('INSERT OR IGNORE INTO unlocks VALUES (?,?)',u.id,skin);
   }else if(route==='POST /api/profile'){
    const n=clean(b.name),c=clean(b.country).toUpperCase();
    if(!/^[\p{L}\p{N} _-]{2,18}$/u.test(n)||!/^[A-Z]{2}$/.test(c))fail('Use 2–18 letters or numbers and a two-letter country code.');
    run('UPDATE users SET name=?,country=? WHERE id=?',n,c,u.id);
   }else if(route==='POST /api/accessory'){
    const id=b.id,item=Number.isInteger(id)&&accessories[id];
    if(!item||u.xp<(item.level-1)*160)fail('Accessory is locked.');
    run('UPDATE users SET accessory=? WHERE id=?',id,u.id);
   }else if(route==='POST /api/cosmetic'){
    const skin=b.skin;if(!Number.isInteger(skin)||!skins[skin])fail('Cosmetic unavailable.');
    transaction(()=>{
     if(skin&&!get('SELECT 1 FROM unlocks WHERE uid=? AND skin=?',u.id,skin)){
      const cost=prices()[skin];if(!run('UPDATE users SET coins=coins-? WHERE id=? AND coins>=?',cost,u.id,cost).changes)fail('You need more coins.');
      run('INSERT INTO unlocks VALUES (?,?)',u.id,skin);
     }
     run('UPDATE users SET skin=? WHERE id=?',skin,u.id);
    });
   }else if(route==='POST /api/mission'){
    const m=profile(u.id).missions.find(m=>m.id===b.id);
    if(!m||m.progress<m.goal)fail('Mission is incomplete.');
    transaction(()=>{if(run('INSERT OR IGNORE INTO claims VALUES (?,?,?)',u.id,m.id,m.period).changes)run('UPDATE users SET coins=coins+? WHERE id=?',m.reward,u.id);});
   }else if(route==='POST /api/friend'){
    const id=clean(b.id);if(id===u.id||!user(id))fail('Player not found.',404);
    run('INSERT OR IGNORE INTO friends VALUES (?,?)',u.id,id);
   }else if(route==='POST /api/report'){
    const id=clean(b.id),reason=clean(b.reason);if(id===u.id||!user(id)||reason.length<3||reason.length>280)fail('Enter a valid player and reason.');
    if(!limit('report:'+u.id,3))fail('Report limit reached.',429);
    run('INSERT INTO reports(uid,target,reason) VALUES (?,?,?)',u.id,id,reason);
   }else fail('Not found',404);
   json(200,profile(u.id));
  }catch(e){if(!e.status)console.error(e);if(!res.headersSent)json(e.status||500,{error:e.status?e.message:'Something went wrong.'});else res.end();}
 });
 server.requestTimeout=15000;
 const wss=new WebSocketServer({noServer:true,maxPayload:2048,perMessageDeflate:false});
 server.on('upgrade',(req,socket,head)=>{
  const expected=origin||requestOrigin(req);
  if(req.url!=='/live'||req.headers.origin!==expected||!limit('ws:'+ip(req),40)){socket.destroy();return;}
  const u=auth(req);if(!u){socket.destroy();return;}
  wss.handleUpgrade(req,socket,head,ws=>wss.emit('connection',ws,u));
 });
 wss.on('connection',(ws,u)=>{
  sockets.get(u.id)?.close(4001,'Opened in another tab');
  sockets.set(u.id,ws);ws.alive=true;
  ws.on('pong',()=>ws.alive=true);
  ws.on('error',()=>{});
  send(ws,{type:'ready',id:u.id});
  const existing=memberships.get(u.id);
  if(existing){
   existing.online.add(u.id);existing.disconnected?.delete(u.id);existing.emptyAt=null;queue(existing);broadcast(existing);
   if(existing.match)send(ws,{type:'state',...snapshot(existing.match,clock(),u.id)});
  }
  ws.on('message',raw=>{
   try{
    if(!limit('msg:'+u.id,200,5000)){ws.close(4008,'Too many messages');return;}
    const m=JSON.parse(raw);const r=memberships.get(u.id),p=r?.match?.players.find(p=>p.id===u.id),now=clock();
    if(m.type==='ping'&&Number.isFinite(m.at)){send(ws,{type:'pong',at:m.at});}
    else if(m.type==='enter'){
     if(!limit('room:'+u.id,12))fail('Room request limit reached.');
     enter(user(u.id),m);
    }else if(m.type==='leave'){leave(u.id);send(ws,{type:'left'});}
    else if(m.type==='start'&&r?.host===u.id){start(r);}
    else if(m.type==='input'&&p?.alive&&Number.isFinite(m.x)&&Number.isFinite(m.y)){p.dx=Math.max(-1,Math.min(1,m.x));p.dy=Math.max(-1,Math.min(1,m.y));p.last=now;}
    else if(m.type==='vote'&&p){vote(r.match,p);}
    else if(m.type==='reaction'&&p&&reactions.includes(m.emoji)&&p.reactUntil<now&&reactions.indexOf(m.emoji)<reactionCount(user(u.id).xp)){p.react=m.emoji;p.reactUntil=now+1800;}
    else if(m.type==='replay'&&r?.match?.phase==='done'&&limit('replay:'+u.id,6)){send(ws,{type:'replay',frames:r.replay});}
    else if(m.type==='rematch'&&r?.match?.phase==='done'){
     if(r.solo){enter(user(u.id),{action:'solo',mode:r.mode});}
     else if(r.host===u.id){
      if(r.tournament&&!get('SELECT 1 FROM tournaments WHERE id=? AND cancelled=0 AND closes>?',r.tournament,Date.now()))fail('This tournament is closed.');
      if([...r.roster.keys()].filter(id=>r.online.has(id)).length<2)fail('Two players must be connected for a rematch.');
      r.id=randomUUID();r.match=null;r.recorded=false;r.finished=null;start(r);
     }else{tell(r.host,{type:'notice',message:`${user(u.id).name} requested a rematch.`});send(ws,{type:'notice',message:'Rematch request sent.'});}
    }
   }catch(e){send(ws,{type:'error',message:e.status?e.message:'Invalid game message.'});}
  });
  ws.on('close',()=>{
   if(sockets.get(u.id)!==ws)return;
   sockets.delete(u.id);
   const r=memberships.get(u.id);
   if(r){(r.disconnected??=new Map()).set(u.id,Date.now());r.online.delete(u.id);if(!r.online.size)r.emptyAt=Date.now();queue(r);broadcast(r);}
  });
 });
 const heartbeat=setInterval(()=>{for(const ws of wss.clients){if(!ws.alive)ws.terminate();else{ws.alive=false;ws.ping();}}},30000);
 heartbeat.unref();
 server.on('close',()=>{clearInterval(loop);clearInterval(heartbeat);for(const ws of wss.clients)ws.terminate();wss.close();db.close();});
 return server;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 const arg=name=>{const index=process.argv.indexOf(name);return index<0?undefined:process.argv[index+1];};
 const server=createApp();server.listen(Number(process.env.PORT||arg('--port')||3000),arg('--host')||'0.0.0.0',()=>console.log('Arena listening on port '+server.address().port));
 const close=()=>{server.close();setTimeout(()=>process.exit(0),3000).unref();};
 process.once('SIGTERM',close);process.once('SIGINT',close);
}
