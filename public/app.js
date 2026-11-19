import {render, sound, capture, colors} from './graphics.js';
const $=id=>document.getElementById(id);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const icons={gamepad:'<rect x="2" y="6" width="20" height="13" rx="5"/><path d="M7 10v5m-2.5-2.5h5m6 0h.01m3-2h.01"/>',trophy:'<path d="M8 21h8m-4-4v4M7 3h10v8a5 5 0 0 1-10 0V3ZM7 5H3v3a4 4 0 0 0 4 4m10-7h4v3a4 4 0 0 1-4 4"/>',shirt:'<path d="M8 4 3 7l-2 5 4 2 2-2v8h10v-8l2 2 4-2-2-5-5-3a4 4 0 0 1-8 0Z"/>',target:'<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/>',user:'<circle cx="12" cy="8" r="4"/><path d="M4 21v-2a6 6 0 0 1 6-6h4a6 6 0 0 1 6 6v2"/>',settings:'<path d="M10 3h4l1 3 3 1 3-1 2 4-2 2v3l1 2-3 3-3-1-2 1-1 2h-4l-1-3-3-1-2 1-2-4 2-2v-3l-1-2 3-3 3 1 2-1z"/><circle cx="12" cy="12" r="3"/>',shield:'<path d="M12 2 3 6v6c0 5 5 8 9 10 4-2 9-5 9-10V6l-9-4Z"/><path d="m9 12 2 2 4-4"/>',play:'<path fill="currentColor" d="m8 4 13 8-13 8z"/>',cpu:'<rect x="5" y="5" width="14" height="14" rx="3"/><path d="M9 2v3m6-3v3m-6 14v3m6-3v3M2 9h3m-3 6h3m14-6h3m-3 6h3"/><rect x="9" y="9" width="6" height="6" rx="1"/>',users:'<circle cx="9" cy="7" r="3"/><path d="M2 21v-2a6 6 0 0 1 6-6h2a6 6 0 0 1 6 6v2m0-17a3 3 0 0 1 0 6m2 3a5 5 0 0 1 4 5v3"/>',key:'<circle cx="8" cy="8" r="5"/><path d="m12 12 9 9m-5-5 3-3m0 6 3-3"/>',plus:'<path d="M12 5v14M5 12h14"/>',enter:'<path d="M12 4h8v16h-8m-9-8h12m-4-4 4 4-4 4"/>',x:'<path d="m5 5 14 14M19 5 5 19"/>',expand:'<path d="M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5"/>',flame:'<path d="M12 22c-5 0-8-3-8-7 0-3 2-6 4-7 0 3 2 3 2 3 2-2 4-5 3-9 5 4 7 8 7 13 0 4-3 7-8 7z"/>',snow:'<path d="M12 2v20M3 7l18 10M3 17 21 7M9 4l3 3 3-3M9 20l3-3 3 3"/>',skull:'<path d="M5 17a8 8 0 1 1 14 0l-3 1v3H8v-3z"/><circle cx="9" cy="12" r="1"/><circle cx="15" cy="12" r="1"/>',bolt:'<path d="M13 2 4 14h7l-1 8 10-12h-7z"/>',shuffle:'<path d="M3 6h3c5 0 6 12 11 12h4m-4-4 4 4-4 4M3 18h3c5 0 6-12 11-12h4m-4-4 4 4-4 4"/>',calendar:'<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 2v6m8-6v6m-7 7h6"/>',book:'<path d="M3 19V4h6l3 3 3-3h6v15h-6l-3 2-3-2zm9-12v14"/>'};
const icon=n=>`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[n]||''}</svg>`;
function paint(root=document){for(const el of root.querySelectorAll('[data-icon]'))el.innerHTML=icon(el.dataset.icon);}
const info={classic:['shield','','Outlast everyone in the arena.'],freeze:['snow','blue','Move when it’s green. Freeze on red.'],lava:['flame','orange','Find a safe pad before the floor erupts.'],hunt:['skull','pink','Find the hidden saboteur.'],speed:['bolt','green','Race for the glowing beacon.'],chaos:['shuffle','','Survive fast-changing rules.'],team:['users','cyan','Outlast the opposing team.'],daily:['calendar','orange','Take on today’s seeded challenge.']};
const modeNames={classic:'Last Player Standing',freeze:'Don’t Move',lava:'Floor Is Lava',hunt:'Imposter Hunt',speed:'Speed Challenge',chaos:'Chaos Mode',team:'Team Battle',daily:'Daily Challenge'};
const settings={sound:localStorage.getItem('dgc-sound')!=='0',low:localStorage.getItem('dgc-low')==='1'||matchMedia('(prefers-reduced-motion: reduce)').matches};
const keys=new Set(),touch=new Set();
const params=new URLSearchParams(location.search);
let config={modes:modeNames,challenges:[],skins:[],prices:[]},profile,ws,room,state,current='play',scope='global',period='all',retries=0,reconnectTimer,invite=params.get('room'),adminKey='',installPrompt,lastInput='',lastTx=0,toastTimer,lastRound='',lastHp,lastPhase,lastResult,replayFrames,leagueRequest=0,latency=0,localMotion={x:0,y:0},roomCountdown=0;
const btn=(text,action,extra='',css='secondary')=>`<button class="${css}" data-action="${action}" ${extra}>${text}</button>`;
const row=(title,sub='',right='')=>`<div class="row"><div><b>${title}</b>${sub?'<small>'+sub+'</small>':''}</div>${right}</div>`;
const panel=(title,body)=>`<div class="panel"><h2>${title}</h2>${body}</div>`;
const heading=(t,p='')=>`<div class="page-title"><h1>${t}</h1>${p?'<p>'+p+'</p>':''}</div>`;
const list=items=>'<div class="list">'+items.join('')+'</div>';
function toast(message){
 $('toast').textContent=message;$('toast').hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').hidden=true,3800);
}
async function api(path,data,headers={}){
 const res=await fetch('/api/'+path,{cache:'no-store',method:data===undefined?'GET':'POST',headers:{...headers,...(data===undefined?{}:{'Content-Type':'application/json'})},body:data===undefined?undefined:JSON.stringify(data)});
 const json=await res.json();
 if(!res.ok)throw Error(json.error||'Request failed.');
 return json;
}
function profileUpdate(p){
 profile=p;$('reactions').innerHTML=p.emotes.map(e=>btn(e,'react',`data-value="${e}" aria-label="React ${e}"`)).join('');$('rank').textContent=p.rank;$('level').textContent='Level '+p.level;$('coins').innerHTML='◈ <b>'+p.coins+'</b>';
}
function loadModes(){
 $('modes').innerHTML=Object.entries(config.modes).map(([id,title])=>{
  const [glyph,color,desc]=info[id];
  return `<button class="mode-card" data-action="mode" data-mode="${id}"><span class="tileicon ${color}">${icon(glyph)}</span><h3>${title}</h3><p>${desc}</p></button>`;
 }).join('');
 const events=config.events||[];
 $('events').hidden=!events.length;
 $('events').innerHTML=events.length?'<div class="section-head"><div><h2>TOURNAMENTS</h2><p>Play during the event to enter its standings.</p></div></div>'+list(events.map(e=>row(esc(e.name),esc(modeNames[e.mode])+' · '+esc(new Date(e.opens).toLocaleString())+' – '+esc(new Date(e.closes).toLocaleString()),btn('Standings','event-table',`data-value="${esc(e.id)}"`)+(e.opens<=Date.now()&&e.closes>Date.now()?btn('Join queue','event-join',`data-value="${esc(e.id)}"`,'primary'):'')))):'';
 const a=[config.announcement,config.tournament].filter(Boolean).join(' • ');$('announcement').textContent=a;$('announcement').hidden=!a;
}
function connect(){
 clearTimeout(reconnectTimer);
 if(ws){ws.onclose=null;ws.close();}
 ws=new WebSocket((location.protocol==='https:'?'wss://':'ws://')+location.host+'/live');
 ws.onopen=()=>{retries=0;status('Online',true);};
 ws.onclose=event=>{
  status(event.code===4001?'Another tab is active':'Reconnecting',false);
  if(event.code!==4001&&event.code!==4003)reconnectTimer=setTimeout(connect,Math.min(12000,600*2**retries++));
  else toast(event.code===4003?'Account suspended.':'This profile is playing in another tab.');
 };
 ws.onmessage=e=>{
  const m=JSON.parse(e.data);
  if(m.type==='pong'){latency=Math.max(0,performance.now()-m.at);$('connection').textContent=Math.round(latency)+' ms';}
  if(m.type==='ready'&&invite){const code=invite;invite=null;openJoin(code);}
  if(m.type==='room'){
   const changed=room?.code!==m.code;
   room=m;roomCountdown=m.countdown==null?0:performance.now()+m.countdown;if(changed){state=null;lastPhase=null;lastRound='';lastHp=null;lastResult=null;}
   if(!m.started||!state)show('room');if(current==='room')renderRoom();
  }
  if(m.type==='state'){
   const phaseChanged=m.phase!==lastPhase;
   if(lastRound!==m.round||phaseChanged&&m.phase==='live')sound(m.phase==='live'?'go':'round',settings.sound);
   const self=m.players.find(p=>p.id===profile?.id);
   if(lastHp!=null&&self&&self.hp<lastHp)sound(self.alive?'damage':'out',settings.sound);
   lastHp=self?.hp;lastRound=m.round;lastPhase=m.phase;state=m;
   if(current==='room'||current==='match'){show('match');renderHud(m);}
   if(m.phase==='done'&&phaseChanged){
    const won=m.winner.includes(profile.id);
    sound(won?'win':'out',settings.sound);
    lastResult=m;showResult(m);api('profile').then(profileUpdate).catch(()=>{});
   }
  }
  if(m.type==='left'){room=null;state=null;show('play');}
  if(m.type==='error'||m.type==='notice')toast(m.message);
  if(m.type==='replay'){replayFrames=m.frames;openReplay();}
 };
}
function status(label,ok){
 $('status').textContent=label;$('status').classList.toggle('off',!ok);$('status').title=label;$('connection').textContent=ok?'Live':label;
}
function send(data){
 if(ws?.readyState!==WebSocket.OPEN){toast('The arena is reconnecting. Try again in a moment.');return;}
 ws.send(JSON.stringify(data));
}
function show(which){
 current=which;
 for(const [id,visible] of [['home',which==='play'],['page',!['play','room','match'].includes(which)],['room',which==='room'],['match',which==='match']])$(id).hidden=!visible;
 for(const el of document.querySelectorAll('.side [data-page]'))el.classList.toggle('active',el.dataset.page===which||['room','match'].includes(which)&&el.dataset.page==='play');
}
function page(which){
 if(which==='play'&&room){if(state){show('match');renderHud(state);return;}show('room');renderRoom();return;}
 show(which);if(which==='play')return;
 const out=$('page');
 if(!profile){out.innerHTML=heading('Connecting','Your player profile is loading.');return;}
 if(which==='leaderboard'){
  const n=++leagueRequest;
  out.innerHTML=heading('Leaderboards','Only completed multiplayer matches count toward the standings.')+panel('Standings',`<div class="filters">${[['global','Global'],['national','National'],['friends','Friends']].map(([id,t])=>btn(t,'scope',`data-value="${id}"`,'secondary '+(scope===id?'active':''))).join('')}</div><div class="filters">${[['all','All time'],['season','This season'],['daily','Daily challenge']].map(([id,t])=>btn(t,'period',`data-value="${id}"`,'secondary '+(period===id?'active':''))).join('')}</div><div id="standings"><p>Loading standings…</p></div>`);
  api(`leaderboard?scope=${scope}&period=${period}`).then(rows=>{
   if(current!==which||n!==leagueRequest)return;
   $('standings').innerHTML=rows.length?list(rows.map((r,i)=>row(`${i+1}. ${esc(r.name)}`,`${r.wins} wins · ${r.matches} matches · ${r.score} points`,r.id===profile.id?'You':btn('Add friend','add',`data-value="${r.id}"`)))):'<p>No ranked results yet. Play a multiplayer match to qualify.</p>';
  }).catch(e=>{if(current===which&&n===leagueRequest)$('standings').textContent=e.message;});
 }else if(which==='locker'){
  out.innerHTML=heading('Locker','Spend coins earned in the arena on cosmetic skins.')+`<div class="inventory">${config.skins.map((name,i)=>{
   const label=profile.skin===i?'Equipped':profile.unlocked.includes(i)?'Equip':`Unlock · ◈ ${config.prices[i]}`;
   return `<div class="item"><img src="/skin-${i}.svg" alt=""><h3>${esc(name)}</h3>${btn(label,'skin',`data-value="${i}" ${profile.skin===i?'disabled':''}`)}</div>`;
  }).join('')}</div>`+'<br>'+panel('Accessories',list((config.accessories||[]).map((item,i)=>row(esc(item.name),'Level '+item.level,btn(profile.accessory===i?'Equipped':profile.level<item.level?'Locked':'Equip','accessory',`data-value="${i}" ${profile.accessory===i||profile.level<item.level?'disabled':''}`)))))+panel('Unlocked reactions',`<p>${profile.emotes.join(' ')}</p>`)+
  (config.products?.length?'<br>'+panel('Cosmetic shop',list(config.products.map(p=>row(esc(p.title),new Intl.NumberFormat(undefined,{style:'currency',currency:p.currency}).format(p.amount/100),btn('Buy','checkout',`data-value="${esc(p.id)}"`))))):'')+
  (profile.pass?panel('Season pass',`<p>${profile.seasonWins} multiplayer wins this season.</p>`+list([[4,1],[6,5]].map(([i,n])=>row(esc(config.skins[i]),`${n} multiplayer wins`,btn(profile.unlocked.includes(i)?'Unlocked':'Claim','pass-reward',`data-value="${i}" ${profile.seasonWins<n||profile.unlocked.includes(i)?'disabled':''}`))))):'');
 }else if(which==='missions'){
  out.innerHTML=heading('Missions','Earn coins and trophies by surviving the arena.')+panel('Daily & weekly',list(profile.missions.map(m=>row(esc(m.title),`${m.id==='daily'?'Daily':'Weekly'} · ${Math.min(m.progress,m.goal)}/${m.goal}`,btn(m.claimed?'Claimed':`Claim ◈ ${m.reward}`,'claim',`data-value="${m.id}" ${m.claimed||m.progress<m.goal?'disabled':''}`)))))+panel('Trophies',list(profile.achievements.map(a=>row(esc(a.name),'',a.earned?'Earned':'Locked'))));
 }else if(which==='profile'){
  out.innerHTML=heading(esc(profile.name),`${profile.rank} · ${profile.rankPoints} rank points · Level ${profile.level} · ${profile.xp} XP`)+`<div class="metrics">${[['Matches',profile.matches],['Wins',profile.wins],['Losses',profile.losses]].map(([k,v])=>`<div class="metric">${k}<b>${v}</b></div>`).join('')}</div><br>`+
  panel('Player details',`<form class="form" data-form="profile"><label>Display name<input name="name" maxlength="18" value="${esc(profile.name)}" required></label><label>Country code<input name="country" value="${esc(profile.country)}" minlength="2" maxlength="2" required></label><button class="primary">Save profile</button></form><div class="actions">${btn('Copy referral invite','refer')}${profile.registered?btn('Sign out','logout'):btn('Secure guest account','register')+btn('Sign in','login')}</div>`)+
  panel('Friends',`<form class="form" data-form="friend"><label>Player ID<input name="id" required></label><button class="secondary">Add friend</button></form>`+btn('Copy my player ID','copy-id')+list(profile.friends.map(f=>row(esc(f.name),'',btn('Report','report',`data-value="${f.id}"`)))))+
  panel('Match history',profile.history.length?list(profile.history.map(x=>row(modeNames[x.mode]||esc(x.mode),`${x.online?'Multiplayer':'Solo'} · ${x.rounds} rounds · ${esc(x.created.slice(0,10))}`,x.win?'Win':'Loss'))):'<p>Finished matches will appear here.</p>');
 }else if(which==='settings'){
  out.innerHTML=heading('Settings','Customize controls and performance.')+panel('Game preferences',list([row('Sound effects','Synthesized game and countdown sounds',btn(settings.sound?'On':'Off','sound')),row('Low performance mode','Fewer effects and a lower render frame rate',btn(settings.low?'On':'Off','low')),row('Fullscreen','Enter or exit fullscreen',btn('Toggle','fullscreen')),row('Install app','Available in supported browsers',btn('Install','install'))]))+panel('Controls','<p>Move with WASD, arrow keys, or the on-screen direction pad. In Imposter Hunt, use E or tap Vote when you’re close to a suspect.</p>');
 }else if(which==='admin'){
  out.innerHTML=heading('Arena administration')+panel('Admin access','<form class="form" data-form="admin-auth"><label>Admin key<input type="password" name="key" required></label><button class="primary">Open dashboard</button></form>');if(adminKey)renderAdmin().catch(e=>toast(e.message));
 }
}
function renderRoom(){
 if(!room)return;
 const spectator=!room.players.some(p=>p.id===profile.id);
 const queue=!room.private&&!room.solo;
 $('room').innerHTML=heading(queue?'Public matchmaking':room.solo?'Solo Training':'Private Room',config.modes[room.mode]||modeNames[room.mode])+panel(queue?'Queue':'Room code',`<div class="code">${room.code}</div><p>${room.started?'Opening arena…':spectator?'Spectating when the host starts.':queue?'The match starts automatically when at least two players connect.':'Share the code or invite link. Start when at least two players are connected.'}</p><p id="room-countdown"></p>`+list(room.players.map(p=>row(esc(p.name),p.online?'Connected':'Reconnecting',p.id===room.host?'Host':'')))+`<div class="actions">${btn('Copy invite link','invite')}${room.private&&room.host===profile.id&&!room.started?btn('Start match','start',room.players.filter(p=>p.online).length<2?'disabled':'','primary'):''}${btn('Leave room','exit')}</div>`);
}
function renderHud(s){
 const self=s.players.find(p=>p.id===profile.id),done=s.phase==='done';
 $('round-label').textContent=`ROUND ${s.round} · ${room?.solo?'SOLO TRAINING':modeNames[s.mode].toUpperCase()}`;
 $('challenge-name').textContent=s.challenge.name;$('tip').textContent=s.role?'You are the saboteur. Press E near a runner to jam their movement once this round.':s.challenge.tip;
 $('timer').textContent=done?'0:00':'0:'+String(Math.ceil(s.left/1000)).padStart(2,'0');
 $('alive').textContent=s.players.filter(p=>p.alive).length+' / '+s.players.length+' alive';
 $('health').textContent=self?.alive?'♥ '.repeat(self.hp).trim():'Spectating';
 const overlay=$('arena-text');
 overlay.classList.toggle('freeze',s.phase==='live'&&s.challenge.kind==='freeze');
 overlay.classList.toggle('stop',!!s.hazards.red);
 overlay.textContent=done?'':s.phase==='intro'?Math.max(1,Math.ceil(s.left/1000)):s.challenge.kind==='freeze'?(s.hazards.red?'STOP':'MOVE'):'';
 document.querySelector('.vote').hidden=!(s.challenge.kind==='hunt'&&s.phase==='live'&&self?.alive);
 document.querySelector('.vote').firstChild.textContent=s.role?'Jam ':'Vote ';
 $('result').hidden=!done;if(done&&lastResult!==s)showResult(s);
}
function showResult(s){
 const win=s.winner.includes(profile.id),winners=s.players.filter(p=>s.winner.includes(p.id)).map(p=>p.name).join(', ');
 $('result').hidden=false;$('result').classList.toggle('won',win);
 $('result').innerHTML=`<h2>${win?'VICTORY!':'MATCH COMPLETE'}</h2><p>${esc(winners)} ${s.winner.length===1?'wins':'win'} · Round ${s.round}</p><div class="actions">${btn('Rematch','rematch','','primary')}${btn('Share result','share')}${btn('Replay highlight','replay')}${room?.solo?'':btn('Create revenge room','revenge')}${btn('Back to lobby','exit')}</div>`+list([...s.players].sort((a,b)=>Number(s.winner.includes(b.id))-Number(s.winner.includes(a.id))||b.score-a.score).map(p=>row(esc(p.name)+(p.bot?' <small>BOT</small>':''),`${p.score} points`,s.winner.includes(p.id)?'Winner':'')));
}
function dialog(title,html){$('dialog-title').textContent=title;$('dialog-body').innerHTML=html;if(!$('dialog').open)$('dialog').showModal();}
function openJoin(code=''){
 dialog('Join a room',`<form class="form" data-form="join"><label>Room code<input name="code" value="${esc(code)}" maxlength="6" minlength="6" autocomplete="off" required></label><div class="actions"><button class="primary" value="join">Join match</button><button class="secondary" value="watch">Spectate</button></div></form>`);
}
const roomForm=(type,title)=>dialog(title,`<form class="form" data-form="room" data-value="${type}"><label>Game mode<select name="mode">${Object.entries(config.modes).map(([k,v])=>`<option value="${k}">${v}</option>`).join('')}</select></label><button class="primary">${type==='solo'?'Start training':'Create room'}</button></form>`);
const copy=async(value)=>{if(navigator.clipboard){try{await navigator.clipboard.writeText(value);toast('Copied to clipboard.');return;}catch{}}dialog('Copy link',`<form class="form"><label>Copy this value<input readonly value="${esc(value)}"></label></form>`);};
function inviteUrl(type,value){const u=new URL('/',location.href);u.searchParams.set(type,value);return u.href;}
const enter=(action,mode='classic',code)=>{if(!$('dialog').open||ws?.readyState===1){if($('dialog').open)$('dialog').close();}send({type:'enter',action,mode,code});};
function openReplay(){
 if(!replayFrames?.length){toast('There are no captured frames for this match.');return;}
 dialog('Match highlight','<canvas id="replay-canvas" width="960" height="540" aria-label="Match replay"></canvas><div class="actions">'+btn('Download vertical clip','clip')+'</div>');
 const start=performance.now(),canvas=$('replay-canvas');
 function draw(now){
  if(!canvas.isConnected||!$('dialog').open)return;
  render(canvas,replayFrames[Math.floor((now-start)/200)%replayFrames.length],profile.id,true,now);
  requestAnimationFrame(draw);
 }
 requestAnimationFrame(draw);
}
async function renderAdmin(data){
 data??=await api('admin',undefined,{'x-admin-key':adminKey});
 if(current!=='admin')return;
 $('page').innerHTML=heading('Arena administration')+
 `<div class="metrics">${[['Accounts',data.players],['Connected',data.active],['Completed matches',data.matches],['Rooms',data.rooms]].map(([t,n])=>`<div class="metric">${t}<b>${n}</b></div>`).join('')}</div><br>`+
 panel('Announcements & rules',Object.entries(data.settings).map(([k,v])=>`<form class="form" data-form="admin-setting"><input name="key" type="hidden" value="${k}"><label>${({announcement:'Announcement',tournament:'Tournament announcement',disabledModes:'Disabled mode IDs, comma separated',cosmeticPrices:'Cosmetic coin prices, JSON',disabledChallenges:'Disabled challenge names, comma separated'})[k]}<textarea name="value">${esc(v)}</textarea></label><button class="secondary">Save</button></form>`).join(''))+
 panel('Tournaments',`<form class="form" data-form="admin-tournament"><label>Event name<input name="name" minlength="3" maxlength="70" required></label><label>Mode<select name="mode">${Object.entries(config.modes).map(([k,v])=>`<option value="${k}">${v}</option>`).join('')}</select></label><label>Opens locally<input name="opens" type="datetime-local" required></label><label>Closes locally<input name="closes" type="datetime-local" required></label><button class="secondary">Schedule tournament</button></form>`+list(data.events.map(e=>row(esc(e.name),esc(new Date(e.opens).toLocaleString())+' – '+esc(new Date(e.closes).toLocaleString()),e.cancelled?'Cancelled':btn('Cancel event','event-cancel',`data-value="${esc(e.id)}"`)))))+
 panel('Players',list(data.users.map(x=>row(esc(x.name),esc(x.id),btn(x.banned?'Restore':'Suspend','ban',`data-value="${x.id}" data-ban="${!x.banned}"`)))))+
 panel('Last 7 days',data.engagement.length?list(data.engagement.map(e=>row(esc(modeNames[e.mode]),e.players+' unique players',e.matches+' matches'))):'<p>No completed matches in the last seven days.</p>')+
 panel('Reports',data.reports.length?list(data.reports.map(x=>row(esc(x.reason),esc(x.target),x.status==='open'?btn('Resolve','resolve',`data-value="${x.id}"`):'Closed'))):'<p>No reports.</p>')+panel('Revenue',data.revenueEnabled?data.revenue.length?list(data.revenue.map(x=>row(esc(x.currency.toUpperCase()),x.purchases+' purchases',new Intl.NumberFormat(undefined,{style:'currency',currency:x.currency}).format(x.amount/100)))):'<p>No completed purchases.</p>':'<p>Payments are disabled in this installation.</p>');
}
const admin=(data)=>api('admin',data,{'x-admin-key':adminKey}).then(renderAdmin);
const actions={
 'event-join':b=>send({type:'enter',action:'find',tournament:b.dataset.value}),
 'event-table':async b=>{
  const event=config.events.find(e=>e.id===b.dataset.value),scores=await api('tournament?id='+encodeURIComponent(b.dataset.value));
  dialog(event.name,scores.length?list(scores.map((r,i)=>row(`${i+1}. ${esc(r.name)}`,`${r.wins} wins · ${r.matches} matches · ${r.score} points`))):'<p>No completed tournament matches yet.</p>');
 },
 'event-cancel':b=>admin({action:'cancel-tournament',id:b.dataset.value}),
 quick:()=>enter('find'),solo:()=>roomForm('solo','Solo Training'),create:()=>roomForm('create','Create a private room'),join:()=>openJoin(),
 mode:b=>{const m=b.dataset.mode;dialog(config.modes[m],`<p>${info[m][2]}</p><div class="actions">${btn('Find players','find',`data-value="${m}"`,'primary')}${btn('Train with bots','train',`data-value="${m}"`)}${m==='daily'?btn('Daily standings','daily-league'):''}</div>`);},
 find:b=>enter('find',b.dataset.value),train:b=>enter('solo',b.dataset.value),start:()=>send({type:'start'}),exit:()=>send({type:'leave'}),
 book:()=>dialog('How to play','<p>Read the rule at the start of each round. Move with WASD, arrow keys, or the touch controls. You can lose one heart per round. Lose all three and you’ll spectate until the match ends. Final placement uses remaining hearts, then survival score. Exact ties use the match seed.</p>'+list(config.challenges.map(c=>row(c.name,c.tip)))),
 close:()=>$('dialog').close(),scope:b=>{scope=b.dataset.value;page('leaderboard');},period:b=>{period=b.dataset.value;page('leaderboard');},
 'daily-league':()=>{$('dialog').close();period='daily';page('leaderboard');},
 fullscreen:async()=>{if(document.fullscreenElement)await document.exitFullscreen();else if(document.documentElement.requestFullscreen)await document.documentElement.requestFullscreen();else toast('Fullscreen is unavailable in this browser.');},
 install:async()=>{if(installPrompt){await installPrompt.prompt();installPrompt=null;}else toast('Use the browser menu to install or add this app to your home screen.');},
 sound:()=>{settings.sound=!settings.sound;localStorage.setItem('dgc-sound',Number(settings.sound));page('settings');sound('go',settings.sound);},
 low:()=>{settings.low=!settings.low;localStorage.setItem('dgc-low',Number(settings.low));page('settings');},
 invite:()=>copy(inviteUrl('room',room.code)),refer:()=>copy(inviteUrl('ref',profile.id)),'copy-id':()=>copy(profile.id),
 checkout:async b=>{if(!profile.registered){account('register');return;}location.assign((await api('checkout',{sku:b.dataset.value})).url);},
 'pass-reward':async b=>{profileUpdate(await api('pass-reward',{skin:Number(b.dataset.value)}));page('locker');},
 accessory:async b=>{profileUpdate(await api('accessory',{id:Number(b.dataset.value)}));page('locker');},
 skin:async b=>{profileUpdate(await api('cosmetic',{skin:Number(b.dataset.value)}));page('locker');},
 claim:async b=>{profileUpdate(await api('mission',{id:b.dataset.value}));page('missions');},
 add:async b=>{profileUpdate(await api('friend',{id:b.dataset.value}));toast('Friend added.');},
 report:b=>dialog('Report player',`<form class="form" data-form="report"><input name="id" type="hidden" value="${esc(b.dataset.value)}"><label>Reason<textarea name="reason" minlength="3" maxlength="280" required></textarea></label><button class="primary">Submit report</button></form>`),
 logout:async()=>{await api('logout',{});location.assign('/');},
 register:()=>account('register'),login:()=>account('login'),
 vote:()=>send({type:'vote'}),react:b=>send({type:'reaction',emoji:b.dataset.value}),rematch:()=>send({type:'rematch'}),
 revenge:()=>enter('create',lastResult.mode),replay:()=>send({type:'replay'}),
 clip:async b=>{b.disabled=true;try{await capture(replayFrames,profile.id);}finally{b.disabled=false;}},
 share:async()=>{
  if(!lastResult)return;
  const canvas=document.createElement('canvas');canvas.width=960;canvas.height=540;
  render(canvas,lastResult,profile.id,false,performance.now());
  const ctx=canvas.getContext('2d');ctx.fillStyle='#180d2bea';ctx.fillRect(60,70,840,400);ctx.textAlign='center';ctx.fillStyle='#dbabff';ctx.font='900 72px "Barlow Condensed", sans-serif';ctx.fillText('DON’T GET CAUGHT!',480,205);ctx.fillStyle='#ffffff';ctx.font='700 30px Inter, sans-serif';ctx.fillText(lastResult.players.filter(p=>lastResult.winner.includes(p.id)).map(p=>p.name).join(', ').slice(0,42),480,284);ctx.font='600 19px Inter, sans-serif';ctx.fillText('WINNER  •  ROUND '+lastResult.round,480,331);
  const blob=await new Promise(resolve=>canvas.toBlob(resolve));
  const file=new File([blob],'dont-get-caught-result.png',{type:'image/png'});
  if(navigator.canShare?.({files:[file]})){try{await navigator.share({files:[file],title:'DON’T GET CAUGHT!'});return;}catch(e){if(e.name==='AbortError')return;}}
  const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=file.name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);toast('Victory card downloaded.');
 },
 ban:b=>admin({action:'ban',id:b.dataset.value,ban:b.dataset.ban==='true'}),resolve:b=>admin({action:'resolve',id:b.dataset.value})
};
function account(type){
 dialog(type==='register'?'Secure your guest profile':'Sign in',`<form class="form" data-form="${type}"><label>Email<input name="email" type="email" autocomplete="email" required></label><label>Password<input name="password" type="password" minlength="10" maxlength="128" autocomplete="${type==='register'?'new-password':'current-password'}" required></label><button class="primary">${type==='register'?'Create account':'Sign in'}</button></form>`);
}
document.addEventListener('click',e=>{
 const b=e.target.closest('button');if(!b)return;
 if(b.dataset.page){page(b.dataset.page);scrollTo(0,0);}
 const act=actions[b.dataset.action];if(act)Promise.resolve().then(()=>act(b)).catch(e=>toast(e.message));
});
document.addEventListener('submit',async e=>{
 const f=e.target;if(!f.dataset.form)return;e.preventDefault();
 const data=Object.fromEntries(new FormData(f)),name=f.dataset.form;
 try{
  if(name==='room')enter(f.dataset.value,data.mode);
  else if(name==='join')enter(e.submitter?.value||'join','classic',data.code);
  else if(name==='admin-auth'){adminKey=data.key;await renderAdmin();}
  else if(name==='admin-tournament'){await admin({action:'create-tournament',...data,opens:new Date(data.opens).toISOString(),closes:new Date(data.closes).toISOString()});config=await api('config');loadModes();}
  else if(name==='admin-setting')await admin({action:'setting',...data});
  else{
   profileUpdate(await api(name,data));if($('dialog').open)$('dialog').close();
   if(name==='login'||name==='register'){room=null;state=null;connect();}
   if(name==='report')toast('Report submitted.');
   page(current);
  }
 }catch(e){toast(e.message);}
});
const keymap={w:'up',ArrowUp:'up',s:'down',ArrowDown:'down',a:'left',ArrowLeft:'left',d:'right',ArrowRight:'right'};
window.addEventListener('keydown',e=>{
 if(current!=='match'||$('dialog').open||e.target.matches('input,textarea,select'))return;
 const key=e.key.length===1?e.key.toLowerCase():e.key;
 if(keymap[key]){e.preventDefault();keys.add(key);}
 if(key==='e'&&!e.repeat)send({type:'vote'});
});
window.addEventListener('keyup',e=>keys.delete(e.key.length===1?e.key.toLowerCase():e.key));
window.addEventListener('blur',()=>{keys.clear();touch.clear();});
for(const b of document.querySelectorAll('[data-move]')){
 b.addEventListener('pointerdown',e=>{e.preventDefault();b.setPointerCapture(e.pointerId);touch.add(b.dataset.move);});
 for(const event of ['pointerup','pointercancel','lostpointercapture'])b.addEventListener(event,()=>touch.delete(b.dataset.move));
}
setInterval(()=>{
 if(!state||current!=='match'||state.phase==='done'||!state.players.some(p=>p.id===profile.id&&p.alive)||ws?.readyState!==1){localMotion={x:0,y:0};return;}
 const active=new Set([...touch,...[...keys].map(k=>keymap[k])]);
 const x=Number(active.has('right'))-Number(active.has('left')),y=Number(active.has('down'))-Number(active.has('up'));
 localMotion={x,y};
 const next=x+','+y,now=performance.now();
 if(next!==lastInput||now-lastTx>250){lastInput=next;lastTx=now;ws.send(JSON.stringify({type:'input',x,y}));}
},40);
setInterval(()=>{
 if(ws?.readyState===1)ws.send(JSON.stringify({type:'ping',at:performance.now()}));
},3000);
setInterval(()=>{
 const box=$('room-countdown');
 if(current==='room'&&box)box.textContent=roomCountdown?'Starting in '+Math.max(1,Math.ceil((roomCountdown-performance.now())/1000))+' s':'';
},200);
let lastDraw=0;
function frame(now){
 if(state&&current==='match'&&(!settings.low||now-lastDraw>32)){render($('arena'),state,profile.id,settings.low,now,{...localMotion,latency});lastDraw=now;}
 requestAnimationFrame(frame);
}
window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();installPrompt=e;});
document.addEventListener('pointerdown',()=>sound('init',settings.sound),{once:true});
paint();loadModes();requestAnimationFrame(frame);
async function startApp(){
 const [player,serverConfig]=await Promise.all([api('guest',{ref:params.get('ref')}),api('config')]);
 profileUpdate(player);config=serverConfig;loadModes();connect();
 if(location.pathname==='/admin')page('admin');
 if(params.get('checkout')==='done'){page('locker');toast('Payment submitted. Rewards appear after confirmation.');}
}
startApp().catch(e=>{status('Offline',false);dialog('Connection failed',`<p>${esc(e.message)}</p><p>Reload the page to reconnect.</p>`);});
if('serviceWorker' in navigator)navigator.serviceWorker.register('/sw.js').catch(()=>{});
