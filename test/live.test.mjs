import test from 'node:test';
import assert from 'node:assert/strict';
import {once} from 'node:events';
import {WebSocket} from 'ws';
import {createApp} from '../server.mjs';

test('two real WebSocket clients share an authoritative room and reconnect; solo results persist',async t=>{
 let time=Date.now(),step=10;
 const server=createApp({database:':memory:',adminKey:'integration-test-secret',clock:()=>time+=step});
 server.listen(0,'127.0.0.1');await once(server,'listening');
 const origin='http://127.0.0.1:'+server.address().port,clients=[];
 t.after(()=>{for(const c of clients)c.terminate();server.close();});
 async function guest(){
  const res=await fetch(origin+'/api/guest',{method:'POST',headers:{'content-type':'application/json',origin},body:'{}'});
  assert.equal(res.status,200);
  return {cookie:res.headers.get('set-cookie').split(';')[0],profile:await res.json()};
 }
 function connect(g){
  const ws=new WebSocket(origin.replace('http','ws')+'/live',{origin,headers:{cookie:g.cookie}});
  clients.push(ws);const backlog=[],waiting=new Set();
  ws.on('message',data=>{
   const m=JSON.parse(data);let handled=false;
   for(const w of waiting)if(w.predicate(m)){waiting.delete(w);clearTimeout(w.timer);w.resolve(m);handled=true;}
   if(!handled){backlog.push(m);if(backlog.length>200)backlog.shift();}
  });
  const wait=predicate=>{
   const i=backlog.findIndex(predicate);if(i>=0)return Promise.resolve(backlog.splice(i,1)[0]);
   return new Promise((resolve,reject)=>{
    const w={predicate,resolve};w.timer=setTimeout(()=>{waiting.delete(w);reject(Error('Expected WebSocket event timed out'));},13000);waiting.add(w);
   });
  };
  return {ws,wait,send:m=>ws.send(JSON.stringify(m))};
 }
 const shell=await fetch(origin+'/');
 assert.equal(shell.status,200);
 assert.match(await shell.text(),/DON’T GET CAUGHT!/);
 for(const f of ['app.js','graphics.js','style.css','game.webmanifest','hero.webp','icon-192.png','icon-512.png','sw.js'])assert.equal((await fetch(origin+'/'+f,{method:'HEAD'})).status,200,f);
 const [a,b,c]=await Promise.all([guest(),guest(),guest()]);
 async function post(g,path,data){
  return fetch(origin+'/api/'+path,{method:'POST',headers:{cookie:g.cookie,origin,'content-type':'application/json'},body:JSON.stringify(data)});
 }
 const registered=await post(c,'register',{email:'test@example.net',password:'only-for-this-test-passphrase'});
 assert.equal(registered.status,200);
 assert.equal((await registered.json()).registered,true);
 assert.equal((await post(c,'login',{email:'test@example.net',password:'wrong-passphrase'})).status,401);
 const admin=await fetch(origin+'/api/admin',{headers:{cookie:c.cookie,'x-admin-key':'integration-test-secret'}});
 assert.equal(admin.status,200);
 const eventResponse=await fetch(origin+'/api/admin',{method:'POST',headers:{cookie:c.cookie,origin,'x-admin-key':'integration-test-secret','content-type':'application/json'},body:JSON.stringify({action:'create-tournament',name:'Integration Arena',mode:'freeze',opens:new Date(Date.now()-1000).toISOString(),closes:new Date(Date.now()+600000).toISOString()})});
 assert.equal(eventResponse.status,200);
 const tournament=(await eventResponse.json()).events[0].id;
 const alice=connect(a),bob=connect(b),watch=connect(c);
 await Promise.all([alice,bob,watch].map(x=>x.wait(m=>m.type==='ready')));
 alice.send({type:'enter',action:'create',mode:'classic'});
 const room=await alice.wait(m=>m.type==='room');
 bob.send({type:'enter',action:'join',code:room.code});
 watch.send({type:'enter',action:'watch',code:room.code});
 await alice.wait(m=>m.type==='room'&&m.players.length===2);
 await watch.wait(m=>m.type==='room'&&m.players.length===2);
 alice.send({type:'start'});step=280;
 const [sa,sb,sc]=await Promise.all([alice,bob,watch].map(x=>x.wait(m=>m.type==='state'&&m.phase==='live')));
 for(const state of [sa,sb,sc])assert.deepEqual(state.players.map(p=>p.id),[a.profile.id,b.profile.id]);
 const x=sa.players[0].x;
 step=18;
 alice.send({type:'input',x:50,y:0});
 const moved=await bob.wait(m=>m.type==='state'&&m.players[0].x>x);
 assert.ok(moved.players[0].x-x<=40);
 bob.ws.close();await once(bob.ws,'close');
 const reconnected=connect(b);
 const state=await reconnected.wait(m=>m.type==='state'&&m.round===1);
 assert.ok(state.players.find(p=>p.id===b.profile.id));
 alice.send({type:'leave'});await alice.wait(m=>m.type==='left');
 step=2000;
 alice.send({type:'enter',action:'solo',mode:'chaos'});
 await alice.wait(m=>m.type==='state'&&m.mode==='chaos'&&m.phase==='done');
 const res=await fetch(origin+'/api/profile',{headers:{cookie:a.cookie}});
 const profile=await res.json();assert.ok(profile.xp>0);assert.equal(profile.history[0].online,0);
 const rank=await fetch(origin+'/api/leaderboard',{headers:{cookie:a.cookie}});
 const ranked=await rank.json();assert.ok(ranked.every(row=>row.matches===1));
 assert.ok(ranked.every(row=>[a.profile.id,b.profile.id].includes(row.id)));
 const denied=await fetch(origin+'/api/admin',{headers:{cookie:a.cookie}});
 assert.equal(denied.status,403);
 alice.send({type:'leave'});await alice.wait(m=>m.type==='left');
 reconnected.send({type:'leave'});await reconnected.wait(m=>m.type==='left');
 step=10;
 alice.send({type:'enter',action:'find',tournament});
 const waiting=await alice.wait(m=>m.type==='room'&&m.mode==='freeze');
 assert.equal(waiting.players.length,1);
 assert.equal(waiting.countdown,null);
 reconnected.send({type:'enter',action:'find',tournament});
 const queued=await alice.wait(m=>m.type==='room'&&m.mode==='freeze'&&m.players.length===2);
 assert.equal(waiting.code,queued.code);
 assert.ok(queued.countdown>0);
 const matched=await reconnected.wait(m=>m.type==='state'&&m.mode==='freeze');
 assert.deepEqual(matched.players.map(p=>p.id),[a.profile.id,b.profile.id]);
 assert.ok(matched.players.every(p=>!p.bot));
 step=2000;
 await reconnected.wait(m=>m.type==='state'&&m.mode==='freeze'&&m.phase==='done');
 const eventStandings=await fetch(origin+'/api/tournament?id='+tournament,{headers:{cookie:a.cookie}});
 const entries=await eventStandings.json();
 assert.equal(entries.length,2);
 assert.equal(entries[0].wins,1);
 const badOrigin=await fetch(origin+'/api/guest',{method:'POST',headers:{origin:'https://unrelated.example','content-type':'application/json'},body:'{}'});
 assert.equal(badOrigin.status,403);
});
