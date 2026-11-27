// [codex] 01a20fd9-f999-7b90-8b1b-b8cd977d4517 · Public, code-only certificate check.
import {setupNavigation} from './navigation.mjs';
import {isPreviewDeployment} from './core.mjs';
document.documentElement.classList.add('js');
setupNavigation();
const form=document.querySelector('#certificate-check'),input=form.elements.code,button=form.querySelector('button'),out=document.querySelector('#certificate-out'),heading=out.querySelector('h2'),copy=out.querySelector('p');
const holder=form.elements.holder;
const preview=isPreviewDeployment(document,location);
const pattern=/^[A-Za-z0-9][A-Za-z0-9._-]{5,79}$/;
let generation=0,active;
function result(state,title,message){out.dataset.state=state;heading.textContent=title;copy.textContent=message;out.hidden=false;}
function clear(){generation++;active?.abort();active=null;out.hidden=true;heading.textContent='';copy.textContent='';button.disabled=preview;}
async function check(){
  clear();if(preview)return;
  const code=input.value.trim();
  if(!pattern.test(code)){result('error','Kodu kontrol et','Belgede yazan sertifika kodunu tireleriyle birlikte gir.');input.focus();return;}
  const name=holder.value.trim();
  const turn=generation;const controller=new AbortController();active=controller;const timer=setTimeout(()=>controller.abort(),10000);
  button.disabled=true;result('pending','Kayıt aranıyor…','');
  try{const res=await fetch('./api/sertifika-dogrula.php',{method:'POST',credentials:'omit',redirect:'error',cache:'no-store',referrerPolicy:'no-referrer',headers:{'Content-Type':'application/json'},body:JSON.stringify(name?{code,holder:name}:{code}),signal:controller.signal});
    if(turn!==generation)return;
    if(res.status===429){result('error','Biraz sonra tekrar dene','Kısa sürede çok sayıda sorgulama yapıldı.');return;}
    if(!res.ok)throw Error();const data=await res.json();if(turn!==generation)return;
    if(data.verified===false){result('missing','Kayıt bulunamadı','Kodu belgeden kontrol et. Eski bir belge henüz arşive aktarılmamış olabilir.');return;}
    if(data.verified!==true||typeof data.eventTitle!=='string'||!data.eventTitle.trim()||!/^\d{4}-\d{2}-\d{2}$/.test(data.issuedOn))throw Error();
    const date=new Intl.DateTimeFormat('tr-TR',{dateStyle:'long',timeZone:'UTC'}).format(new Date(data.issuedOn+'T12:00:00Z'));
    if(name && typeof data.holderMatches!=='boolean')throw Error();
    if(name && !data.holderMatches){result('missing','Belgedeki ad eşleşmedi','Sertifika kodu kayıtlı. Girdiğin ad ve soyad bu kayda uymuyor.');return;}
    result('valid',name?'Sertifika kodu ve kişi adı doğrulandı':'Sertifika kaydı doğrulandı',data.eventTitle+' · '+date);
  }catch{if(turn===generation)result('error','Doğrulama servisine ulaşılamadı','Bağlantını kontrol edip tekrar dene.');}
  finally{clearTimeout(timer);if(turn===generation){active=null;button.disabled=false;}}
}
form.addEventListener('submit',e=>{e.preventDefault();void check();});input.addEventListener('input',clear);holder.addEventListener('input',clear);
const hash=new URLSearchParams(location.hash.slice(1));if(location.hash)history.replaceState(null,'',location.pathname+location.search);
if(preview){input.disabled=holder.disabled=button.disabled=true;result('preview','GitHub test görünümü','Gerçek belge sorgulaması Archify’nin sunuculu sitesinde çalışır. Bu önizleme sertifika kodu toplamaz.');}
else if(hash.size===1&&hash.has('kod')&&pattern.test(hash.get('kod'))){input.value=hash.get('kod');void check();}
window.addEventListener('pagehide',()=>{clear();input.value='';holder.value='';});
