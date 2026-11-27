// [codex] 01a20fd9-f999-7b90-8b1b-b8cd977d4517 · Archify ID event-scoped learning interests.
import {safeId} from './member-ui.mjs';
const route='member/academy-interests';
const slugOK=s=>typeof s==='string'&&s.length<=160&&/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(s);
const text=(s,max)=>typeof s==='string'&&s.trim().length>0&&[...s].length<=max;
function parse(value,owner){
 if(!safeId(owner)||value?.memberId!==owner||!Array.isArray(value.items)||value.items.length>500||typeof value.truncated!=='boolean'||!Number.isFinite(Date.parse(value.asOf)))throw Error('invalid_interests');
 const seen=new Set();
 for(const v of value.items){
  if(!v||!slugOK(v.eventSlug)||seen.has(v.eventSlug)||!['standalone','program'].includes(v.kind)||v.scope!=='event'||typeof v.saved!=='boolean'||
   !text(v.title,400)||!text(v.dateLabel,180)||!(v.city===null||typeof v.city==='string')||!Array.isArray(v.topics)||v.topics.length>100||!v.topics.every(t=>text(t,300))||!text(v.source?.title,500)||
   v.eventHref!=='etkinlik.html?slug='+v.eventSlug+(v.kind==='program'?'#atolyeler':''))throw Error('invalid_interest');
  seen.add(v.eventSlug);
 }
 return value;
}
export async function mountAcademyInterests({host,memberId,api,isCurrent}){
 const doc=host.ownerDocument,article=doc.createElement('article');article.className='learning-interests';host.replaceChildren(article);
 let alive=true,seq=0,filter='all',items=[],truncated=false,busy=false;
 const current=id=>alive&&isCurrent()&&article.isConnected&&!doc.hidden&&(id===undefined||id===seq);
 const make=(t,s,cls)=>{const n=doc.createElement(t);if(s!=null)n.textContent=s;if(cls)n.className=cls;return n;};
 const btn=(label,key,fn)=>{const n=make('button',label,'li-button');n.type='button';n.dataset.action=key;n.onclick=()=>{if(current()&&!busy)void fn();};return n;};
 const heading=make('header',null,'li-heading'),toolbar=make('nav',null,'li-tools'),status=make('p',null,'li-status'),cards=make('div',null,'li-grid');
 heading.append(make('h1','Eğitim ilgilerim'),make('p','Bağımsız atölyeleri ve zirve veya festival içindeki atölye programlarını burada saklayabilirsin. Seçtiğin etkinlik hesabındaki favorilere de eklenir.'));
 status.setAttribute('role','status');status.setAttribute('aria-live','polite');toolbar.setAttribute('aria-label','Eğitimleri süz');article.append(heading,toolbar,status,cards);
 function lock(value){busy=value;article.setAttribute('aria-busy',String(value));for(const b of article.querySelectorAll('button'))b.disabled=value;}
 function render(focus){
  toolbar.replaceChildren();cards.replaceChildren();const saved=items.filter(x=>x.saved).length;
  for(const [id,title] of [['all','Tüm eğitimler ('+items.length+')'],['saved','Kaydettiklerim ('+saved+')']]){
   const b=btn(title,'filter-'+id,()=>{filter=id;render();toolbar.querySelector('[data-action="filter-'+id+'"]').focus();});b.setAttribute('aria-pressed',String(filter===id));toolbar.append(b);
  }
  const visible=items.filter(x=>filter==='all'||x.saved);
  if(!visible.length){const empty=make('section',null,'li-empty');empty.append(make('h2',filter==='saved'?'Henüz bir eğitim kaydetmedin.':'Görüntülenecek eğitim yok.'),make('p',filter==='saved'?'Tüm eğitimlerden ilgini çeken bir atölyeyi seçebilirsin.':'Atölye kitaplığındaki yayımlanmış kayıtlar burada görünür.'));cards.append(empty);}
  for(const v of visible){
   const card=make('article',null,'li-card');card.dataset.eventSlug=v.eventSlug;
   const detail=make('a',v.title);detail.href=v.eventHref;const h=make('h2');h.append(detail);
   card.append(make('p',v.kind==='program'?'Etkinlik içi program':'Bağımsız atölye','li-type'),h,make('p',[v.dateLabel,v.city].filter(Boolean).join(' · '),'li-meta'));
   if(v.kind==='program')card.append(make('p','Bu seçim ana etkinliği kaydeder. Tekil atölye kaydı ve kontenjanı etkinliğin kendi programında belirtilir.'));
   if(v.topics.length){const details=make('details'),list=make('ul');details.append(make('summary','Programdaki başlıklar ('+v.topics.length+')'));for(const topic of v.topics)list.append(make('li',topic));details.append(list);card.append(details);}
   card.append(make('p','Kaynak · '+v.source.title,'li-source'));
   const save=btn(v.saved?'Favorilerimden kaldır':'Favorilerime kaydet','toggle',()=>change(v));save.setAttribute('aria-label',v.title+' · '+save.textContent);save.dataset.saved=String(v.saved);card.append(save);cards.append(card);
  }
  if(truncated)cards.append(make('p','En çok 500 güncel kayıt gösteriliyor.'));
  if(focus){const next=Array.from(cards.querySelectorAll('[data-event-slug]')).find(n=>n.dataset.eventSlug===focus)?.querySelector('button')||toolbar.querySelector('[aria-pressed="true"]');next?.focus();}
 }
 function unavailable(){items=[];cards.replaceChildren();toolbar.replaceChildren(btn('Güncel listeyi yükle','retry',()=>load()));status.textContent='Güncel eğitim listesi alınamadı. Bağlantını kontrol edip yeniden deneyebilirsin.';}
 async function load(message='Eğitim listesi güncel.',focus=null){
  if(!current())return;const id=++seq;lock(true);
  try{const data=parse(await api(route),memberId);if(!current(id))return;items=data.items;truncated=data.truncated;render();status.textContent=message;lock(false);if(focus)render(focus);}
  catch{if(current(id))unavailable();}
  finally{if(current(id))lock(false);}
 }
 async function change(v){
  const id=++seq;lock(true);status.textContent='Seçimin kaydediliyor…';
  try{const result=await api(route,{eventSlug:v.eventSlug,active:!v.saved});if(!current(id))return;if(result?.memberId!==memberId||result.eventSlug!==v.eventSlug||result.active!==!v.saved)throw Error('invalid_confirmation');
   await load(v.saved?'Etkinlik favorilerinden kaldırıldı.':'Etkinlik favorilerine kaydedildi.',v.eventSlug);
  }catch{if(current(id))await load('İşlemin sonucu doğrulanamadı. Güncel kayıt durumunu kontrol et.',v.eventSlug);}
  finally{if(current(id))lock(false);}
 }
 await load();
 return ()=>{alive=false;seq++;items=[];cardCleanup();};
 function cardCleanup(){toolbar.replaceChildren();cards.replaceChildren();article.remove();}
}
