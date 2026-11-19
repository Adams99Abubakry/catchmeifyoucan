import test from 'node:test';
import assert from 'node:assert/strict';
import {createMatch,hazards,tick,challenges,modes,vote} from '../arena.mjs';

const roster=[{id:'a',name:'Alice'},{id:'b',name:'Bob'}];
test('35 distinct challenges, valid challenge geometry, seeded schedules',()=>{
 assert.equal(new Set(challenges.map(x=>x.name)).size,35);
 const a=createMatch(roster,'daily',false,20261119,0),b=createMatch(roster,'daily',false,20261119,0);
 assert.deepEqual(a.pool,b.pool);
 for(const c of challenges){
  a.c=c;
  for(const t of [0,1499,3000,6500,17200])assert.ok(hazards(a,t));
 }
});
test('each mode finishes with a valid winner and finite bounded positions',()=>{
 for(const mode of Object.keys(modes)){
  const m=createMatch(roster,mode,true,118,0);
  for(let t=0;t<=250000&&m.phase!=='done';t+=50)tick(m,t);
  assert.equal(m.phase,'done',mode);
  assert.ok(m.winner.every(id=>m.players.some(p=>p.id===id)));
  assert.ok(m.players.every(p=>p.x>=15&&p.x<=945&&p.y>=15&&p.y<=525));
 }
});
test('red light deducts at most one heart each round, then eliminates',()=>{
 const m=createMatch(roster,'freeze',false,81,0);
 for(let t=0;t<62000&&m.phase!=='done';t+=50){
  const p=m.players[0];
  p.dx=1;p.last=t;tick(m,t);
  assert.ok(p.hp>=3-m.round);
 }
 assert.deepEqual(m.winner,['b']);
 assert.equal(m.events[0].id,'a');
});
test('hunt validates range and allows one vote',()=>{
 const m=createMatch(roster,'hunt',false,21,0);
 tick(m,3000);
 const [a,b]=m.players;
 m.saboteur=b.id;a.x=20;b.x=900;
 vote(m,a);assert.equal(b.votes,0);
 b.x=45;vote(m,a);vote(m,a);
 assert.equal(b.votes,1);
 vote(m,b);assert.ok(a.jamUntil>3000);
});
