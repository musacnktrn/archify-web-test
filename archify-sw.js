/* [codex] 01a20fe8-62df-78c3-a20e-1c904d040938 · opt-in public shell only. */
'use strict';
const BASE = new URL('./', self.location.href);
const PREFIX = 'archify-wallet:' + encodeURIComponent(BASE.href) + ':';
const CACHE = PREFIX + 'v1';
const SHELL = [
  ['assets/pwa/offline.html','text/html','d6e1e48dabd8ebae298610439f2aed63f901d3ea579e42c20611816142cbe9a9'],
  ['assets/pwa/icon-192.png','image/png','01ca9effba6146d7f3b1f57c21df9b50b646a8cc4a1b6589a8f2dd336fe99eb8'],
  ['assets/pwa/icon-512.png','image/png','3a87ff39d226dd1dcbec84980eee81ae36d9e98beec33f10e055e6a7ef7b58ae'],
  ['assets/pwa/icon-maskable-512.png','image/png','84368e6f3e33204dcee812e6ac91ba12500f7834f6fe91f52b12c4ee5f204b7a'],
];
const owned = name => name.startsWith(PREFIX) && /^v[1-9][0-9]*$/.test(name.slice(PREFIX.length));
const hex = bytes => [...new Uint8Array(bytes)].map(n=>n.toString(16).padStart(2,'0')).join('');
self.addEventListener('install', event => event.waitUntil((async()=>{
  if(self.registration.scope!==BASE.href)throw Error('scope_mismatch');
  // Verify every immutable public byte before opening or mutating a cache.
  const files=await Promise.all(SHELL.map(async([relative,mime,sha])=>{
    const url=new URL(relative,BASE).href;
    const response=await fetch(url,{credentials:'omit',cache:'no-store',redirect:'error',referrerPolicy:'no-referrer'});
    if(response.status!==200||response.redirected||response.type==='opaque'||response.url!==url||response.headers.get('Content-Type')?.split(';')[0].trim().toLowerCase()!==mime||/\b(?:private|no-store)\b/i.test(response.headers.get('Cache-Control')||''))throw Error('invalid_public_shell');
    const bytes=await response.arrayBuffer();
    if(hex(await crypto.subtle.digest('SHA-256',bytes))!==sha)throw Error('invalid_public_shell');
    return [url,new Response(bytes,{headers:{'Content-Type':mime,'Cache-Control':'public, max-age=0','X-Content-Type-Options':'nosniff'}})];
  }));
  try{const cache=await caches.open(CACHE);for(const[url,response]of files)await cache.put(url,response);}catch(error){await caches.delete(CACHE);throw error;}
  await self.skipWaiting();
})()));
self.addEventListener('activate', event => event.waitUntil((async()=>{
  for(const name of await caches.keys())if(name!==CACHE&&owned(name))await caches.delete(name);
  await self.clients.claim();
})()));
async function offline(){
  const response=await caches.match(new URL(SHELL[0][0],BASE).href,{cacheName:CACHE});
  if(!response)return Response.error();
  // A fixed package base works both at / and at a hosted subdirectory. No request URL is copied.
  const text=(await response.text()).replace('<base href="../../" data-archify-pwa-base>','<base href="'+BASE.href.replaceAll('&','&amp;').replaceAll('"','&quot;')+'" data-archify-pwa-base>');
  return new Response(text,{status:200,headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store','Referrer-Policy':'no-referrer','X-Content-Type-Options':'nosniff'}});
}
self.addEventListener('fetch',event=>{
  const request=event.request;
  if(request.method!=='GET')return;
  if(request.headers.has('Authorization')||request.headers.has('Proxy-Authorization'))return;
  let url;try{url=new URL(request.url);}catch{return;}
  if(url.origin!==BASE.origin||url.search||url.hash||url.username||url.password)return;
  if(SHELL.some(([relative])=>new URL(relative,BASE).href===url.href)){
    // No runtime cache.put/open: opt-out cannot be undone by a still-controlled old tab.
    event.respondWith((async()=>await caches.match(url.href,{cacheName:CACHE})||fetch(request))());return;
  }
  if(request.mode==='navigate'&&(url.href===BASE.href||url.href===new URL('index.html',BASE).href)){
    event.respondWith(fetch(request).catch(()=>offline()));
  }
  // All API, private pages, forms, ticket/QR/query URLs and third-party requests remain browser-owned.
});
