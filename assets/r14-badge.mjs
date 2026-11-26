// [codex] R14 attendee-controlled printable badge; only current verified bearer may render.
import {apiURL,escapeHTML as esc} from './core.mjs';
import {qrSVG} from './tickets.mjs';
const base=new URL('./',location.href),preview=document.querySelector('meta[name="deployment"]')?.content!=='server'||location.hostname.endsWith('.github.io')||location.protocol==='file:';
if(!preview&&document.body.dataset.page==='ticket'){
 const button=document.querySelector('#r14-badge-button'),host=document.querySelector('#r14-badge-host'),report=document.querySelector('#r14-badge-status'),input=document.querySelector('#ticket-token'),receipt=document.querySelector('#ticket-receipt');let current=null,generation=0,busy=false;
 const clear=()=>{generation++;current=null;busy=false;host.hidden=true;host.textContent='';report.textContent='';button.disabled=true;};
 const verified=()=>{clear();const token=input.value.trim();if(!receipt.hidden&&/^[a-f0-9]{64}$/.test(token)){current=token;button.disabled=false;}};
 input.addEventListener('input',clear);window.addEventListener('archify:ticket-clear',clear);window.addEventListener('archify:ticket-verified',verified);if(!receipt.hidden)verified();
 if(button)button.addEventListener('click',async()=>{if(busy||!current||current!==input.value.trim()||receipt.hidden)return;const token=current,attempt=++generation;const active=()=>attempt===generation&&current===token&&input.value.trim()===token&&!receipt.hidden;busy=true;button.disabled=true;
 try{const s=await fetch(apiURL('session',base),{credentials:'same-origin',cache:'no-store'}).then(r=>r.json());if(!active())return;const r=await fetch(apiURL('tickets/badge',base),{method:'POST',credentials:'same-origin',cache:'no-store',headers:{'Content-Type':'application/json','X-CSRF-Token':s.csrfToken},body:JSON.stringify({token})});const d=await r.json();if(!active())return;if(!r.ok||!d.badge)throw Error('badge');const b=d.badge;
 host.innerHTML='<div class="r14-badge-print"><p class="r14-badge-brand">archify®</p><p>ETKİNLİK KATILIMCISI</p><h2>'+esc(b.name)+'</h2><p>'+esc(b.eventTitle)+'</p><div class="r14-badge-qr">'+qrSVG(token)+'</div><p class="r14-badge-serial">'+esc(b.serial)+'</p></div><button id="r14-badge-print" type="button" class="button">Yazdır veya PDF kaydet</button>';host.hidden=false;document.querySelector('#r14-badge-print').onclick=()=>{if(active())window.print();};report.textContent='Yaka kartın hazır. QR kişisel giriş erişimidir; kartı yalnız giriş ekibine göster.';
 }catch{if(active()){host.hidden=true;host.textContent='';report.textContent='Yaka kartı oluşturulamadı. Biletini kontrol et.';}}finally{if(active()){busy=false;button.disabled=false;}}});
}
