const cacheName='dgc-shell-v2';
const files=['/','/style.css','/app.js','/graphics.js','/ghost.svg','/hero.webp','/game.webmanifest','/icon-192.png','/icon-512.png',...Array.from({length:7},(_,i)=>'/skin-'+i+'.svg')];
self.addEventListener('install',e=>e.waitUntil(caches.open(cacheName).then(c=>c.addAll(files)).then(()=>self.skipWaiting())));
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('dgc-')&&k!==cacheName).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',e=>{
 const u=new URL(e.request.url);
 if(e.request.method!=='GET'||u.origin!==location.origin||(!files.includes(u.pathname)&&e.request.mode!=='navigate'))return;
 e.respondWith(fetch(e.request).catch(async()=>{
  const cached=await caches.match(e.request)||e.request.mode==='navigate'&&await caches.match('/');
  return cached||new Response('Connection unavailable',{status:503});
 }));
});
