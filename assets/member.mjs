// [codex] 01a20fe8-199e-7631-8910-07e7d27b753d · R16 isolated Archify ID. No storage, logging, analytics, or automatic bearer claim.
import {authMarkup,dashboardMarkup,dashboardFailureMarkup,MEMBER_ERRORS,MEMBER_INTERESTS,safeSlug,safeId,tokenValid} from './member-ui.mjs';
import {normalizeCommunityProfile,COMMUNITY_ERRORS} from './community-eligibility.mjs';
import {escapeHTML as esc,isPreviewDeployment as memberPreview} from './core.mjs';
const fail=(code,status=0)=>Object.assign(new Error(code),{code,status});
const message=error=>MEMBER_ERRORS[error?.code]||COMMUNITY_ERRORS[error?.code]||'İşlem tamamlanamadı. Bilgilerini kontrol edip yeniden dene.';
const textValid=(value,max)=>typeof value==='string'&&[...value.trim()].length>=1&&[...value.trim()].length<=max&&!/[\u0000-\u001f\u007f]/.test(value);
export {memberPreview};
// [codex] 01a20fd9 · Exact same-origin routes for the private member workspaces.
const baseMemberRoute = /^member\/(?:session|register|login|logout|profile|password|dashboard|event-history|academy-interests|community-applications|favorites|career\/(?:candidates|companies)|(?:tickets|orders)\/(?:claim|open))$/;
const partnerMemberRoute=/^member\/partner-portal(?:\/(?:identity|consent|[a-f0-9]{32}))?$/;
const companyMemberRoute = /^member\/companies(?:\/request|\/[a-f0-9]{32}\/vacancies(?:\/[a-f0-9]{32}(?:\/(?:save|submit|close))?)?)?$/;
const applicantRoute = /^member\/vacancy-applications(?:\/(?:options|preview|[a-f0-9]{32}(?:\/withdraw)?))?$/;
const employerIntakeRoute = /^member\/companies\/[a-f0-9]{32}\/vacancies\/[a-f0-9]{32}\/applications(?:\/[a-f0-9]{32}(?:\/status)?)?$/;
const profileMemberRoute = /^member\/network-profile(?:\/(?:save|submit|withdraw))?$/;
export function memberAPIURL(route,href,query={}) {
 if(typeof route!=='string'||route.trim()!==route||![baseMemberRoute,partnerMemberRoute,companyMemberRoute,profileMemberRoute,applicantRoute,employerIntakeRoute].some(pattern=>pattern.test(route))) throw fail('invalid_route');
 const url=new URL('api/member.php',new URL('./',href));
 url.searchParams.set('r',route);
 for(const [key,value] of Object.entries(query)){
  const cursor=key==='after'&&(companyMemberRoute.test(route)||applicantRoute.test(route)||employerIntakeRoute.test(route));
  const vacancy=key==='vacancyId'&&route==='member/vacancy-applications/options';
  if(!(cursor||vacancy)||typeof value!=='string'||!/^[a-f0-9]{32}$/.test(value))throw fail('invalid_query');
  url.searchParams.set(key,value);
 }
 return url;
}
export function careerContinuation(search){
 const params=new URLSearchParams(search||''),name=params.get('devam');
 if(['etkinlik-gecmisim','egitim-ilgilerim','topluluk-basvurularim','sponsor-paneli'].includes(name))return params.size===1?name+'.html':null;
 if(!['ilan-basvurusu','firma-adaylari'].includes(name)||params.getAll('devam').length!==1||[...params.keys()].some(key=>!['devam','ilan'].includes(key)))return null;
 const jobs=params.getAll('ilan');
 if(jobs.length>1||jobs.length===1&&!/^[a-f0-9]{32}$/.test(jobs[0]))return null;
 return name+'.html'+(jobs.length?'?ilan='+jobs[0]:'');
}
export function consumeMemberHandoff(location,history){
 const raw=location.hash||'';if(!raw)return null;
 // Remove the fragment before any session request. Never retain the full URL.
 try{history.replaceState(null,'',location.pathname+location.search);}catch{return null;}
 if(raw.length>160)return null;const p=new URLSearchParams(raw.slice(1)),keys=[...p.keys()];
 if(keys.length===1&&keys[0]==='claimTicket'&&tokenValid(p.get('claimTicket')))return {kind:'ticket',token:p.get('claimTicket')};
 if(keys.length===2&&new Set(keys).size===2&&keys.includes('claimOrderId')&&keys.includes('claimOrderToken')&&safeId(p.get('claimOrderId'))&&tokenValid(p.get('claimOrderToken')))return {kind:'order',orderId:p.get('claimOrderId'),token:p.get('claimOrderToken')};return null;
}
export function validateCredentials(input,register=false){const username=String(input.username||'').trim().toLowerCase(),password=input.password;if(!/^[a-z0-9][a-z0-9_.-]{2,63}$/.test(username))throw fail('invalid_username');if(typeof password!=='string'||!password||password.includes('\0'))throw fail('invalid_password');if(register){const bytes=new TextEncoder().encode(password).length;if(bytes<14)throw fail('password_too_short');if(bytes>72)throw fail('invalid_password');if(!textValid(input.displayName,120))throw fail('invalid_display_name');}return {username,password,...(register?{displayName:input.displayName.trim()}:{})};}
export function publicMember(value){if(!value||!safeId(value.id)||!textValid(value.displayName,120)||!Number.isInteger(value.revision)||value.revision<1||!Array.isArray(value.interests))throw fail('invalid_member_response');return {id:value.id,displayName:value.displayName,revision:value.revision,profile:value.profile&&typeof value.profile==='object'?{status:value.profile.status,field:value.profile.field,cityId:value.profile.cityId,...(typeof value.profile.schoolId==='string'?{schoolId:value.profile.schoolId}:{}),...(typeof value.profile.schoolName==='string'?{schoolName:value.profile.schoolName}:{})}:null,interests:value.interests.filter(id=>Object.hasOwn(MEMBER_INTERESTS,id))};}
function careerSummaries(value){
 if(!value||value.available!==true)return {available:false,linked:[]};
 if(!Array.isArray(value.linked))throw fail('invalid_dashboard_response');
 const linked=value.linked.map(row=>{
  if(!row||!['candidate','company'].includes(row.kind)||!['received','in_review','closed'].includes(row.status))throw fail('invalid_dashboard_response');
  const pattern=row.kind==='candidate'?/^KRY-[0-9A-F]{16}$/:/^FIR-[0-9A-F]{16}$/;
  const validTime=t=>typeof t==='string'&&/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/.test(t)&&Number.isFinite(Date.parse(t));
  if(!pattern.test(row.reference)||!validTime(row.createdAt)||!validTime(row.updatedAt))throw fail('invalid_dashboard_response');
  return {kind:row.kind,reference:row.reference,status:row.status,createdAt:row.createdAt,updatedAt:row.updatedAt};
 });
 return {available:true,linked};
}
export function privateDashboard(value){
 if(!value||!['tickets','orders','favorites','upcoming'].every(key=>Array.isArray(value[key])))throw fail('invalid_dashboard_response');
 const select=(object,keys)=>Object.fromEntries(keys.filter(key=>Object.hasOwn(object,key)).map(key=>[key,object[key]]));
 const events=list=>list.filter(e=>e&&safeSlug(e.slug)&&typeof e.title==='string').map(e=>select(e,['slug','title','category','startAt','endAt','year','city','registrationOpen','interestMatched']));
 const groups=value.eligibleGroups&&Array.isArray(value.eligibleGroups.groups)?{requiresReview:value.eligibleGroups.requiresReview===true,groups:value.eligibleGroups.groups.filter(g=>g&&safeSlug(g.id)&&typeof g.name==='string').map(g=>select(g,['id','name','category','city']))}:null;
 return {member:publicMember(value.member),tickets:value.tickets.filter(t=>t&&safeId(t.id)).map(t=>select(t,['id','eventSlug','eventTitle','serial','issuedAt','startAt','endAt','checkedIn','certificateEligible','certificateIssued','eventAvailable'])),orders:value.orders.filter(o=>o&&safeId(o.id)).map(o=>select(o,['id','eventSlug','eventTitle','status','priceMinor','currency','expiresAt','createdAt'])),favorites:events(value.favorites),upcoming:events(value.upcoming),eligibleGroups:groups,career:careerSummaries(value.career)};
}
export function createMemberClient({fetch,location,preview=false,timeout=12000}={}){
 let csrfToken='';
 return {setCSRF(value){if(typeof value!=='string'||!value||value.length>512)throw fail('invalid_session_response');csrfToken=value;},clear(){csrfToken='';},
 async applicationPdf(body){
  if(preview||!csrfToken)throw fail('member_unavailable');
  const response=await fetch(new URL('api/ilan-basvuru-belgesi.php',new URL('./',location.href)),{method:'POST',credentials:'same-origin',redirect:'error',cache:'no-store',referrerPolicy:'no-referrer',headers:{'Content-Type':'application/json','X-CSRF-Token':csrfToken},body:JSON.stringify(body),signal:AbortSignal.timeout(timeout)});
  if(!response.ok){const value=await response.json().catch(()=>({}));throw fail(value?.error||'document_unavailable',response.status);}
  const bytes=Number(response.headers.get('Content-Length'));
  if(!Number.isSafeInteger(bytes)||bytes<5||bytes>10*1024*1024||response.headers.get('Content-Type')?.split(';')[0]!=='application/pdf')throw fail('document_unavailable');
  const blob=await response.blob();
  if(blob.size!==bytes||await blob.slice(0,5).text()!=='%PDF-')throw fail('document_unavailable');
  return blob;
 },async request(route,body,query={}){
  if(preview)throw fail('preview');const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),timeout);
  try{const response=await fetch(memberAPIURL(route,location.href,query),{method:body===undefined?'GET':'POST',credentials:'same-origin',cache:'no-store',redirect:'error',signal:controller.signal,headers:body===undefined?{'Accept':'application/json'}:{'Content-Type':'application/json','X-CSRF-Token':csrfToken},...(body===undefined?{}:{body:JSON.stringify(body)})});let value;try{value=await response.json();}catch{throw fail('network',response.status>=500?response.status:0);}if(!response.ok)throw fail(typeof value?.error==='string'?value.error:'network',response.status);return value;}catch(error){if(error.code)throw error;throw fail('network');}finally{clearTimeout(timer);}
 }};
}
export function setupMember({document,window=globalThis.window,location=window?.location,history=window?.history,fetch=globalThis.fetch,preview=memberPreview(document,location),navigate=url=>location.assign(url),client=createMemberClient({fetch,location,preview})}={}){
 const host=document.querySelector('#member-root');if(!host)return null;
 let pending=consumeMemberHandoff(location,history),member=null,dashboard=null,available=false,registrationAvailable=false,mode=document.body.dataset.memberRoute==='register'?'register':'login',epoch=0,busy=false,catalogPromise=null;
 let continuation=pending?null:careerContinuation(location.search);
 // The host is not a live region: only concise operation status is announced.
 host.setAttribute('aria-live','off');
 const q=selector=>host.querySelector(selector),on=(selector,type,callback)=>q(selector)?.addEventListener(type,callback);
 const status=(id,text,error=false)=>{const node=q(id);if(node){node.textContent=text;node.className='member-status'+(error?' member-status-error':'');}};
 const clearSecrets=()=>{for(const input of host.querySelectorAll('input[type="password"]'))input.value='';};
 const protectedError=error=>{if(error.code==='member_authentication_required'){epoch++;member=null;dashboard=null;client.clear();renderAuth();status('#member-auth-status',message(error),true);void establish();return true;}return false;};
 function renderAuth(loading=false){host.innerHTML=authMarkup({register:mode==='register',preview,available,registrationAvailable,pending:!!pending,loading});
  on('#member-auth-form','submit',event=>{event.preventDefault();void authenticate();});
  for(const toggle of host.querySelectorAll('[data-member-auth-mode]'))toggle.addEventListener('click',()=>{if(busy)return;clearSecrets();mode=toggle.dataset.memberAuthMode;renderAuth();q('#member-username')?.focus();});
  if(continuation&&!preview){
   const hint=document.createElement('p');hint.className='member-notice';hint.textContent=continuation==='etkinlik-gecmisim.html'?'Giriş yaptıktan sonra etkinlik geçmişine döneceksin.':continuation==='sponsor-paneli.html'?'Giriş yaptıktan sonra sponsor paneline döneceksin.':continuation==='topluluk-basvurularim.html'?'Giriş yaptıktan sonra topluluk başvurularına döneceksin.':continuation==='egitim-ilgilerim.html'?'Giriş yaptıktan sonra eğitim ilgilerine döneceksin.':'Giriş yaptıktan sonra seçtiğin kariyer ekranına döneceksin.';q('.member-auth-card')?.append(hint);
  }
  if(pending){q('.member-auth-card')?.insertAdjacentHTML('beforeend','<button type="button" class="member-text-button" id="member-cancel-pending-auth">Kaydı eklemekten vazgeç</button>');on('#member-cancel-pending-auth','click',()=>{pending=null;renderAuth();});}
 }
 async function establish(){
  if(preview){pending=null;renderAuth();return;}
  const generation=++epoch;busy=false;renderAuth(true);
  try{const result=await client.request('member/session');if(generation!==epoch)return;client.setCSRF(result.csrfToken);available=result.available===true;registrationAvailable=result.registrationAvailable===true;if(available&&result.member){member=publicMember(result.member);await loadDashboard();}else{member=null;dashboard=null;renderAuth();}}
  catch(error){if(generation!==epoch)return;available=false;member=null;dashboard=null;renderAuth();status('#member-auth-status','Üyelik durumuna şu anda ulaşılamıyor. Bağlantını kontrol edip sayfayı yenile.',true);}
 }
 async function authenticate(){
  if(preview||busy||!available||(mode==='register'&&!registrationAvailable))return;const form=q('#member-auth-form');if(!form?.reportValidity())return;
  let body;try{body=validateCredentials({username:q('#member-username').value,password:q('#member-password').value,displayName:q('#member-display-name')?.value},mode==='register');}catch(error){status('#member-auth-status',message(error),true);return;}
  const generation=++epoch;busy=true;q('#member-auth-fields').disabled=true;q('#member-password').value='';status('#member-auth-status','Güvenli oturum açılıyor…');
  try{const result=await client.request('member/'+(mode==='register'?'register':'login'),body);body=null;if(generation!==epoch)return;client.setCSRF(result.csrfToken);member=publicMember(result.member);await loadDashboard();}
  catch(error){if(generation!==epoch)return;status('#member-auth-status',message(error),true);q('#member-auth-fields').disabled=false;}
  finally{body=null;if(generation===epoch)busy=false;}
 }
 async function loadDashboard(){
  if(preview||!member)return;
  if(continuation){const path=continuation;continuation=null;navigate(path);return;}
  const generation=epoch,expectedId=member.id;
  try{const result=privateDashboard(await client.request('member/dashboard'));if(generation!==epoch||member?.id!==expectedId)return;if(result.member.id!==expectedId)throw fail('member_authentication_required',401);dashboard=result;member=result.member;renderDashboard();}
  catch(error){if(generation!==epoch)return;if(protectedError(error))return;dashboard=null;host.innerHTML=dashboardFailureMarkup(member);bindCommon();}
 }
 function bindCommon(){on('#member-refresh','click',()=>{if(!busy)void refresh();});on('#member-logout','click',()=>void logout());}
 async function refresh(){if(busy||preview)return;busy=true;status('#member-global-status','Kayıtların yenileniyor…');try{await loadDashboard();}finally{busy=false;}}
 async function logout(){
  if(preview||busy||!member)return;busy=true;pending=null;clearSecrets();const generation=++epoch;status('#member-global-status','Oturum kapatılıyor…');
  try{await client.request('member/logout',{});if(generation!==epoch)return;member=null;dashboard=null;client.clear();busy=false;await establish();}
  catch(error){if(generation!==epoch)return;member=null;dashboard=null;available=false;renderAuth();status('#member-auth-status','Çıkış işlemi doğrulanamadı. Bu sayfada kayıtların gizlendi. Oturum durumunu kontrol etmek için sayfayı yenile.',true);}
  finally{if(generation===epoch)busy=false;}
 }
 async function action(route,body,{statusId='#member-global-status',after,reload=false}={}){
  if(preview||busy||!member)return;const generation=epoch;busy=true;status(statusId,'İşlem sürüyor…');const controls=[...host.querySelectorAll('button')].filter(button=>!button.disabled);controls.forEach(button=>button.disabled=true);
  try{const result=await client.request(route,body);body=null;if(generation!==epoch)return;if(after)after(result);if(reload)await loadDashboard();status(reload?'#member-global-status':statusId,'İşlem tamamlandı.');}
  catch(error){if(generation!==epoch)return;if(!protectedError(error)){status(statusId,message(error),true);if(error.code==='revision_conflict'){const form=q('#member-profile-fields');if(form)form.disabled=true;status(statusId,message(error)+' Üstteki Yenile düğmesini kullan.',true);}}}
  finally{body=null;if(generation===epoch){busy=false;controls.forEach(button=>button.disabled=false);}}
 }
 function renderDashboard(){
  host.innerHTML=dashboardMarkup(dashboard,{pending});bindCommon();
  for(const button of host.querySelectorAll('[data-member-open-ticket]'))button.addEventListener('click',()=>{if(button.disabled)return;void action('member/tickets/open',{ticketId:button.dataset.memberOpenTicket},{after:value=>{if(!tokenValid(value.token)||!safeSlug(value.eventSlug))throw fail('invalid_ticket_response');navigate('bilet.html#token='+value.token);}});});
  for(const button of host.querySelectorAll('[data-member-open-order]'))button.addEventListener('click',()=>{if(button.disabled)return;void action('member/orders/open',{orderId:button.dataset.memberOpenOrder},{after:value=>{if(!tokenValid(value.token)||!safeId(value.orderId))throw fail('invalid_order_response');navigate('odeme.html#orderId='+value.orderId+'&token='+value.token);}});});
  for(const button of host.querySelectorAll('[data-member-favorite]'))button.addEventListener('click',()=>void action('member/favorites',{eventSlug:button.dataset.memberFavorite,active:button.dataset.memberActive==='true'},{reload:true}));
  on('#member-cancel-claim','click',()=>{if(busy)return;pending=null;renderDashboard();});on('#member-confirm-claim','click',()=>{if(!pending)return;const body=pending.kind==='ticket'?{token:pending.token}:{orderId:pending.orderId,token:pending.token},route=pending.kind==='ticket'?'member/tickets/claim':'member/orders/claim';void action(route,body,{reload:true,after:()=>{pending=null;}});});
  for(const kind of ['ticket','order'])on('#member-'+kind+'-claim-form','submit',event=>{event.preventDefault();if(busy||preview)return;const token=q('#member-'+kind+'-token').value.trim(),orderId=kind==='order'?q('#member-order-id').value.trim():null;q('#member-'+kind+'-token').value='';if(kind==='order')q('#member-order-id').value='';const statusId='#member-'+kind+'-claim-status';if(!tokenValid(token)||(kind==='order'&&!safeId(orderId))){status(statusId,'Gizli kod 64, sipariş numarası 32 küçük harf veya rakamdan oluşur. Kaydındaki kodu kontrol et.',true);return;}void action('member/'+(kind==='ticket'?'tickets':'orders')+'/claim',kind==='ticket'?{token}:{orderId,token},{statusId,reload:true});});
  setupProfile();
  on('#member-password-form','submit',event=>{event.preventDefault();if(busy||preview)return;const currentPassword=q('#member-current-password').value,newPassword=q('#member-new-password').value;clearSecrets();const bytes=new TextEncoder().encode(newPassword).length;if(!currentPassword||bytes<14||bytes>72){status('#member-password-status',message({code:bytes<14?'password_too_short':'invalid_password'}),true);return;}void action('member/password',{currentPassword,newPassword},{statusId:'#member-password-status',reload:true,after:value=>{if(value.csrfToken)client.setCSRF(value.csrfToken);if(value.member)member=publicMember(value.member);}});});
 }
 async function catalog(){if(!catalogPromise)catalogPromise=fetch(new URL('data/community-profiles.json',new URL('./',location.href)),{credentials:'same-origin',cache:'no-cache',redirect:'error'}).then(response=>{if(!response.ok)throw fail('network');return response.json();}).then(value=>{if(value.version!=='r12-1'||!['statuses','fields','cities','schools'].every(k=>Array.isArray(value[k])))throw fail('invalid_profile_catalog');return value;}).catch(error=>{catalogPromise=null;throw error;});return catalogPromise;}
 function setupProfile(){
  const form=q('#member-profile-form'),generation=epoch,revision=member.revision,original=member.profile;let profileData=null,loading=true;
  // Explicit property sync also supports structural tests without HTML form initialization.
  q('#member-profile-enabled').checked=!!original;for(const input of host.querySelectorAll('[data-member-interest]'))input.checked=member.interests.includes(input.dataset.memberInterest);
  const conditional=()=>{const enabled=q('#member-profile-enabled').checked,school=['student','graduate'].includes(q('#member-profile-status').value);q('#member-profile-details').hidden=!enabled;q('#member-profile-school-wrap').hidden=!school;q('#member-profile-manual-wrap').hidden=!school||q('#member-profile-school').value!=='manual';};
  for(const id of ['#member-profile-enabled','#member-profile-status','#member-profile-school'])on(id,'change',conditional);
  q('#member-profile-catalog-status').textContent='Profille ilgili seçenekler yükleniyor…';
  void catalog().then(data=>{if(generation!==epoch||q('#member-profile-form')!==form)return;profileData=data;loading=false;
   for(const [id,key,label] of [['status','statuses','label'],['field','fields','label'],['city','cities','label'],['school','schools','name']]){const select=q('#member-profile-'+id);select.innerHTML='<option value="">Seç</option>'+data[key].map(item=>`<option value="${esc(item.id)}">${esc(item[label])}</option>`).join('')+(id==='school'?'<option value="manual">Okulum listede yok</option>':'');select.value=original?.[id==='city'?'cityId':id==='school'?'schoolId':id]||(id==='school'&&original?.schoolName?'manual':'');}
   q('#member-profile-catalog-status').textContent='';conditional();
  }).catch(()=>{if(generation!==epoch||q('#member-profile-form')!==form)return;loading=false;q('#member-profile-catalog-status').textContent='Profil seçenekleri şu anda yüklenemiyor. Mevcut profilin değiştirilmeden korunur; yeniden denemek için kayıtlarını yenile.';q('#member-profile-enabled').disabled=true;});
  on('#member-profile-form','submit',event=>{event.preventDefault();if(preview||busy)return;const displayName=q('#member-profile-name').value.trim();if(!textValid(displayName,120)){status('#member-profile-save-status',message({code:'invalid_display_name'}),true);return;}let profile=original;
   if(loading){status('#member-profile-save-status','Profil seçeneklerinin yüklenmesini bekle.',true);return;}
   if(profileData){if(q('#member-profile-enabled').checked){const checked=normalizeCommunityProfile({status:q('#member-profile-status').value,field:q('#member-profile-field').value,cityId:q('#member-profile-city').value,schoolId:q('#member-profile-school').value,schoolName:q('#member-profile-school-name').value},profileData);if(!checked.ok){status('#member-profile-save-status',checked.message,true);return;}profile=checked.profile;}else profile=null;}
   const interests=[...host.querySelectorAll('[data-member-interest]')].filter(input=>input.checked).map(input=>input.dataset.memberInterest);
   void action('member/profile',{expectedRevision:revision,displayName,profile,interests},{statusId:'#member-profile-save-status',reload:true,after:value=>{if(value.csrfToken)client.setCSRF(value.csrfToken);if(value.member)member=publicMember(value.member);}});
  });conditional();
 }
 window?.addEventListener?.('pagehide',()=>{pending=null;clearSecrets();epoch++;member=null;dashboard=null;busy=false;renderAuth(true);});
 window?.addEventListener?.('pageshow',event=>{if(event.persisted)void establish();});
 const ready=establish();return {ready,refresh,logout,get state(){return {preview,authenticated:!!member,available,registrationAvailable,busy,pendingClaim:pending?.kind||null};}};
}
if(typeof document!=='undefined'&&document.querySelector('#member-root'))setupMember({document});
