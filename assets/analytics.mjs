// [codex] 01a20fe8-199e-7631-8910-07e7d27b753d · R12 first-party, consent-gated measurement
export const CONSENT_VERSION='r12-1';
export const ANALYTICS_PAGES=Object.freeze(['home','archive','events','category','series','detail','community','community-application','application','team-application','media','about','contact','partnership','links','privacy','sources','not-found','career','career-application','company-application','ticket','checkout']);
export const ANALYTICS_TARGETS=Object.freeze(['nav-home','nav-events','nav-archive','nav-community','nav-media','nav-about','nav-contact','nav-partnership','nav-links','nav-privacy','nav-sources','nav-team','nav-career','category-open','series-open','event-detail','event-apply','archive-filter','archive-search','community-profile-check','community-group-select','community-apply','gallery-open','gallery-next','gallery-previous','gallery-more','gallery-close','poster-open','video-play','video-external','social-external','source-open','contact-open','partnership-open','form-retry','menu-toggle','nav-disclosure','career-open','career-apply','company-apply','career-submit','company-submit','event-application','team-application','community-application','career-application','company-application']);
const SOURCE_VALUES=['direct','instagram','facebook','linkedin','youtube','tiktok','google','bing','newsletter','partner','whatsapp','other'];
const MEDIUM_VALUES=['direct','organic','social','paid-social','cpc','email','referral','qr','offline','other'];
const REFERRERS=['direct','search','social','referral','email','other','unknown'];
const DEVICES=['desktop','tablet','mobile','unknown'];
export const CONSENT_KEYS=Object.freeze({preference:'archify-consent-r12',visitor:'archify-visitor-r12',visit:'archify-visit-r12'});
const LIFE=30*86400000;
let activeConsent=false;
let activeAdvertising=false;
export function advertisingRequestHeaders(){return activeAdvertising?{}:{'X-Advertising-Consent':'denied'};}
export function analyticsRequestHeaders(){return activeConsent?{}:{'X-Analytics-Consent':'denied'};}
export function consentValue(value){return !!value&&value.version===CONSENT_VERSION&&typeof value.analytics==='boolean'&&typeof value.advertising==='boolean'?{version:CONSENT_VERSION,analytics:value.analytics,advertising:value.advertising}:null;}
export function coarseReferrer(value){
 if(!value)return 'direct';
 try{const host=new URL(value).hostname.toLowerCase();if(/(^|\.)(google\.[a-z.]+|bing\.com|duckduckgo\.com|yandex\.[a-z.]+)$/.test(host))return 'search';if(/(^|\.)(instagram\.com|facebook\.com|fb\.com|linkedin\.com|youtube\.com|tiktok\.com|t\.co|x\.com|twitter\.com)$/.test(host))return 'social';return 'referral';}catch{return 'unknown';}
}
export function analyticsSource(search='',referrer='',device='unknown'){
 const q=new URLSearchParams(search),out={referrer:REFERRERS.includes(referrer)?referrer:coarseReferrer(referrer),device:DEVICES.includes(device)?device:'unknown'};
 const source=q.get('utm_source'),medium=q.get('utm_medium');
 if(SOURCE_VALUES.includes(source))out.source=source;
 if(MEDIUM_VALUES.includes(medium))out.medium=medium;
 for(const [key,pattern] of [['campaign',/^arc-[a-z0-9-]{1,59}$/],['content',/^creative-[a-z0-9-]{1,49}$/],['term',/^aud-[a-z0-9-]{1,49}$/]]){const value=q.get('utm_'+key);if(value&&pattern.test(value)&&!/[0-9]{7}/.test(value))out[key]=value;}
 return out;
}
function ancestor(node,predicate){for(let current=node;current;current=current.parentElement)if(predicate(current))return current;return null;}
function readJSON(storage,key){try{return JSON.parse(storage?.getItem(key)||'null');}catch{return null;}}
function writeJSON(storage,key,value){try{if(!storage)return false;storage.setItem(key,JSON.stringify(value));return true;}catch{return false;}}
function remove(storage,key){try{storage?.removeItem(key);}catch{/* Optional storage unavailable. */}}
function deviceType(win){const width=win.innerWidth;return Number.isFinite(width)?width<621?'mobile':width<1001?'tablet':'desktop':'unknown';}
function knownTarget(node,location){
 const explicit=ancestor(node,e=>e.getAttribute?.('data-analytics-target'))?.getAttribute('data-analytics-target');if(ANALYTICS_TARGETS.includes(explicit))return explicit;
 const control=ancestor(node,e=>e.tagName==='BUTTON'||e.tagName==='A'||e.tagName==='SELECT');if(!control)return '';
 const id=control.getAttribute('id');const ids={'gallery-prev':'gallery-previous','gallery-next':'gallery-next','archive-gallery-more':'gallery-more','retry-application':'form-retry','menu-toggle':'menu-toggle','profile-submit':'community-profile-check'};
 if(ids[id])return ids[id];
 if(control.getAttribute('data-gallery-index')!==null)return 'gallery-open';
 if(control.getAttribute('data-lightbox-index')!==null)return 'gallery-open';
 if(control.getAttribute('data-nav-toggle')!==null)return 'nav-disclosure';
 if(control.getAttribute('data-mobile-menu')!==null)return 'menu-toggle';
 if(control.getAttribute('data-community-group')!==null)return 'community-group-select';
 if(control.classList?.contains('lightbox-close'))return 'gallery-close';
 if(control.classList?.contains('video-trigger'))return 'video-play';
 if(control.classList?.contains('video-link'))return 'video-external';
 if(control.classList?.contains('source-link'))return 'source-open';
 if(ancestor(control,e=>e.classList?.contains('archive-poster-item')))return 'poster-open';
 if(control.tagName!=='A')return '';
 let url;try{url=new URL(control.getAttribute('href'),location.href);}catch{return '';}
 if(url.origin!==location.origin){return /(^|\.)(instagram\.com|youtube\.com|linkedin\.com|facebook\.com)$/.test(url.hostname)?'social-external':'';}
 const file=url.pathname.split('/').at(-1),routes={'index.html':'nav-home','etkinlikler.html':'nav-events','arsiv.html':'nav-archive','topluluk.html':'nav-community','medya.html':'nav-media','hakkimizda.html':'nav-about','iletisim.html':'nav-contact','is-birligi.html':'nav-partnership','baglantilar.html':'nav-links','gizlilik.html':'nav-privacy','kaynaklar.html':'nav-sources','ekibe-katil.html':'nav-team','kategori.html':'category-open','seri.html':'series-open','etkinlik.html':'event-detail','basvuru.html':'event-apply','grup-basvuru.html':'community-apply','kariyer.html':'nav-career'};
 return routes[file]||'';
}
function formTarget(form,page){const id=form?.getAttribute?.('id');if(id==='career-form')return 'career-application';if(id==='company-form')return 'company-application';if(id!=='application-form')return '';return page==='team-application'?'team-application':['community','community-application'].includes(page)?'community-application':'event-application';}

export function setupAnalytics({document,window,location,preview,request,session,now=()=>Date.now(),crypto=globalThis.crypto,setTimer=setTimeout,clearTimer=clearTimeout,storage,sessionStorage,onConsent=()=>{},onEvent=()=>{}}={}){
 activeConsent=false;activeAdvertising=false;
 const page=ANALYTICS_PAGES.includes(document.body.dataset.page)?document.body.dataset.page:'not-found';
 const publicSlugs=new Set();let preference=null,consented=false,ready=false,pageReady=false,pageSent=false,visitorId=null,visitId=null,queue=[],timer=null,inFlight=new Set(),generation=0,lastScroll=0,returnFocus=null,disposed=false;
 let local=storage,visitStorage=sessionStorage;
 if(!preview){try{local??=window.localStorage;visitStorage??=window.sessionStorage;}catch{}}
 if(!preview)preference=consentValue(readJSON(local,CONSENT_KEYS.preference));
 const randomId=()=>{if(!crypto?.getRandomValues)throw new Error('secure_random_unavailable');return [...crypto.getRandomValues(new Uint8Array(16))].map(n=>n.toString(16).padStart(2,'0')).join('');};
 const q=s=>document.querySelector(s);
 const clearOptional=()=>{visitorId=null;visitId=null;remove(local,CONSENT_KEYS.visitor);remove(visitStorage,CONSENT_KEYS.visit);};
 const halt=()=>{ready=false;consented=false;activeConsent=false;pageSent=false;lastScroll=0;queue=[];if(timer!==null){clearTimer(timer);timer=null;}clearOptional();};
 const ensureIds=()=>{
  const stored=readJSON(local,CONSENT_KEYS.visitor);const valid=stored&&/^[a-f0-9]{32}$/.test(stored.id)&&Number.isFinite(stored.expiresAt)&&stored.expiresAt>now()&&stored.expiresAt<=now()+LIFE;
  visitorId=valid?stored.id:randomId();if(!valid){writeJSON(local,CONSENT_KEYS.visitor,{id:visitorId,expiresAt:now()+LIFE});remove(visitStorage,CONSENT_KEYS.visit);}
  const saved=readJSON(visitStorage,CONSENT_KEYS.visit);visitId=typeof saved==='string'&&/^[a-f0-9]{32}$/.test(saved)?saved:randomId();writeJSON(visitStorage,CONSENT_KEYS.visit,visitId);
 };
 const pageSlug=()=>{const slug=new URLSearchParams(location.search).get('slug');return publicSlugs.has(slug)?slug:null;};
 const emit=(type,target,slug)=>{
  if(preview||!consented||!ready||disposed)return false;
  if(!['page_view','click','form_start','form_submit','scroll'].includes(type))return false;
  if(target&&!(type==='scroll'?['25','50','75','100'].includes(target):ANALYTICS_TARGETS.includes(target)))return false;
  const event={id:randomId(),type,page};const known=publicSlugs.has(slug)?slug:pageSlug();if(known)event.eventSlug=known;if(target)event.target=target;
  if(queue.length>=20){if(type!=='form_submit')return false;queue.shift();}queue.push(event);try{onEvent(event);}catch{}if(timer===null)timer=setTimer(()=>{timer=null;void flush();},800);return true;
 };
 async function flush({urgent=false}={}){
  if(preview||!consented||!ready||disposed)return;
  // A submit or page exit must not wait behind an older measurement request.
  if(inFlight.size&&!urgent){await Promise.all([...inFlight]);if(queue.length)return flush();return;}
  if(!queue.length)return;
  if(timer!==null){clearTimer(timer);timer=null;}
  const batch=queue.splice(0,20);
  const sending=request('analytics/collect',{events:batch}).catch(()=>{});
  inFlight.add(sending);
  try{await sending;}finally{inFlight.delete(sending);if(queue.length&&consented&&ready&&!disposed&&timer===null)timer=setTimer(()=>{timer=null;void flush();},800);}
 }
 const pageView=()=>{pageReady=true;if(!pageSent&&ready&&consented){pageSent=emit('page_view');}};
 const status=text=>{const host=q('#consent-status');if(host)host.textContent=text;};
 const reflect=()=>{q('#consent-banner').hidden=!!preference||preview;q('#consent-analytics').checked=preference?.analytics===true;q('#consent-advertising').checked=preference?.advertising===true;};
 async function choose(choice,{restore=false}={}){
  if(preview){status('Test yayınında ölçüm veya reklam kaydı yapılmaz.');return false;}
  const next=consentValue({version:CONSENT_VERSION,...choice});if(!next)return false;
  const current=++generation;activeAdvertising=false;try{onConsent({analytics:false,advertising:false});}catch{}preference=next;if(!writeJSON(local,CONSENT_KEYS.preference,next))remove(local,CONSENT_KEYS.preference);reflect();ready=false;activeConsent=false;queue=[];if(timer!==null){clearTimer(timer);timer=null;}
  if(!next.analytics)halt();else consented=true;
  status('Tercihlerin kaydediliyor…');
  try{
   if(next.analytics)ensureIds();
   await session();
   if(current!==generation)return false;
   let payload={...next,...(next.analytics?{visitorId,visitId,source:analyticsSource(location.search,document.referrer||'',deviceType(window))}:{})};
   let result;
   try{result=await request('analytics/consent',payload);}catch(error){
    if(next.analytics&&error.code==='analytics_identifier_expired'){clearOptional();ensureIds();payload={...payload,visitorId,visitId};result=await request('analytics/consent',payload);}
    else if(['request_verification','csrf_invalid','invalid_csrf'].includes(error.code)){await session();result=await request('analytics/consent',payload);}else throw error;
   }
   if(current!==generation)return false;
   const accepted=consentValue(result);if(!accepted||accepted.analytics!==next.analytics||accepted.advertising!==next.advertising)throw new Error('consent_not_confirmed');
   ready=next.analytics;consented=next.analytics;activeConsent=ready;activeAdvertising=next.advertising;try{onConsent({analytics:ready,advertising:activeAdvertising});}catch{}status('Tercihlerin kaydedildi. İstediğin zaman değiştirebilirsin.');
   if(pageReady)pageView();return true;
  }catch{if(current===generation){ready=false;activeConsent=false;status('Tercih sunucuda doğrulanamadı. Ölçüm kapalı; aşağıdan yeniden kaydedebilirsin.');if(!restore)q('#consent-dialog').showModal?.();}return false;}
 }
 function showPreferences(trigger){returnFocus=trigger||document.activeElement;reflect();status(preview?'Test yayınında ölçüm veya reklam kaydı yapılmaz.':'Zorunlu işlemler dışında seçim tamamen sana ait.');q('#consent-dialog').showModal?.();q('#consent-analytics').focus?.();}
 if(!q('#consent-banner'))document.body.insertAdjacentHTML('beforeend',`<aside id="consent-banner" class="consent-banner" aria-label="Gizlilik tercihleri"><div><p class="consent-kicker">Seçim sana ait</p><h2>Archify’ı birlikte geliştirelim.</h2><p>İzninle, hangi sayfaların ve bağlantıların kullanıldığını kendi sistemimizde ölçebiliriz. Başvuruların bu tercihten bağımsızdır.</p></div><div class="consent-actions"><button type="button" id="consent-accept">Ölçümü kabul et</button><button type="button" id="consent-reject">İsteğe bağlıları reddet</button><button type="button" id="consent-settings">Tercihleri seç</button></div></aside><dialog id="consent-dialog" class="consent-dialog" aria-labelledby="consent-title"><button type="button" id="consent-close" class="consent-close" aria-label="Gizlilik tercihlerini kapat">Kapat ×</button><p class="consent-kicker">Gizlilik tercihleri</p><h2 id="consent-title">Ne paylaşılacağına sen karar ver.</h2><p>Zorunlu oturum ve başvuru işlemleri her zaman çalışır. İsteğe bağlı seçimleri sonradan değiştirebilirsin.</p><label class="consent-choice"><input type="checkbox" id="consent-analytics"><span><strong>Kullanım ölçümü</strong><small>Sayfa, bağlantı ve başvuru akışlarının anonim kullanımını Archify’ın sisteminde ve bağlıysa izin verilen ölçüm hizmetinde ölçer. Adın, telefonun, okulun ve form yanıtların ölçüme girmez.</small></span></label><label class="consent-choice"><input type="checkbox" id="consent-advertising"><span><strong>Reklam tercihi</strong><small>Bağlı bir sağlayıcı varsa, yalnız bu izinle reklam dönüşümü ölçülür. Form yanıtların paylaşılmaz.</small></span></label><p id="consent-status" role="status"></p><div class="consent-actions"><button type="button" id="consent-save">Tercihleri kaydet</button><button type="button" id="consent-dialog-reject">İsteğe bağlıları reddet</button></div><a href="gizlilik.html">Gizlilik açıklamasını oku</a></dialog>`);
 if(!document.querySelector('[data-consent-preferences]'))document.body.insertAdjacentHTML('beforeend','<button type="button" class="consent-reopen" data-consent-preferences>Gizlilik tercihleri</button>');
 q('#consent-accept').addEventListener('click',()=>void choose({analytics:true,advertising:false}));q('#consent-reject').addEventListener('click',()=>void choose({analytics:false,advertising:false}));q('#consent-settings').addEventListener('click',event=>showPreferences(event.target));
 q('#consent-save').addEventListener('click',()=>void choose({analytics:q('#consent-analytics').checked===true,advertising:q('#consent-advertising').checked===true}).then(ok=>{if(ok)q('#consent-dialog').close();}));
 q('#consent-dialog-reject').addEventListener('click',()=>void choose({analytics:false,advertising:false}).then(ok=>{if(ok)q('#consent-dialog').close();}));q('#consent-close').addEventListener('click',()=>q('#consent-dialog').close());q('#consent-dialog').addEventListener('close',()=>returnFocus?.focus?.());
 document.querySelectorAll('[data-consent-preferences]').forEach(button=>button.addEventListener('click',()=>showPreferences(button)));
 if(preview){for(const id of ['consent-analytics','consent-advertising','consent-save','consent-dialog-reject'])q('#'+id).disabled=true;}
 reflect();
 const started=new Set();let searched=false;
 document.addEventListener('click',event=>{const target=knownTarget(event.target,location);if(!target)return;const link=ancestor(event.target,e=>e.tagName==='A');let slug;try{slug=new URL(link?.getAttribute('href'),location.href).searchParams.get('slug');}catch{}emit('click',target,slug);});
 document.addEventListener('focusin',event=>{const form=ancestor(event.target,e=>e.tagName==='FORM'),target=formTarget(form,page);if(target&&!started.has(target)&&!event.target.disabled&&!ancestor(event.target,e=>e.tagName==='FIELDSET'&&e.disabled)&&emit('form_start',target))started.add(target);});
 // Capture observes the enabled form before its own submit handler disables controls.
 document.addEventListener('submit',event=>{const target=formTarget(event.target,page);if(target&&!event.target.querySelector('fieldset')?.disabled&&emit('form_submit',target))void flush({urgent:true});},{capture:true});
 document.addEventListener('change',event=>{if(['category','year'].includes(event.target.getAttribute?.('id')))emit('click','archive-filter');});
 document.addEventListener('input',event=>{if(event.target.getAttribute?.('id')==='search'&&!searched&&emit('click','archive-search'))searched=true;});
 window.addEventListener('scroll',()=>{if(!ready||!consented)return;const height=Math.max(document.documentElement.scrollHeight||0,document.body.scrollHeight||0),viewport=window.innerHeight||0;if(height<=viewport)return;const percent=Math.min(100,Math.floor(((window.scrollY||0)+viewport)/height*100));for(const threshold of [25,50,75,100])if(threshold>lastScroll&&percent>=threshold){emit('scroll',String(threshold));lastScroll=threshold;}},{passive:true});
 window.addEventListener('pagehide',()=>{void flush({urgent:true});});
 if((preference?.analytics||preference?.advertising)&&!preview)void choose(preference,{restore:true});
 return {pageView,flush,choose,showPreferences,record:emit,allowEvents(events){for(const e of events||[])if(e&&e.status!=='draft'&&typeof e.slug==='string'&&/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(e.slug)&&e.slug.length<=160)publicSlugs.add(e.slug);},get state(){return {analytics:consented&&ready,advertising:activeAdvertising,preview};},dispose(){disposed=true;ready=false;activeConsent=false;activeAdvertising=false;try{onConsent({analytics:false,advertising:false});}catch{}queue=[];if(timer!==null)clearTimer(timer);}};
}
