// [codex] 01a20fd9-f999-7b90-8b1b-b8cd977d4517 · Member workspaces and reviewed public directories.
import {apiURL,isPreviewDeployment} from './core.mjs';
import {setupNavigation} from './navigation.mjs';

const screens={
 'event-history-workspace':{private:true,history:true,title:'Etkinlik geçmişim',module:'./member-event-history.mjs',mount:'mountEventHistory'},
 'campus-directory':{catalogOnly:true,title:'Kampüs rehberi',module:'./campus-directory.mjs',mount:'mountCampusDirectory'},
 'vacancy-apply':{private:true,param:'ilan',mode:'apply',title:'İlan başvurularım',module:'./vacancy-applications.mjs',mount:'mountVacancyApplications'},
 'vacancy-intake':{private:true,param:'ilan',mode:'intake',title:'İlanlarıma gelen başvurular',module:'./vacancy-applications.mjs',mount:'mountVacancyApplications'},
 'company-workspace':{private:true,title:'Firma paneli',module:'./company-workspace.mjs',mount:'mountCompanyWorkspace'},
 'vacancy-directory':{param:'ilan',title:'İş ve staj ilanları',module:'./company-workspace.mjs',mount:'mountVacancyDirectory',route:'career/vacancies'},
 'network-workspace':{private:true,title:'Mesleki kartım',module:'./network-profiles.mjs',mount:'mountNetworkWorkspace'},
 'network-directory':{param:'profil',title:'Mesleki ağ',module:'./network-profiles.mjs',mount:'mountNetworkDirectory',route:'network-profiles'}
};
const idPattern=/^[a-f0-9]{32}$/;
const failure=(code,status=0)=>Object.assign(new Error(code),{code,status});

async function publicRead(scope,route,body,query={}){
 if(body!==undefined||!(route===scope||(route.startsWith(scope+'/')&&idPattern.test(route.slice(scope.length+1)))))throw failure('invalid_route');
 const url=apiURL(route,new URL('./',location.href));
 for(const [key,value] of Object.entries(query)){
  if(value==null||value==='')continue;
  if(!['type','field','cityId','after'].includes(key)||typeof value!=='string'||value.length>80)throw failure('invalid_query');
  url.searchParams.set(key,value);
 }
 const response=await fetch(url,{method:'GET',credentials:'omit',cache:'no-store',redirect:'error',headers:{Accept:'application/json'},signal:AbortSignal.timeout(12000)});
 const value=await response.json();
 if(!response.ok)throw failure(value?.error||'network',response.status);
 return value;
}

export function startWorkspace(host,screen){
 let turn=0,dispose=null,activeSession=null;
 const preview=isPreviewDeployment(document,location);
 let member=null,parseMember=null;
 function reset(){
  turn++;activeSession=null;member?.clear();member=null;parseMember=null;
  const prior=dispose;dispose=null;
  try{prior?.();}finally{host.replaceChildren();host.hidden=false;}
 }
 function notice(message,href,label){
  reset();
  const title=document.createElement('h1');title.textContent=screen.title;
  const text=document.createElement('p');text.setAttribute('role','status');text.textContent=message;
  host.append(title,text);
  if(href){const link=document.createElement('a');link.className='button';link.href=href;link.textContent=label;host.append(link);}
 }
 async function checkSession(epoch,initial=false){
  if(epoch!==turn||!member)throw failure('member_session_changed',401);
  const response=await member.request('member/session');
  if(epoch!==turn)throw failure('member_session_changed',401);
  if(!response.available||!response.member)throw failure(response.available?'authentication_required':'member_unavailable',401);
  const id=parseMember(response.member).id;
  if(!initial&&id!==activeSession)throw failure('member_session_changed',401);
  activeSession=id;member.setCSRF(response.csrfToken);
 }
 function locked(code){
  let login='hesabim.html';
  if(screen.history&&!preview&&code!=='member_unavailable')login+='?devam=etkinlik-gecmisim';
  if(screen.mode&&!preview&&code!=='member_unavailable'){
   const params=new URLSearchParams({devam:screen.mode==='intake'?'firma-adaylari':'ilan-basvurusu'});
   const jobs=new URLSearchParams(location.search).getAll('ilan');
   if(jobs.length===1&&idPattern.test(jobs[0]))params.set('ilan',jobs[0]);
   login+='?'+params;
  }
  notice(code==='member_unavailable'||preview?'Hesap işlemleri üyelik hizmeti açıldığında kullanılabilir.':'Bu alanı açmak için Archify hesabına giriş yap.',login,'Archify hesabına git');
 }
 async function open(){
  reset();const epoch=turn,current=()=>turn===epoch;
  if(screen.private&&preview){locked('member_unavailable');return;}
  const requested=screen.param?new URLSearchParams(location.search).getAll(screen.param):[];
  if(requested.length&&(requested.length!==1||!idPattern.test(requested[0]))){
   notice('Bağlantı geçersiz. Güncel kayıtları dizinden inceleyebilirsin.',location.pathname,'Dizine dön');return;
  }
  async function guarded(operation){
   try{
    await checkSession(epoch);
    const response=await operation();
    await checkSession(epoch);
    return response;
   }catch(error){
    if(current()&&([401,403].includes(error.status)||error.code==='member_session_changed'))locked(error.code);
    throw error;
   }
  }
  async function downloadPdf(body){
   const blob=await guarded(()=>member.applicationPdf(body));
   if(!current()||!activeSession||document.hidden)throw failure('member_session_changed',401);
   const url=URL.createObjectURL(blob),link=document.createElement('a');
   link.href=url;link.download='archify-cv.pdf';
   try{document.body.append(link);link.click();}
   finally{link.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);}
  }
  const privateRequest=(route,body,query)=>guarded(()=>member.request(route,body,query));
  try{
   if(screen.catalogOnly){
    const leaf=await import(screen.module);
    if(!current())return;
    const qs=new URLSearchParams(location.search),single=key=>qs.getAll(key).length>1?'!':qs.get(key);
    const content=document.createElement('div');host.replaceChildren(content);
    const cleanup=await leaf[screen.mount]({host:content,schoolId:single('okul'),initialCity:single('sehir'),initialQuery:single('q'),
     readCatalog:async()=>{
      const response=await fetch(new URL('data/community-profiles.json',new URL('./',location.href)),{credentials:'omit',cache:'no-cache',redirect:'error',signal:AbortSignal.timeout(8000)});
      if(!response.ok)throw failure('catalog_unavailable',response.status);
      return response.json();
     }});
    if(current())dispose=cleanup;else cleanup?.();
    return;
   }
   if(screen.private){
    const account=await import('./member.mjs');
    if(!current())return;
    member=account.createMemberClient({fetch:window.fetch.bind(window),location,preview});
    parseMember=account.publicMember;
    await checkSession(epoch,true);
   }
   if(screen.history){
    const leaf=await import(screen.module);
    if(!current())return;
    const cleanup=await leaf.mountEventHistory({host,memberId:activeSession,api:privateRequest,isCurrent:current});
    if(current())dispose=cleanup;else cleanup?.();
    return;
   }
   const [leaf,catalog]=await Promise.all([
    import(screen.module),
    fetch(new URL('data/community-profiles.json',new URL('./',location.href)),{credentials:'omit',redirect:'error',signal:AbortSignal.timeout(8000)}).then(r=>r.ok?r.json():{}).catch(()=>({}))
   ]);
   if(!current())return;
   const content=document.createElement('div');host.replaceChildren(content);
   let readSequence=0;
   const applyLink=document.createElement('a');
   applyLink.className='button vacancy-apply-link';applyLink.textContent='Bu ilana başvur';
   async function readDirectory(route,body,query){
    applyLink.remove();
    const sequence=++readSequence;
    if(preview)throw failure('preview');
    const response=await publicRead(screen.route,route,body,query);
    if(current()&&sequence===readSequence&&screen.route==='career/vacancies'&&requested.length===1&&
       route==='career/vacancies/'+requested[0]&&response.vacancy?.id===requested[0]&&
       Date.parse(response.vacancy.deadlineAt)>Date.parse(response.serverNow)){
     applyLink.href='ilan-basvurusu.html?ilan='+requested[0];
     host.append(applyLink);
    }
    return response;
   }
   const cleanup=await leaf[screen.mount]({host:content,preview,recordId:requested[0]??null,isCurrent:current,
    ...(screen.mode?{mode:screen.mode,jobId:requested[0]??null,pdf:downloadPdf}:{}),
    cities:Array.isArray(catalog.cities)?catalog.cities:[],fields:Array.isArray(catalog.fields)?catalog.fields:[],
    api:screen.private?privateRequest:readDirectory});
   if(current())dispose=cleanup;else cleanup?.();
  }catch(error){
   if(!current())return;
   if(screen.private&&[401,403].includes(error.status)){locked(error.code);return;}
   notice('Bu sayfaya şu anda ulaşılamıyor. Bağlantını kontrol edip yeniden deneyebilirsin.',location.href,'Yeniden dene');
  }
 }
 document.addEventListener('visibilitychange',async()=>{
  if(screen.history){
   if(document.hidden){reset();host.hidden=true;}else{void open();}return;
  }
  if(document.hidden){if(screen.private)host.hidden=true;return;}
  // The directory refreshes its current page and filters in its own visibility handler.
  if(!screen.private)return;
  if(!activeSession){host.hidden=false;return;}
  const epoch=turn;
  try{await checkSession(epoch);if(epoch===turn)host.hidden=false;}
  catch(error){if(epoch===turn)locked(error.code);}
 });
 window.addEventListener('pagehide',reset);
 window.addEventListener('pageshow',e=>{if(e.persisted)void open();});
 return open();
}
const host=typeof document!=='undefined'&&document.querySelector('#workspace-root');
if(host&&screens[document.body.dataset.page]){
 document.documentElement.classList.add('js');
 setupNavigation();
 const banner=document.querySelector('#deployment-notice');
 if(banner)banner.hidden=!isPreviewDeployment(document,location);
 for(const button of document.querySelectorAll('[data-consent-preferences]'))button.hidden=true;
 void startWorkspace(host,screens[document.body.dataset.page]);
}
